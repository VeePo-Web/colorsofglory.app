-- ============================================================
-- claim_referral_code(_code) — let a user claim a memorable/vanity referral code
-- (referral-UX audit P0 #3: random codes -> shareable, personalized codes).
--
-- Updating profiles.referral_code is sufficient: trg_profile_sync_referral_code
-- (see 20260604070136) deactivates the old codes row and upserts the new active
-- one, so the /r/:code resolver (which reads public.codes) stays in sync.
-- We pre-check uniqueness across codes.value (citext), founders.slug, and other
-- profiles to avoid namespace collisions / row desync before the update.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_referral_code(_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v   text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  v := upper(btrim(_code));
  IF v !~ '^[A-Z0-9]{3,20}$' THEN RAISE EXCEPTION 'invalid_code'; END IF;

  -- Collision checks (case-insensitive). Founder code rows have owner_user_id
  -- NULL, so `IS DISTINCT FROM uid` correctly treats them as taken too.
  IF EXISTS (SELECT 1 FROM public.codes WHERE value = v::citext AND owner_user_id IS DISTINCT FROM uid) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.founders WHERE lower(slug) = lower(v)) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v AND user_id <> uid) THEN
    RAISE EXCEPTION 'code_taken';
  END IF;

  UPDATE public.profiles SET referral_code = v WHERE user_id = uid;

  PERFORM public.write_audit(uid, 'referral_code_claimed', 'profile', uid,
    NULL, jsonb_build_object('code', v), NULL);
  RETURN v;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'code_taken';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_referral_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;
