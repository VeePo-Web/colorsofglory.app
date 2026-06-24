-- ============================================================
-- Instant referral acknowledgment (referral-UX audit P0 #5).
-- A 'last seen' marker so me-referrals can report what's new since the referrer
-- last looked → the UI shows a "N new referrals" badge, making the reward feel
-- immediate even though cash matures on the clawback schedule. No change to the
-- minting path (record_invoice_paid) — purely additive.
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referrals_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_referrals_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); t timestamptz := now();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.profiles SET referrals_seen_at = t WHERE user_id = uid;
  RETURN t;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_referrals_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_referrals_seen() TO authenticated;
