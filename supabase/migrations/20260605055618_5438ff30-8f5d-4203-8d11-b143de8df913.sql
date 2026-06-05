
-- 1) PROFILES: column-level grants so authenticated users cannot read sensitive fields of others
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, display_name, first_name, last_name,
  avatar_url, avatar_color, referral_code,
  created_at, updated_at, first_song_id,
  onboarding_step, onboarding_updated_at,
  referred_by_user_id
) ON public.profiles TO authenticated;

-- Anon should not select profiles at all
REVOKE SELECT ON public.profiles FROM anon;

-- Self-read for sensitive fields via SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  avatar_color text,
  email text,
  phone_e164 text,
  referral_code text,
  referred_by_user_id uuid,
  onboarding_step onboarding_step,
  onboarding_state jsonb,
  onboarding_updated_at timestamptz,
  first_song_id uuid,
  payout_method payout_method_kind,
  payout_email text,
  payout_country text,
  stripe_connect_account_id text,
  pending_code text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id, p.display_name, p.first_name, p.last_name,
    p.avatar_url, p.avatar_color, p.email, p.phone_e164,
    p.referral_code, p.referred_by_user_id,
    p.onboarding_step, p.onboarding_state, p.onboarding_updated_at,
    p.first_song_id, p.payout_method, p.payout_email,
    p.payout_country, p.stripe_connect_account_id, p.pending_code,
    p.created_at, p.updated_at
  FROM public.profiles p
  WHERE p.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- Phone lookup helper (so invite flow can detect existing accounts without exposing phone_e164)
CREATE OR REPLACE FUNCTION public.check_phone_registered(_phone text)
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.phone_e164 = _phone
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.check_phone_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_phone_registered(text) TO anon, authenticated;

-- 2) SONG_INVITES: hide invited_email / invited_phone from anon previews
REVOKE SELECT ON public.song_invites FROM anon;
GRANT SELECT (
  id, song_id, token, role, status,
  max_uses, use_count, expires_at, message,
  created_by_user_id, created_at, updated_at
) ON public.song_invites TO anon;

-- 3) CODES: hide owner identity fields from anon public-code lookups
REVOKE SELECT ON public.codes FROM anon;
GRANT SELECT (
  id, value, kind, status, discount_cents,
  expires_at, max_redemptions, redemption_count,
  stripe_promotion_code_id, created_at, updated_at
) ON public.codes TO anon;

-- 4) Lock down search_path on the two project functions flagged by the linter
ALTER FUNCTION public.onboarding_legal_next(onboarding_step) SET search_path = public;
ALTER FUNCTION public.onboarding_step_rank(onboarding_step) SET search_path = public;
