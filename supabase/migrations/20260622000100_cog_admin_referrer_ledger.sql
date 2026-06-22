-- ============================================================
-- (1) FIX: approve_payout method gate read payout_method as jsonb (->>'method'),
--     but profiles.payout_method is a payout_method_kind ENUM. That would throw
--     at runtime. Correct it to a NULL check on the enum.
-- (2) NEW: admin_referrer_ledger() — per-referrer payments tracker so the admin
--     sees who referred whom, what's owed, and WHO IS BLOCKED FROM BEING PAID
--     (earned money but no payout method on file).
-- Both admin-gated + SECURITY DEFINER.
-- ============================================================

-- (1) ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payout(_payout uuid)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p           public.payouts;
  v_recipient uuid;
  v_method    public.payout_method_kind;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO p FROM public.payouts WHERE id = _payout;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF p.status <> 'draft' THEN RAISE EXCEPTION 'payout_not_draft'; END IF;

  IF p.founder_id IS NOT NULL THEN
    SELECT user_id INTO v_recipient FROM public.founders WHERE id = p.founder_id;
  ELSE
    v_recipient := p.user_id;
  END IF;

  -- KYC/method gate: payout_method is an enum (manual|paypal|stripe_connect).
  SELECT payout_method INTO v_method FROM public.profiles WHERE user_id = v_recipient;
  IF v_method IS NULL THEN RAISE EXCEPTION 'no_payout_method'; END IF;

  UPDATE public.payouts
     SET status = 'approved', approved_at = now(), approved_by_user_id = auth.uid(), updated_at = now()
   WHERE id = _payout AND status = 'draft'
   RETURNING * INTO p;

  PERFORM public.write_audit(auth.uid(), 'approve_payout', 'payout', p.id, NULL, to_jsonb(p), NULL);
  RETURN p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payout(uuid) TO authenticated;

-- (2) ----------------------------------------------------------------------
-- One row per referrer (founders + user-referrers) with referral + earnings +
-- payout-method status. `payout_method IS NULL` while payable_cents > 0 means
-- "owed but cannot be paid yet".
CREATE OR REPLACE FUNCTION public.admin_referrer_ledger()
RETURNS TABLE (
  referrer_type     text,
  referrer_id       uuid,
  recipient_user_id uuid,
  name              text,
  referral_code     text,
  attributed_count  int,
  paying_count      int,
  pending_cents     bigint,
  payable_cents     bigint,
  paid_cents        bigint,
  payout_method     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  -- Founders
  SELECT
    'founder'::text,
    f.id,
    f.user_id,
    f.display_name,
    NULL::text,
    (SELECT count(*)::int FROM referral_attributions ra WHERE ra.referrer_founder_id = f.id),
    (SELECT count(DISTINCT re.referred_user_id)::int FROM reward_events re WHERE re.referrer_founder_id = f.id),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_founder_id = f.id AND status = 'pending'), 0),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_founder_id = f.id AND status = 'payable'), 0),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_founder_id = f.id AND status = 'paid'), 0),
    (SELECT pr.payout_method::text FROM profiles pr WHERE pr.user_id = f.user_id)
  FROM founders f
  UNION ALL
  -- User referrers (anyone who has referred at least one paying user)
  SELECT
    'user'::text,
    u.uid,
    u.uid,
    pr.display_name,
    pr.referral_code,
    (SELECT count(*)::int FROM referral_attributions ra WHERE ra.referrer_user_id = u.uid),
    (SELECT count(DISTINCT re.referred_user_id)::int FROM reward_events re WHERE re.referrer_user_id = u.uid),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_user_id = u.uid AND status = 'pending'), 0),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_user_id = u.uid AND status = 'payable'), 0),
    COALESCE((SELECT sum(amount_cents) FROM reward_events WHERE referrer_user_id = u.uid AND status = 'paid'), 0),
    pr.payout_method::text
  FROM (SELECT DISTINCT referrer_user_id AS uid FROM reward_events WHERE referrer_user_id IS NOT NULL) u
  LEFT JOIN profiles pr ON pr.user_id = u.uid
  ORDER BY 9 DESC, 8 DESC;  -- most payable, then most pending, first
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_referrer_ledger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referrer_ledger() TO authenticated;
