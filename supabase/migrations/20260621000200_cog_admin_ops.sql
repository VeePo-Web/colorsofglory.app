-- ============================================================
-- Admin ops: webhook event visibility + payout approval gate + payout retry
-- All admin-gated (has_role) + SECURITY DEFINER. Money mutations stay through
-- guarded transitions + audit rows.
-- ============================================================

-- ---- Webhook ops: list recent billing_events (optionally only failed/stuck) ----
CREATE OR REPLACE FUNCTION public.admin_billing_events(_limit int DEFAULT 50, _only_failed boolean DEFAULT false)
RETURNS SETOF public.billing_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT *
      FROM public.billing_events be
     WHERE (NOT _only_failed)
        OR be.processed_at IS NULL
        OR be.processing_error IS NOT NULL
     ORDER BY be.created_at DESC
     LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_billing_events(int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_events(int, boolean) TO authenticated;

-- ---- Payout console: recent payout batches across all statuses ----
CREATE OR REPLACE FUNCTION public.admin_list_payouts(_limit int DEFAULT 100)
RETURNS SETOF public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT * FROM public.payouts
     ORDER BY created_at DESC
     LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_payouts(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_payouts(int) TO authenticated;

-- ---- Payout approval gate: recipient must have a payout method on file (KYC) ----
-- Replaces the prior approve_payout to add the method gate. Founder payouts
-- resolve the recipient via founders.user_id; user payouts use payouts.user_id.
CREATE OR REPLACE FUNCTION public.approve_payout(_payout uuid)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p           public.payouts;
  v_recipient uuid;
  v_method    jsonb;
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

  -- KYC/method gate: never approve money to a recipient with no payout method.
  SELECT payout_method INTO v_method FROM public.profiles WHERE user_id = v_recipient;
  IF v_method IS NULL OR COALESCE(v_method->>'method', '') = '' THEN
    RAISE EXCEPTION 'no_payout_method';
  END IF;

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

-- ---- Payout retry: failed -> draft so it can be corrected + re-approved ----
CREATE OR REPLACE FUNCTION public.retry_payout(_payout uuid)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payouts
     SET status = 'draft', approved_at = NULL, approved_by_user_id = NULL,
         failure_reason = NULL, updated_at = now()
   WHERE id = _payout AND status = 'failed'
   RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_failed'; END IF;
  PERFORM public.write_audit(auth.uid(), 'retry_payout', 'payout', p.id, NULL, to_jsonb(p), NULL);
  RETURN p;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.retry_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_payout(uuid) TO authenticated;
