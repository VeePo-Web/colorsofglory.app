-- ============================================================
-- Fraud review queue (admin) over public.fraud_flags
--
-- An OPEN (resolved_at IS NULL) flag on a user/founder blocks reward minting in
-- record_invoice_paid (see 20260604072016). This gives admins a guarded,
-- audited surface to list / create / resolve those flags. A referral economy is
-- a fraud target the moment it pays real money — this is its kill-switch.
--
-- All admin-gated (has_role) + SECURITY DEFINER + audit rows. Money is never
-- mutated here; flags only gate future minting + signal for investigation.
-- ============================================================

-- List flags (open by default; pass false for full history).
CREATE OR REPLACE FUNCTION public.admin_fraud_flags(_only_open boolean DEFAULT true, _limit int DEFAULT 100)
RETURNS SETOF public.fraud_flags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT * FROM public.fraud_flags
     WHERE (NOT _only_open) OR resolved_at IS NULL
     ORDER BY (resolved_at IS NULL) DESC, created_at DESC
     LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_fraud_flags(boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fraud_flags(boolean, int) TO authenticated;

-- Create a flag. subject_type must be 'user' or 'founder' to match the gate in
-- record_invoice_paid. Idempotent-ish: a second OPEN flag for the same subject
-- is allowed (multiple reasons) but harmless — the gate only needs one.
CREATE OR REPLACE FUNCTION public.admin_create_fraud_flag(
  _subject_type text, _subject_id uuid, _reason text, _severity text DEFAULT 'low'
) RETURNS public.fraud_flags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE f public.fraud_flags;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _subject_type NOT IN ('user','founder') THEN RAISE EXCEPTION 'invalid_subject_type'; END IF;
  IF COALESCE(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  INSERT INTO public.fraud_flags(subject_type, subject_id, reason, severity, created_by_user_id)
  VALUES (_subject_type, _subject_id, _reason, COALESCE(NULLIF(_severity,''),'low'), auth.uid())
  RETURNING * INTO f;

  PERFORM public.write_audit(auth.uid(), 'fraud_flag_created', _subject_type, _subject_id,
    NULL, to_jsonb(f), _reason);
  RETURN f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_create_fraud_flag(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_fraud_flag(text, uuid, text, text) TO authenticated;

-- Resolve (clear) a flag — unblocks minting for that subject if no other open flag.
CREATE OR REPLACE FUNCTION public.admin_resolve_fraud_flag(_id uuid, _note text DEFAULT NULL)
RETURNS public.fraud_flags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE f public.fraud_flags;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.fraud_flags
     SET resolved_at = now(), resolution_note = _note
   WHERE id = _id AND resolved_at IS NULL
   RETURNING * INTO f;
  IF f.id IS NULL THEN RAISE EXCEPTION 'flag_not_open'; END IF;
  PERFORM public.write_audit(auth.uid(), 'fraud_flag_resolved', f.subject_type, f.subject_id,
    NULL, to_jsonb(f), _note);
  RETURN f;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_fraud_flag(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_fraud_flag(uuid, text) TO authenticated;
