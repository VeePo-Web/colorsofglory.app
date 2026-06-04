
-- ============================================================
-- Reversal columns + audit reason tracking on reward_events
-- ============================================================
ALTER TABLE public.reward_events
  ADD COLUMN IF NOT EXISTS reversed_reason text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz;

-- ============================================================
-- Hard CHECK: never reward yourself
-- ============================================================
ALTER TABLE public.reward_events
  DROP CONSTRAINT IF EXISTS reward_events_no_self_referral;
ALTER TABLE public.reward_events
  ADD CONSTRAINT reward_events_no_self_referral
  CHECK (referrer_user_id IS NULL OR referrer_user_id <> referred_user_id);

-- ============================================================
-- Unique guard: one cash reward per (referrer_user, referred_user, paid_month_index)
-- Only applies to active statuses so reversed rows free the slot.
-- For user-referrals we now also stamp paid_month_index in record_invoice_paid.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_referral_month
  ON public.reward_events (referrer_user_id, referred_user_id, paid_month_index)
  WHERE referrer_user_id IS NOT NULL
    AND status IN ('pending','payable','paid');

-- ============================================================
-- reverse_reward_for_invoice(invoice, reason): mark rewards reversed for refunds/disputes
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_reward_for_invoice(_invoice text, _reason text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int := 0;
BEGIN
  UPDATE public.reward_events
     SET status = 'reversed'::reward_status,
         reversed_at = now(),
         reversed_reason = _reason
   WHERE invoice_external_id = _invoice
     AND status IN ('pending','payable');
  GET DIAGNOSTICS n = ROW_COUNT;

  PERFORM public.write_audit(NULL, 'reward_reversed', 'invoice', NULL, NULL,
    jsonb_build_object('invoice', _invoice, 'reason', _reason, 'count', n), NULL);

  RETURN n;
END;
$$;

-- ============================================================
-- mature_holds() — re-verify subscription + invoice before promoting to payable
-- ============================================================
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

-- ============================================================
-- record_invoice_paid — add fraud_flag gate + always stamp paid_month_index
-- (for user referrals, so the unique month index works)
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_invoice_paid(_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := (_event->>'user_id')::uuid;
  v_invoice text := _event->>'invoice_external_id';
  v_amount int := COALESCE((_event->>'amount_cents')::int, 0);
  v_sub_id uuid := NULLIF(_event->>'subscription_id','')::uuid;
  v_plan public.sub_plan;
  v_status text;
  v_sub_user uuid;
  attr public.referral_attributions;
  reward_cents int;
  hold_days int;
  idem text;
  reward_id uuid;
  month_idx int;
  first6_cents int;
  ongoing_cents int;
  first6_months int;
  profile jsonb;
  v_skip text;
  v_referrer uuid;
BEGIN
  IF v_user IS NULL OR v_invoice IS NULL THEN RAISE EXCEPTION 'missing_required_fields'; END IF;

  v_skip := NULL;

  IF v_sub_id IS NULL THEN v_skip := 'no_subscription';
  ELSIF v_amount <= 0 THEN v_skip := 'zero_amount';
  ELSE
    SELECT plan, status, user_id INTO v_plan, v_status, v_sub_user
      FROM public.subscriptions WHERE id = v_sub_id;
    IF v_plan IS NULL THEN v_skip := 'subscription_not_found';
    ELSIF v_plan NOT IN ('pro','founder_pro') THEN v_skip := 'plan_not_eligible';
    ELSIF v_status NOT IN ('active','trialing','past_due') THEN v_skip := 'status_not_eligible';
    ELSIF v_sub_user IS DISTINCT FROM v_user THEN v_skip := 'user_mismatch';
    END IF;
  END IF;

  IF v_skip IS NULL THEN
    SELECT * INTO attr FROM public.referral_attributions WHERE referred_user_id = v_user;
    IF NOT FOUND THEN v_skip := 'no_attribution'; END IF;
  END IF;

  IF v_skip IS NULL AND attr.referrer_type = 'user' AND attr.referrer_user_id = v_user THEN
    v_skip := 'self_referral';
  END IF;

  -- Fraud guard: open flag on either party blocks reward minting
  IF v_skip IS NULL THEN
    v_referrer := CASE attr.referrer_type
      WHEN 'user' THEN attr.referrer_user_id
      WHEN 'founder' THEN attr.referrer_founder_id
    END;
    IF EXISTS (
      SELECT 1 FROM public.fraud_flags
       WHERE resolved_at IS NULL
         AND ((subject_type = 'user' AND subject_id = v_user)
              OR (subject_type IN ('user','founder') AND subject_id = v_referrer))
    ) THEN
      v_skip := 'fraud_hold';
    END IF;
  END IF;

  IF v_skip IS NOT NULL THEN
    PERFORM public.write_audit(v_user, 'reward_skipped', 'invoice', NULL,
      NULL,
      jsonb_build_object('reason', v_skip, 'invoice', v_invoice,
        'amount_cents', v_amount, 'subscription_id', v_sub_id,
        'plan', v_plan, 'status', v_status),
      NULL);
    RETURN NULL;
  END IF;

  hold_days := public.reward_hold_days();

  IF attr.referrer_type = 'founder' THEN
    SELECT reward_profile INTO profile FROM public.founders WHERE id = attr.referrer_founder_id;
    first6_cents := COALESCE((profile->>'first6_cents')::int, 2500);
    ongoing_cents := COALESCE((profile->>'ongoing_cents')::int, 1000);
    first6_months := COALESCE((profile->>'first6_months')::int, 3);
    month_idx := public.next_paid_month_index(v_user, attr.referrer_founder_id);
    reward_cents := CASE WHEN month_idx <= first6_months THEN first6_cents ELSE ongoing_cents END;
    idem := 'reward:founder:' || attr.referrer_founder_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_founder_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      paid_month_index, idempotency_key
    ) VALUES (
      v_user, 'founder', attr.referrer_founder_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      month_idx, idem
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;

  ELSIF attr.referrer_type = 'user' THEN
    SELECT COALESCE((value::text)::int, 500) INTO reward_cents
      FROM public.app_settings WHERE key = 'user_referral_cash_cents';
    -- Count active (pending/payable/paid) rewards this referrer already earned for this referred user
    SELECT COUNT(*) + 1 INTO month_idx
      FROM public.reward_events
     WHERE referrer_user_id = attr.referrer_user_id
       AND referred_user_id = v_user
       AND status IN ('pending','payable','paid');
    idem := 'reward:user:' || attr.referrer_user_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_user_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      paid_month_index, idempotency_key
    ) VALUES (
      v_user, 'user', attr.referrer_user_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      month_idx, idem
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO reward_id;
  END IF;

  RETURN reward_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_reward_for_invoice(text, text) TO service_role;
