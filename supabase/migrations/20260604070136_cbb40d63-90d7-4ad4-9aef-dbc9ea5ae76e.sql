
-- =========================================================================
-- 1a. New setting: $5/mo cash for user referrals
-- =========================================================================
INSERT INTO public.app_settings(key, value) VALUES ('user_referral_cash_cents', to_jsonb(500))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- =========================================================================
-- 1b. Every profile gets a matching codes row (kind='user_referral')
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    RETURN NEW;
  END IF;

  -- On code change, deactivate the old code row
  IF TG_OP = 'UPDATE'
     AND OLD.referral_code IS NOT NULL
     AND OLD.referral_code <> NEW.referral_code THEN
    UPDATE public.codes
       SET status = 'disabled', updated_at = now()
     WHERE owner_user_id = NEW.user_id
       AND kind = 'user_referral'
       AND value = OLD.referral_code::citext;
  END IF;

  -- Upsert active code row for the current referral_code
  INSERT INTO public.codes(value, kind, owner_user_id, status, created_by_user_id)
  VALUES (NEW.referral_code::citext, 'user_referral', NEW.user_id, 'active', NEW.user_id)
  ON CONFLICT (value) DO UPDATE
    SET status = 'active',
        owner_user_id = EXCLUDED.owner_user_id,
        kind = 'user_referral',
        updated_at = now()
    WHERE public.codes.owner_user_id = EXCLUDED.owner_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_sync_referral_code ON public.profiles;
CREATE TRIGGER trg_profile_sync_referral_code
  AFTER INSERT OR UPDATE OF referral_code ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_referral_code();

-- Backfill: create codes for existing profiles that lack one
INSERT INTO public.codes(value, kind, owner_user_id, status, created_by_user_id)
SELECT p.referral_code::citext, 'user_referral', p.user_id, 'active', p.user_id
FROM public.profiles p
WHERE p.referral_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.codes c
    WHERE c.owner_user_id = p.user_id
      AND c.kind = 'user_referral'
      AND c.value = p.referral_code::citext
  )
ON CONFLICT (value) DO NOTHING;

-- =========================================================================
-- 1c. Payouts can belong to a founder OR a user
-- =========================================================================
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.payouts ALTER COLUMN founder_id DROP NOT NULL;

-- Drop old constraint if it exists, then add one-owner check
ALTER TABLE public.payouts DROP CONSTRAINT IF EXISTS payouts_one_owner;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_one_owner
  CHECK ((founder_id IS NOT NULL)::int + (user_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_payouts_user ON public.payouts(user_id);

-- New RLS policy: user can view their own payouts
DROP POLICY IF EXISTS "Referrer user views own payouts" ON public.payouts;
CREATE POLICY "Referrer user views own payouts"
  ON public.payouts FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Function to draft a monthly payout for a user referrer
CREATE OR REPLACE FUNCTION public.create_user_payout_batch(_user uuid, _period_start timestamptz, _period_end timestamptz)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF total = 0 THEN RETURN NULL; END IF;

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

-- =========================================================================
-- 1d. record_invoice_paid — user branch now writes CASH (was service_credit)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.record_invoice_paid(_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := (_event->>'user_id')::uuid;
  v_invoice text := _event->>'invoice_external_id';
  v_amount int := COALESCE((_event->>'amount_cents')::int, 0);
  v_sub_id uuid := NULLIF(_event->>'subscription_id','')::uuid;
  v_plan public.sub_plan;
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
BEGIN
  IF v_user IS NULL OR v_invoice IS NULL THEN RAISE EXCEPTION 'missing_required_fields'; END IF;

  IF v_sub_id IS NOT NULL THEN
    SELECT plan INTO v_plan FROM public.subscriptions WHERE id = v_sub_id;
    IF v_plan IS NULL OR v_plan NOT IN ('pro','founder_pro') THEN RETURN NULL; END IF;
  END IF;

  SELECT * INTO attr FROM public.referral_attributions WHERE referred_user_id = v_user;
  IF NOT FOUND THEN RETURN NULL; END IF;

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
    -- Guard against self-referral that slipped past attribute_referral
    IF attr.referrer_user_id = v_user THEN RETURN NULL; END IF;

    SELECT COALESCE((value::text)::int, 500) INTO reward_cents
      FROM public.app_settings WHERE key = 'user_referral_cash_cents';
    idem := 'reward:user:' || attr.referrer_user_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_user_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      idempotency_key
    ) VALUES (
      v_user, 'user', attr.referrer_user_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      idem
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;
  END IF;

  RETURN reward_id;
END;
$$;

-- =========================================================================
-- 1f. Payout method on profiles
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.payout_method_kind AS ENUM ('manual','paypal','stripe_connect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payout_method public.payout_method_kind,
  ADD COLUMN IF NOT EXISTS payout_email text,
  ADD COLUMN IF NOT EXISTS payout_country text,
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;

-- =========================================================================
-- 4d. Onboarding: new step 'referral_program_seen'
-- =========================================================================
ALTER TYPE public.onboarding_step ADD VALUE IF NOT EXISTS 'referral_program_seen' BEFORE 'founder_code_seen';
