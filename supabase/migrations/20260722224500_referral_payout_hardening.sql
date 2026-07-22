-- ============================================================
-- Referral + payout hardening (audit-to-completion pass)
-- Companion to 20260627000000 + 20260708000000. Additive, forward-only.
--
-- What this closes (each independently verified against the live defs):
--
-- P0  approve_payout was BROKEN for any recipient with a payout method:
--     20260708000000 declared v_method jsonb and read profiles.payout_method
--     (enum payout_method_kind) into it. 'paypal' is not valid JSON, so the
--     assignment cast raises and NO payout could ever be approved. Restored
--     the enum-safe read (::text) while keeping every 20260708 guard.
--
-- P1  Founder self-referral was unguarded at every layer. attribute_referral
--     only self-checked user_referral codes; the attribution_no_self CHECK and
--     reward_events_no_self_referral CHECK both pass founder rows because
--     referrer_user_id is NULL there. A founder subscribing with their own
--     code earned commission on themselves, invisibly. Now blocked at the
--     attribution gate AND at reward insert (belt + suspenders for any
--     pre-existing attribution).
--
-- P1  Global payout kill switch: app_settings.payouts_frozen, honored by
--     approve_payout + mark_payout_paid (money-out gates only — accrual,
--     maturation, drafting, and mark_failed keep working while frozen), and
--     flipped by the audited admin_set_payouts_frozen RPC.
--
-- P2  mature_holds promoted past_due rewards to payable. A subscription in
--     dunning at hold expiry could get PAID for a month the customer never
--     paid. past_due now neither promotes nor reverses — the row stays
--     pending and re-checks on the next worker run (Stripe dunning either
--     recovers it or cancels the sub, which then reverses it).
--
-- P2  Refund-after-paid had no ledger answer: reverse_reward_for_invoice only
--     reversed pending/payable. A refund landing after a payout left the paid
--     ledger overstated forever. Now a compensating NEGATIVE payable entry
--     (idempotency 'clawback:<original id>', linked via reversed_by_event_id)
--     nets against the referrer's next monthly batch. Paid rows are never
--     edited or deleted — append-only, reconcilable.
--
-- P3  Both batch builders skipped total = 0 but would happily create a
--     NEGATIVE payout once clawbacks exist. total <= 0 now returns NULL and
--     the rows roll forward until future earnings outweigh the clawback.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Kill-switch setting + helper + admin RPC
-- ------------------------------------------------------------
INSERT INTO public.app_settings(key, value, description)
VALUES ('payouts_frozen', to_jsonb(false), 'Global payout kill switch: blocks approve_payout + mark_payout_paid while true')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payouts_frozen()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key = 'payouts_frozen'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_set_payouts_frozen(_frozen boolean, _reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  -- Freezing demands a reason (it halts real money); unfreezing may stand alone.
  IF _frozen AND COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  INSERT INTO public.app_settings(key, value, description)
  VALUES ('payouts_frozen', to_jsonb(_frozen), 'Global payout kill switch: blocks approve_payout + mark_payout_paid while true')
  ON CONFLICT (key) DO UPDATE SET value = to_jsonb(_frozen);

  PERFORM public.write_audit(
    auth.uid(),
    CASE WHEN _frozen THEN 'payouts_frozen' ELSE 'payouts_unfrozen' END,
    'app_setting', NULL, NULL,
    jsonb_build_object('frozen', _frozen), _reason
  );
  RETURN _frozen;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_payouts_frozen(boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payouts_frozen(boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.payouts_frozen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payouts_frozen() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 1) approve_payout — enum-safe method read + freeze gate.
--    Body is 20260708000000 verbatim except:
--      · v_method text + ::text read (the P0 fix)
--      · payouts_frozen gate
--      · 'donate' passes the method check naturally (any non-empty method)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payout(_payout uuid)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p           public.payouts;
  v_recipient uuid;
  v_method    text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.payouts_frozen() THEN RAISE EXCEPTION 'payouts_frozen'; END IF;

  SELECT * INTO p FROM public.payouts WHERE id = _payout;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF p.status <> 'draft' THEN RAISE EXCEPTION 'payout_not_draft'; END IF;

  IF p.founder_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.founders WHERE id = p.founder_id;
  ELSE
    v_recipient := p.user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.fraud_flags ff
     WHERE ff.resolved_at IS NULL
       AND (
         (p.founder_id IS NOT NULL AND ff.subject_type = 'founder' AND ff.subject_id = p.founder_id)
         OR (v_recipient IS NOT NULL AND ff.subject_type = 'user' AND ff.subject_id = v_recipient)
       )
  ) THEN
    RAISE EXCEPTION 'recipient_fraud_flagged';
  END IF;

  SELECT payout_method::text INTO v_method FROM public.profiles WHERE user_id = v_recipient;
  IF COALESCE(v_method, '') = '' THEN
    RAISE EXCEPTION 'no_payout_method';
  END IF;

  UPDATE public.payouts
     SET status = 'approved', approved_at = now(), approved_by_user_id = auth.uid(), updated_at = now()
   WHERE id = _payout AND status = 'draft'
   RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_draft'; END IF;

  PERFORM public.write_audit(auth.uid(), 'approve_payout', 'payout', p.id, NULL, to_jsonb(p), NULL);
  RETURN p;
END;
$$;

-- ------------------------------------------------------------
-- 2) mark_payout_paid — freeze gate added; everything else verbatim
--    (approved/processing only, provider id recorded, rewards flip
--    payable→paid exactly once, audit row).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_payout_paid(_payout uuid, _provider_id text)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.payouts_frozen() THEN RAISE EXCEPTION 'payouts_frozen'; END IF;
  UPDATE public.payouts
     SET status = 'paid', paid_at = now(), provider_payout_id = _provider_id, updated_at = now()
   WHERE id = _payout AND status IN ('approved', 'processing')
   RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_approved'; END IF;
  UPDATE public.reward_events SET status = 'paid' WHERE payout_id = _payout AND status = 'payable';
  PERFORM public.write_audit(auth.uid(), 'mark_payout_paid', 'payout', p.id, NULL, to_jsonb(p), NULL);
  RETURN p;
END;
$$;

-- ------------------------------------------------------------
-- 3) Founder self-referral — blocked at the attribution gate.
--    Body is the live attribute_referral verbatim + the founder check.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attribute_referral(
  _referred_user uuid, _code_value text, _source public.attribution_source
) RETURNS public.referral_attributions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.codes;
  a public.referral_attributions;
  r_type public.referrer_type;
  r_founder uuid;
  r_user uuid;
BEGIN
  -- Direct-only: if attribution exists, return it unchanged (first-valid wins)
  SELECT * INTO a FROM public.referral_attributions WHERE referred_user_id = _referred_user;
  IF FOUND THEN RETURN a; END IF;

  c := public.resolve_code(_code_value);
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF c.kind = 'founder' THEN
    r_type := 'founder';
    r_founder := c.owner_founder_id;
    r_user := NULL;
    -- A founder redeeming their own code would earn commission on their own
    -- subscription. The user-code branch always had this guard; founder codes
    -- resolve through founders.user_id, so check it here.
    IF EXISTS (
      SELECT 1 FROM public.founders f
       WHERE f.id = c.owner_founder_id AND f.user_id = _referred_user
    ) THEN
      RAISE EXCEPTION 'self_referral_not_allowed';
    END IF;
  ELSIF c.kind = 'user_referral' THEN
    r_type := 'user';
    r_founder := NULL;
    r_user := c.owner_user_id;
    IF r_user = _referred_user THEN RAISE EXCEPTION 'self_referral_not_allowed'; END IF;
  ELSE
    RAISE EXCEPTION 'code_kind_not_attributable';
  END IF;

  INSERT INTO public.referral_attributions(
    referred_user_id, referrer_type, referrer_founder_id, referrer_user_id, source, code_id
  ) VALUES (
    _referred_user, r_type, r_founder, r_user, _source, c.id
  ) RETURNING * INTO a;

  PERFORM public.write_audit(_referred_user, 'attribute_referral', 'referral_attribution', a.id,
    NULL, to_jsonb(a), NULL);
  RETURN a;
END;
$$;

-- Belt + suspenders: any founder-self reward insert (e.g. from an attribution
-- created before this migration) is suppressed and audited, never minted.
-- Suppressing (RETURN NULL) instead of raising keeps record_invoice_paid's
-- contract (reward_id may be NULL) and never turns a Stripe webhook into a
-- retry loop.
CREATE OR REPLACE FUNCTION public.reward_events_block_founder_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referrer_founder_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.founders f
     WHERE f.id = NEW.referrer_founder_id AND f.user_id = NEW.referred_user_id
  ) THEN
    PERFORM public.write_audit(NEW.referred_user_id, 'reward_skipped', 'reward_event', NULL, NULL,
      jsonb_build_object(
        'reason', 'founder_self_referral',
        'invoice', NEW.invoice_external_id,
        'founder_id', NEW.referrer_founder_id
      ), NULL);
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reward_events_block_founder_self ON public.reward_events;
CREATE TRIGGER trg_reward_events_block_founder_self
BEFORE INSERT ON public.reward_events
FOR EACH ROW EXECUTE FUNCTION public.reward_events_block_founder_self();

-- ------------------------------------------------------------
-- 4) mature_holds — past_due neither promotes nor reverses.
--    Body is 20260604072016 verbatim except the past_due branch.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mature_holds()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_status text;
  v_promoted int := 0;
  v_reversed int := 0;
BEGIN
  FOR r IN
    SELECT re.id, re.subscription_id, re.invoice_external_id, re.referred_user_id
      FROM public.reward_events re
     WHERE re.status = 'pending' AND re.hold_until <= now()
  LOOP
    -- subscription still on a paying-or-grace status?
    SELECT status INTO v_status
      FROM public.subscriptions
     WHERE id = r.subscription_id;

    IF v_status IS NULL OR v_status NOT IN ('active','trialing','past_due') THEN
      UPDATE public.reward_events
         SET status = 'reversed'::reward_status,
             reversed_at = now(),
             reversed_reason = 'churned_before_maturity'
       WHERE id = r.id;
      v_reversed := v_reversed + 1;
      PERFORM public.write_audit(r.referred_user_id, 'reward_reversed', 'reward_event', r.id, NULL,
        jsonb_build_object('reason','churned_before_maturity','sub_status',v_status), NULL);
      CONTINUE;
    END IF;

    -- Dunning in progress: don't pay a month the customer may never cover,
    -- and don't punish a card that's about to recover. Stay pending; the next
    -- worker run re-checks after Stripe either recovers or cancels.
    IF v_status = 'past_due' THEN
      CONTINUE;
    END IF;

    -- invoice refunded/disputed since? billing_events.kind enum covers these
    IF EXISTS (
      SELECT 1 FROM public.billing_events be
       WHERE be.invoice_external_id = r.invoice_external_id
         AND be.kind::text IN ('invoice_refunded','charge_refunded','charge_dispute_created','invoice_voided')
    ) THEN
      UPDATE public.reward_events
         SET status = 'reversed'::reward_status,
             reversed_at = now(),
             reversed_reason = 'invoice_refunded'
       WHERE id = r.id;
      v_reversed := v_reversed + 1;
      PERFORM public.write_audit(r.referred_user_id, 'reward_reversed', 'reward_event', r.id, NULL,
        jsonb_build_object('reason','invoice_refunded'), NULL);
      CONTINUE;
    END IF;

    UPDATE public.reward_events
       SET status = 'payable'::reward_status
     WHERE id = r.id;
    v_promoted := v_promoted + 1;
  END LOOP;

  -- legacy credit ledger maturation
  UPDATE public.credit_ledger
     SET status = 'available'
   WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= now();

  RETURN v_promoted;
END;
$$;

-- ------------------------------------------------------------
-- 5) Refund-after-paid clawback — compensating negative entries.
--    The amount CHECK must first admit clawback rows (and only those).
-- ------------------------------------------------------------
ALTER TABLE public.reward_events
  DROP CONSTRAINT IF EXISTS reward_events_amount_positive;
ALTER TABLE public.reward_events
  ADD CONSTRAINT reward_events_amount_positive
  CHECK (
    amount_cents > 0
    OR (amount_cents < 0 AND idempotency_key LIKE 'clawback:%')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.reverse_reward_for_invoice(_invoice text, _reason text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n int := 0;
  c int := 0;
  r record;
  claw_id uuid;
BEGIN
  -- Unpaid rewards reverse in place (append-only status flip, existing path).
  UPDATE public.reward_events
     SET status = 'reversed'::reward_status,
         reversed_at = now(),
         reversed_reason = _reason
   WHERE invoice_external_id = _invoice
     AND status IN ('pending','payable');
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Already-paid rewards can't be un-paid: the money left. Post a compensating
  -- NEGATIVE payable entry that nets against the referrer's next batch. The
  -- paid row is never edited except to link its clawback (reversed_by_event_id
  -- doubles as the idempotency latch alongside the unique clawback key).
  FOR r IN
    SELECT * FROM public.reward_events
     WHERE invoice_external_id = _invoice
       AND status = 'paid'
       AND reward_kind = 'cash'
       AND amount_cents > 0
       AND reversed_by_event_id IS NULL
  LOOP
    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_founder_id, referrer_user_id,
      subscription_id, invoice_external_id, amount_cents, reward_kind,
      hold_until, status, paid_month_index, idempotency_key
    ) VALUES (
      r.referred_user_id, r.referrer_type, r.referrer_founder_id, r.referrer_user_id,
      r.subscription_id, r.invoice_external_id, -r.amount_cents, 'cash',
      now(), 'payable', NULL, 'clawback:' || r.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO claw_id;

    IF claw_id IS NOT NULL THEN
      UPDATE public.reward_events
         SET reversed_by_event_id = claw_id,
             reversed_reason = _reason,
             reversed_at = now()
       WHERE id = r.id;
      c := c + 1;
      PERFORM public.write_audit(NULL, 'reward_clawback', 'reward_event', claw_id, NULL,
        jsonb_build_object('original', r.id, 'invoice', _invoice,
                           'amount_cents', -r.amount_cents, 'reason', _reason), NULL);
    END IF;
  END LOOP;

  PERFORM public.write_audit(NULL, 'reward_reversed', 'invoice', NULL, NULL,
    jsonb_build_object('invoice', _invoice, 'reason', _reason,
                       'count', n, 'clawbacks', c), NULL);

  RETURN n + c;
END;
$$;

-- ------------------------------------------------------------
-- 6) Batch builders — never create a zero or NEGATIVE payout.
--    Bodies verbatim except `total = 0` → `total <= 0`. When net-negative,
--    rows stay unstamped and roll forward until earnings outweigh clawbacks.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payout_batch(
  _founder uuid, _period_start timestamptz, _period_end timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total int;
  p_id uuid;
BEGIN
  SELECT COALESCE(SUM(amount_cents),0) INTO total
    FROM public.reward_events
    WHERE referrer_founder_id = _founder
      AND status = 'payable'
      AND payout_id IS NULL
      AND reward_kind = 'cash'
      AND created_at >= _period_start
      AND created_at <  _period_end;

  IF total <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.payouts(founder_id, period_start, period_end, amount_cents, status)
  VALUES (_founder, _period_start, _period_end, total, 'draft')
  RETURNING id INTO p_id;

  UPDATE public.reward_events
    SET payout_id = p_id
    WHERE referrer_founder_id = _founder
      AND status = 'payable'
      AND payout_id IS NULL
      AND reward_kind = 'cash'
      AND created_at >= _period_start
      AND created_at <  _period_end;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_payout_batch(
  _user uuid, _period_start timestamptz, _period_end timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total int;
  p_id uuid;
BEGIN
  SELECT COALESCE(SUM(amount_cents),0) INTO total
    FROM public.reward_events
   WHERE referrer_user_id = _user
     AND status = 'payable'
     AND payout_id IS NULL
     AND reward_kind = 'cash'
     AND created_at >= _period_start
     AND created_at <  _period_end;

  IF total <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.payouts(user_id, period_start, period_end, amount_cents, status)
  VALUES (_user, _period_start, _period_end, total, 'draft')
  RETURNING id INTO p_id;

  UPDATE public.reward_events
     SET payout_id = p_id
   WHERE referrer_user_id = _user
     AND status = 'payable'
     AND payout_id IS NULL
     AND reward_kind = 'cash'
     AND created_at >= _period_start
     AND created_at <  _period_end;

  RETURN p_id;
END;
$$;
