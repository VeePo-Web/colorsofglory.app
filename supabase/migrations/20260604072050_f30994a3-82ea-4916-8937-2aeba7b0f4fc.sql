
CREATE OR REPLACE FUNCTION public.record_invoice_refunded(_event jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice text := _event->>'invoice_external_id';
  v_reason text := COALESCE(_event->>'reason', 'invoice_refunded');
  n int := 0;
BEGIN
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'missing_invoice'; END IF;

  UPDATE public.reward_events
     SET status = 'reversed'::reward_status,
         reversed_at = now(),
         reversed_reason = v_reason
   WHERE invoice_external_id = v_invoice
     AND status IN ('pending','payable','paid');
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.credit_ledger c
     SET status = 'reversed', reversed_at = now()
    FROM public.reward_events r
   WHERE c.source_reward_event_id = r.id
     AND r.invoice_external_id = v_invoice
     AND c.status IN ('pending','available','applied');

  IF n > 0 THEN
    PERFORM public.write_audit(NULL, 'reward_reversed', 'invoice', NULL, NULL,
      jsonb_build_object('invoice', v_invoice, 'reason', v_reason, 'count', n), NULL);
  END IF;

  RETURN n;
END;
$$;
