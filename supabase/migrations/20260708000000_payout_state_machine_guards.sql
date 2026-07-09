-- Payout state-machine guards (defense in depth beneath the admin-payouts
-- edge guard and the PayoutBatches UI — companion to 20260627000000).
--
-- 1) mark_payout_failed previously matched on id alone, so a PAID payout
--    could be flipped to failed, then retried back to draft, re-approved,
--    and paid a second time — a double-pay path. Failing is now only legal
--    from approved/processing; anything else raises payout_not_failable.
--
-- 2) approve_payout now refuses while the recipient has an OPEN fraud flag
--    (founder-level or user-level), raising recipient_fraud_flagged. A held
--    account cannot be approved for payment until the flag is resolved in
--    Fraud review; resolving the flag releases the hold.
--
-- Both functions keep their existing audit writes and error contract; the
-- new error names surface as operator-readable messages in the console.

CREATE OR REPLACE FUNCTION public.mark_payout_failed(_payout uuid, _reason text)
RETURNS public.payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  UPDATE public.payouts
     SET status = 'failed', failure_reason = _reason, updated_at = now()
   WHERE id = _payout AND status IN ('approved', 'processing')
   RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_failable'; END IF;

  PERFORM public.write_audit(auth.uid(), 'mark_payout_failed', 'payout', p.id, NULL, to_jsonb(p), _reason);
  RETURN p;
END;
$$;

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

  IF EXISTS (
    SELECT 1 FROM public.fraud_flags ff
     WHERE ff.resolved_at IS NULL
       AND (
         (p.founder_id IS NOT NULL AND ff.subject_type = 'founder' AND ff.subject_id = p.founder_id)
         OR (v_recipient IS NOT NULL AND ff.subject_type = 'user' AND ff.subject_id = v_recipient)
       )
  ) THEN
    RAISE EXCEPTION 'recipient_fraud_flagged';
  END IF;

  SELECT payout_method INTO v_method FROM public.profiles WHERE user_id = v_recipient;
  IF v_method IS NULL OR COALESCE(v_method->>'method', '') = '' THEN
    RAISE EXCEPTION 'no_payout_method';
  END IF;

  UPDATE public.payouts
     SET status = 'approved', approved_at = now(), approved_by_user_id = auth.uid(), updated_at = now()
   WHERE id = _payout AND status = 'draft'
   RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_draft'; END IF;

  PERFORM public.write_audit(auth.uid(), 'approve_payout', 'payout', p.id, NULL, to_jsonb(p), NULL);
  RETURN p;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_payout_failed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payout_failed(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payout(uuid) TO authenticated;
