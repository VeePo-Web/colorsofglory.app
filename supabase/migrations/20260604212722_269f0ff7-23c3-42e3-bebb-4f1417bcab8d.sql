
CREATE OR REPLACE FUNCTION public.claim_founder_code_redemption(_code_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  UPDATE public.codes
  SET redemption_count = redemption_count + 1
  WHERE id = _code_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
  RETURNING true INTO _ok;
  RETURN COALESCE(_ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.release_founder_code_redemption(_code_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.codes
  SET redemption_count = GREATEST(redemption_count - 1, 0)
  WHERE id = _code_id;
$$;

REVOKE ALL ON FUNCTION public.claim_founder_code_redemption(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_founder_code_redemption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_founder_code_redemption(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_founder_code_redemption(uuid) TO service_role;
