-- ============================================================
-- admin_attribution_for_user(_user) — read the current referral attribution for
-- a referred user so an admin can SEE what they're changing before overriding
-- (override itself goes through admin-attribution-override -> admin_override_attribution).
-- A mis-attributed referral pays the wrong person — never override blind.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_attribution_for_user(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a  public.referral_attributions;
  nm text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO a FROM public.referral_attributions WHERE referred_user_id = _user;
  IF a.referred_user_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  IF a.referrer_type = 'founder' THEN
    SELECT display_name INTO nm FROM public.founders WHERE id = a.referrer_founder_id;
  ELSE
    SELECT display_name INTO nm FROM public.profiles WHERE user_id = a.referrer_user_id;
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'referrer_type', a.referrer_type,
    'referrer_user_id', a.referrer_user_id,
    'referrer_founder_id', a.referrer_founder_id,
    'source', a.source,
    'locked', a.locked,
    'referrer_name', nm
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_attribution_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_attribution_for_user(uuid) TO authenticated;
