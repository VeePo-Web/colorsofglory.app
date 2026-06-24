
-- 1) payout_tax_profiles
CREATE TABLE IF NOT EXISTS public.payout_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  legal_name text NOT NULL,
  form_type text NOT NULL CHECK (form_type IN ('W-9','W-8BEN','W-8BEN-E','other')),
  country text NOT NULL,
  tax_id_last4 text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payout_tax_profiles TO authenticated;
GRANT ALL ON public.payout_tax_profiles TO service_role;
ALTER TABLE public.payout_tax_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tax profile"
  ON public.payout_tax_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access tax profile"
  ON public.payout_tax_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.has_tax_profile(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.payout_tax_profiles WHERE user_id = _user);
$$;

GRANT EXECUTE ON FUNCTION public.has_tax_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_payout_tax_profiles_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_tax_profiles_touch ON public.payout_tax_profiles;
CREATE TRIGGER payout_tax_profiles_touch
  BEFORE UPDATE ON public.payout_tax_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_payout_tax_profiles_touch();

-- 2) Self-referral suspicion auto-flag (email match between buyer and referrer)
CREATE OR REPLACE FUNCTION public.tg_reward_events_flag_self_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_email text;
  buyer_email text;
BEGIN
  IF NEW.referrer_user_id IS NULL OR NEW.referred_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Trivial self-referral (same user). Should already be blocked, but
  -- log it loudly if it ever slips through.
  IF NEW.referrer_user_id = NEW.referred_user_id THEN
    INSERT INTO public.fraud_flags(subject_type, subject_id, reason, severity)
    VALUES ('reward_event', NEW.id, 'self_referral_same_user', 'high');
    RETURN NEW;
  END IF;

  SELECT lower(email) INTO ref_email FROM public.profiles WHERE user_id = NEW.referrer_user_id;
  SELECT lower(email) INTO buyer_email FROM public.profiles WHERE user_id = NEW.referred_user_id;

  IF ref_email IS NOT NULL AND buyer_email IS NOT NULL AND ref_email = buyer_email THEN
    INSERT INTO public.fraud_flags(subject_type, subject_id, reason, severity)
    VALUES ('reward_event', NEW.id, 'self_referral_email_match', 'medium');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reward_events_flag_self_referral ON public.reward_events;
CREATE TRIGGER reward_events_flag_self_referral
  AFTER INSERT ON public.reward_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_reward_events_flag_self_referral();
