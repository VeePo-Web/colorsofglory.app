
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_code text;

CREATE OR REPLACE FUNCTION public.increment_founder_code_redemption(_code_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.codes
  SET redemption_count = COALESCE(redemption_count, 0) + 1,
      updated_at = now()
  WHERE id = _code_id;
$$;

CREATE OR REPLACE FUNCTION public.stash_pending_code(_user_id uuid, _code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET pending_code = upper(trim(_code)),
      updated_at = now()
  WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.clear_pending_code(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET pending_code = NULL,
      updated_at = now()
  WHERE user_id = _user_id;
$$;

REVOKE ALL ON FUNCTION public.increment_founder_code_redemption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_founder_code_redemption(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.stash_pending_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stash_pending_code(uuid, text) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.clear_pending_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_pending_code(uuid) TO service_role, authenticated;
