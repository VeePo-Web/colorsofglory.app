CREATE OR REPLACE FUNCTION public.admin_finance_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'mrr_cents', COALESCE((
      SELECT SUM(unit_amount_cents) FROM subscriptions
       WHERE status IN ('active','trialing','past_due') AND plan <> 'free'), 0),
    'active_subs', COALESCE((
      SELECT count(*) FROM subscriptions
       WHERE status IN ('active','trialing','past_due') AND plan <> 'free'), 0),
    'mrr_by_plan', COALESCE((
      SELECT jsonb_object_agg(plan, s) FROM (
        SELECT plan::text AS plan, SUM(unit_amount_cents) AS s FROM subscriptions
         WHERE status IN ('active','trialing','past_due') AND plan <> 'free'
         GROUP BY plan) q), '{}'::jsonb),
    'subs_by_plan', COALESCE((
      SELECT jsonb_object_agg(plan, c) FROM (
        SELECT plan::text AS plan, count(*) AS c FROM subscriptions
         WHERE status IN ('active','trialing','past_due') AND plan <> 'free'
         GROUP BY plan) q), '{}'::jsonb),
    'new_subs_30d', COALESCE((
      SELECT count(*) FROM subscriptions
       WHERE plan <> 'free' AND created_at > now() - interval '30 days'), 0),
    'churned_30d', COALESCE((
      SELECT count(*) FROM subscriptions
       WHERE cancelled_at IS NOT NULL AND cancelled_at > now() - interval '30 days'), 0),
    'reward_liability_cents', COALESCE((
      SELECT SUM(amount_cents) FROM reward_events WHERE status IN ('pending','payable')), 0),
    'reward_pending_cents', COALESCE((
      SELECT SUM(amount_cents) FROM reward_events WHERE status = 'pending'), 0),
    'reward_payable_cents', COALESCE((
      SELECT SUM(amount_cents) FROM reward_events WHERE status = 'payable'), 0),
    'payouts_outstanding_cents', COALESCE((
      SELECT SUM(amount_cents) FROM payouts WHERE status IN ('draft','approved')), 0),
    'payouts_paid_lifetime_cents', COALESCE((
      SELECT SUM(amount_cents) FROM payouts WHERE status = 'paid'), 0),
    'payouts_paid_30d_cents', COALESCE((
      SELECT SUM(amount_cents) FROM payouts
       WHERE status = 'paid' AND paid_at > now() - interval '30 days'), 0),
    'refunds_30d_cents', COALESCE((
      SELECT SUM(amount_cents) FROM billing_events
       WHERE kind::text IN ('invoice_refunded','charge_refunded')
         AND created_at > now() - interval '30 days'), 0),
    'chargebacks_30d_cents', COALESCE((
      SELECT SUM(amount_cents) FROM billing_events
       WHERE kind::text IN ('chargeback_created','charge_dispute_created')
         AND created_at > now() - interval '30 days'), 0)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_finance_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finance_summary() TO authenticated;