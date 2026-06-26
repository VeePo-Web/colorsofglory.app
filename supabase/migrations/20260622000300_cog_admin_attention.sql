-- ============================================================
-- admin_attention_summary() — the admin Home "needs attention" cockpit.
-- One call → the things that require human intervention right now:
--   open fraud flags · referrers owed but unpayable (no payout method) ·
--   stuck webhook events · draft payouts awaiting approval · total payable.
-- admin-gated + SECURITY DEFINER. Read-only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_attention_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked_count int;
  v_blocked_cents bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Referrers (founder or user) with payable money but NO payout method on file.
  WITH owed AS (
    SELECT f.user_id AS recip, COALESCE(SUM(re.amount_cents), 0) AS c
      FROM public.founders f
      JOIN public.reward_events re ON re.referrer_founder_id = f.id AND re.status = 'payable'
      GROUP BY f.user_id
    UNION ALL
    SELECT re.referrer_user_id, COALESCE(SUM(re.amount_cents), 0)
      FROM public.reward_events re
      WHERE re.status = 'payable' AND re.referrer_user_id IS NOT NULL
      GROUP BY re.referrer_user_id
  )
  SELECT count(*), COALESCE(SUM(o.c), 0)
    INTO v_blocked_count, v_blocked_cents
    FROM owed o
    LEFT JOIN public.profiles p ON p.user_id = o.recip
   WHERE o.c > 0 AND p.payout_method IS NULL;

  RETURN jsonb_build_object(
    'open_fraud_flags',     (SELECT count(*) FROM public.fraud_flags WHERE resolved_at IS NULL),
    'stuck_webhooks',       (SELECT count(*) FROM public.billing_events WHERE processed_at IS NULL OR processing_error IS NOT NULL),
    'draft_payouts_count',  (SELECT count(*) FROM public.payouts WHERE status = 'draft'),
    'draft_payouts_cents',  COALESCE((SELECT SUM(amount_cents) FROM public.payouts WHERE status = 'draft'), 0),
    'reward_payable_cents', COALESCE((SELECT SUM(amount_cents) FROM public.reward_events WHERE status = 'payable'), 0),
    'blocked_payout_count', v_blocked_count,
    'blocked_payout_cents', v_blocked_cents
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_attention_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_attention_summary() TO authenticated;
