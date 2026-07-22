-- ============================================================
-- Referral rates: the decided economics, locked at attribution
-- Follow-up to 20260722224500 (the hardening pass). Additive, forward-only.
--
-- THE DECIDED ECONOMICS (verified against the live system first):
--   * Plans: free / Starter $5 / Pro $100 -- plan_tiers already seeds exactly
--     this, and Starter has allows_founder_code = allows_member_referral =
--     false, so codes can't even be APPLIED to a $5 checkout. The mint's plan
--     gate (plan NOT IN ('pro','founder_pro')) excludes 'starter' as a third
--     layer: NO commission path exists for the $5 plan.
--   * Regular referrer: $5/mo flat (5% of Pro) per active Pro referral --
--     user_referral_cash_cents = 500 was already seeded. NEW: the regular
--     referrer must themselves be an active PAID member to accrue; months
--     while they're unpaid simply don't mint (commissions pause, auditable,
--     and resume automatically when they pay again).
--   * Founder: pct of the ACTUAL invoice amount (default 30%, configurable
--     globally and per-founder). The founder code (e.g. CRAIG50, which is
--     literally the admin default: SLUG + '50') routes checkout to the $50
--     referral price -- so commission on a founder-code sub is 30% x $50 =
--     $15/mo, NEVER 30% x $100 = $30. Computing from the real invoice means
--     discounts, prorations, and price changes are respected automatically.
--   * RATE LOCK: the deal is snapshotted onto the attribution row the moment
--     it is created (locked_reward), via a BEFORE INSERT trigger -- one choke
--     point that covers the attribute_referral RPC, the webhook's metadata
--     insert, and any future path. Later settings/profile changes never
--     rewrite existing referrals.
--
-- Also in this migration:
--   * reward_events gains invoice_amount_cents + applied_rate so every single
--     reward row shows the actual price, the locked rate, and the math --
--     per-user and per-founder tracking is exact by construction.
--   * A rounds-to-zero guard: a tiny proration x 30% can round to 0 cents,
--     which would violate the amount CHECK and turn a Stripe webhook into a
--     retry loop. Zero-value rewards are skipped + audited instead.
-- ============================================================

-- ------------------------------------------------------------
-- 0) Config seeds (all Parker-tunable via adminSetAppSetting; every rate
--    is read at attribution time and locked, so tuning never rewrites history)
-- ------------------------------------------------------------
INSERT INTO public.app_settings(key, value, description) VALUES
  ('founder_commission_pct', to_jsonb(30),
   'Founder commission as % of the ACTUAL invoice amount (locked onto each attribution)'),
  ('referrer_requires_active_paid', to_jsonb(true),
   'Regular referrers must be active paid members to accrue commission (pauses while unpaid)'),
  ('founder_discount_months', to_jsonb(0),
   'How long the founder-code 50% price lasts: 0 = permanent. Bounded values need the Stripe schedule work filed with Lovable -- PARKER DECISION'),
  ('founder_code_default_max_redemptions', to_jsonb(100),
   'Default allocation when a founder code is created without an explicit limit (scarcity guard) -- PARKER DECISION')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 1) Tracking columns: every reward row records the actual price and the
--    exact rate that produced its amount.
-- ------------------------------------------------------------
ALTER TABLE public.reward_events
  ADD COLUMN IF NOT EXISTS invoice_amount_cents integer,
  ADD COLUMN IF NOT EXISTS applied_rate jsonb;

-- ------------------------------------------------------------
-- 2) The rate lock: referral_attributions.locked_reward, stamped by a
--    BEFORE INSERT trigger so EVERY insert path locks the deal at
--    attribution time.
--
--    Founder snapshots honor the founder's actual current deal:
--      profile.pct present            -> {kind:'founder_pct', pct}
--      explicit legacy fixed profile  -> {kind:'founder_fixed', first6/ongoing}
--      neither                        -> settings founder_commission_pct
-- ------------------------------------------------------------
ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS locked_reward jsonb;

CREATE OR REPLACE FUNCTION public.referral_attributions_lock_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof jsonb;
  pct numeric;
  cents int;
  req boolean;
BEGIN
  IF NEW.locked_reward IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.referrer_type = 'founder' AND NEW.referrer_founder_id IS NOT NULL THEN
    SELECT reward_profile INTO prof FROM public.founders WHERE id = NEW.referrer_founder_id;
    pct := (prof->>'pct')::numeric;

    IF pct IS NULL AND (prof ? 'first6_cents' OR prof ? 'ongoing_cents') THEN
      -- An explicitly promised fixed deal stays exactly what was promised.
      NEW.locked_reward := jsonb_build_object(
        'kind', 'founder_fixed',
        'first6_cents',  COALESCE((prof->>'first6_cents')::int, 2000),
        'ongoing_cents', COALESCE((prof->>'ongoing_cents')::int, 1000),
        'first6_months', COALESCE((prof->>'first6_months')::int, 6),
        'locked_at', now());
      RETURN NEW;
    END IF;

    IF pct IS NULL THEN
      SELECT (value #>> '{}')::numeric INTO pct
        FROM public.app_settings WHERE key = 'founder_commission_pct';
    END IF;
    pct := LEAST(GREATEST(COALESCE(pct, 30), 0), 100);
    NEW.locked_reward := jsonb_build_object(
      'kind', 'founder_pct', 'pct', pct, 'locked_at', now());

  ELSIF NEW.referrer_type = 'user' THEN
    SELECT (value #>> '{}')::int INTO cents
      FROM public.app_settings WHERE key = 'user_referral_cash_cents';
    SELECT (value #>> '{}')::boolean INTO req
      FROM public.app_settings WHERE key = 'referrer_requires_active_paid';
    NEW.locked_reward := jsonb_build_object(
      'kind', 'user_flat',
      'cents', COALESCE(cents, 500),
      'requires_active_paid', COALESCE(req, true),
      'locked_at', now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_attributions_lock_reward ON public.referral_attributions;
CREATE TRIGGER trg_referral_attributions_lock_reward
BEFORE INSERT ON public.referral_attributions
FOR EACH ROW EXECUTE FUNCTION public.referral_attributions_lock_reward();

-- Pre-existing attributions keep locked_reward NULL on purpose: they never
-- had a lock, so the mint's fallback chain (per-founder profile -> settings)
-- governs them -- stamping history now would itself rewrite the past.

-- ------------------------------------------------------------
-- 3) record_invoice_paid -- pct-of-ACTUAL commission, the regular-referrer
--    eligibility gate, tracking columns, and the rounds-to-zero guard.
--    Body is 20260604072016 verbatim except the marked changes; every
--    existing gate, idempotency key, and audit write is preserved. The
--    founder-self BEFORE INSERT trigger (20260722224500) still applies.
-- ------------------------------------------------------------
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
  v_lock jsonb;
  pct numeric;
  v_applied jsonb;
  req boolean;
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

  -- Skin-in-the-game gate: a REGULAR referrer only accrues while they are
  -- themselves an active paid member. Months while unpaid mint nothing
  -- (audited as reward_skipped) and accrual resumes automatically when they
  -- pay again. Founders are invite-only and exempt.
  IF v_skip IS NULL AND attr.referrer_type = 'user' THEN
    req := COALESCE(
      (attr.locked_reward->>'requires_active_paid')::boolean,
      (SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key = 'referrer_requires_active_paid'),
      true);
    IF req AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.user_id = attr.referrer_user_id
         AND s.status IN ('active','past_due')
         AND s.plan::text <> 'free'
    ) THEN
      v_skip := 'referrer_not_active_paid';
    END IF;
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
    month_idx := public.next_paid_month_index(v_user, attr.referrer_founder_id);
    v_lock := attr.locked_reward;
    pct := NULL;

    IF v_lock->>'kind' = 'founder_pct' THEN
      pct := LEAST(GREATEST(COALESCE((v_lock->>'pct')::numeric, 30), 0), 100);
    ELSIF v_lock->>'kind' = 'founder_fixed' THEN
      first6_cents := COALESCE((v_lock->>'first6_cents')::int, 2000);
      ongoing_cents := COALESCE((v_lock->>'ongoing_cents')::int, 1000);
      first6_months := COALESCE((v_lock->>'first6_months')::int, 6);
    ELSE
      -- Legacy attribution (no lock): honor the founder's current profile --
      -- explicit pct, else an explicitly promised fixed deal, else the
      -- global pct setting.
      pct := (profile->>'pct')::numeric;
      IF pct IS NULL AND (profile ? 'first6_cents' OR profile ? 'ongoing_cents') THEN
        first6_cents := COALESCE((profile->>'first6_cents')::int, 2000);
        ongoing_cents := COALESCE((profile->>'ongoing_cents')::int, 1000);
        first6_months := COALESCE((profile->>'first6_months')::int, 6);
      ELSE
        IF pct IS NULL THEN
          SELECT (value #>> '{}')::numeric INTO pct
            FROM public.app_settings WHERE key = 'founder_commission_pct';
          pct := COALESCE(pct, 30);
        END IF;
        pct := LEAST(GREATEST(pct, 0), 100);
      END IF;
    END IF;

    IF pct IS NOT NULL THEN
      -- THE COMMISSION-ON-ACTUAL-PRICE RULE: pct of what was really invoiced.
      -- A CRAIG50 sub invoices $50 -> 30% = $15. Full-price Pro -> $30.
      reward_cents := round(v_amount * pct / 100.0)::int;
      v_applied := jsonb_build_object('kind','founder_pct','pct',pct);
    ELSE
      reward_cents := CASE WHEN month_idx <= first6_months THEN first6_cents ELSE ongoing_cents END;
      v_applied := jsonb_build_object('kind','founder_fixed',
        'first6_cents',first6_cents,'ongoing_cents',ongoing_cents,
        'first6_months',first6_months,'month_idx',month_idx);
    END IF;

    IF reward_cents < 1 THEN
      PERFORM public.write_audit(v_user, 'reward_skipped', 'invoice', NULL, NULL,
        jsonb_build_object('reason','rounds_to_zero','invoice',v_invoice,
          'amount_cents',v_amount,'applied_rate',v_applied), NULL);
      RETURN NULL;
    END IF;

    idem := 'reward:founder:' || attr.referrer_founder_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_founder_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      paid_month_index, idempotency_key, invoice_amount_cents, applied_rate
    ) VALUES (
      v_user, 'founder', attr.referrer_founder_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      month_idx, idem, v_amount, v_applied
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;

  ELSIF attr.referrer_type = 'user' THEN
    reward_cents := COALESCE(
      (attr.locked_reward->>'cents')::int,
      (SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'user_referral_cash_cents'),
      500);
    v_applied := jsonb_build_object('kind','user_flat','cents',reward_cents);

    IF reward_cents < 1 THEN
      PERFORM public.write_audit(v_user, 'reward_skipped', 'invoice', NULL, NULL,
        jsonb_build_object('reason','rounds_to_zero','invoice',v_invoice,
          'amount_cents',v_amount,'applied_rate',v_applied), NULL);
      RETURN NULL;
    END IF;

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
      paid_month_index, idempotency_key, invoice_amount_cents, applied_rate
    ) VALUES (
      v_user, 'user', attr.referrer_user_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      month_idx, idem, v_amount, v_applied
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO reward_id;
  END IF;

  RETURN reward_id;
END;
$$;
