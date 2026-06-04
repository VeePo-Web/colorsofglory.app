-- Audit log search support: GIN indexes + admin RPC

CREATE INDEX IF NOT EXISTS idx_audit_after_gin ON public.audit_logs USING GIN (after jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_audit_before_gin ON public.audit_logs USING GIN (before jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON public.audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.admin_search_audit_logs(
  _invoice_id text DEFAULT NULL,
  _referrer_user_id uuid DEFAULT NULL,
  _referred_user_id uuid DEFAULT NULL,
  _reversed_reason text DEFAULT NULL,
  _action text DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _since timestamptz DEFAULT NULL,
  _until timestamptz DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  action text,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid,
  referred_user_id uuid,
  referrer_user_id uuid,
  referrer_founder_id uuid,
  invoice_id text,
  reason text,
  reversed_reason text,
  before jsonb,
  after jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 50), 1), 500);
  v_offset int := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id,
      a.created_at,
      a.action,
      a.entity_type,
      a.entity_id,
      a.actor_user_id,
      a.actor_user_id AS referred_user_id,
      COALESCE(a.after->>'invoice', a.before->>'invoice') AS invoice_id,
      a.reason,
      COALESCE(a.after->>'reason', a.before->>'reason') AS reversed_reason,
      a.before,
      a.after
    FROM public.audit_logs a
    WHERE (_action IS NULL OR a.action = _action)
      AND (_entity_type IS NULL OR a.entity_type = _entity_type)
      AND (_since IS NULL OR a.created_at >= _since)
      AND (_until IS NULL OR a.created_at <= _until)
      AND (_referred_user_id IS NULL OR a.actor_user_id = _referred_user_id)
      AND (_invoice_id IS NULL
           OR a.after->>'invoice' = _invoice_id
           OR a.before->>'invoice' = _invoice_id)
      AND (_reversed_reason IS NULL
           OR a.after->>'reason' = _reversed_reason
           OR a.before->>'reason' = _reversed_reason)
  ),
  enriched AS (
    SELECT
      b.*,
      attr.referrer_user_id,
      attr.referrer_founder_id
    FROM base b
    LEFT JOIN LATERAL (
      SELECT ra.referrer_user_id, ra.referrer_founder_id
        FROM public.referral_attributions ra
       WHERE ra.referred_user_id = b.actor_user_id
       LIMIT 1
    ) attr ON true
    WHERE (_referrer_user_id IS NULL OR attr.referrer_user_id = _referrer_user_id)
  ),
  counted AS (
    SELECT *, COUNT(*) OVER () AS total_count FROM enriched
  )
  SELECT
    c.id, c.created_at, c.action, c.entity_type, c.entity_id,
    c.actor_user_id, c.referred_user_id, c.referrer_user_id, c.referrer_founder_id,
    c.invoice_id, c.reason, c.reversed_reason, c.before, c.after, c.total_count
  FROM counted c
  ORDER BY c.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_search_audit_logs(text,uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_audit_logs(text,uuid,uuid,text,text,text,timestamptz,timestamptz,int,int) TO authenticated, service_role;