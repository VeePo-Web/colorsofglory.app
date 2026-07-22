
-- email_send_log ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text NOT NULL,
  category text,
  recipient_email citext NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject text,
  idempotency_key text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','complained','failed','suppressed')),
  suppression_reason text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  click_count integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_send_log_message_id_uidx
  ON public.email_send_log(message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_send_log_idem_uidx
  ON public.email_send_log(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_send_log_recipient_idx ON public.email_send_log(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_user_idx ON public.email_send_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_template_created_idx ON public.email_send_log(template_name, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_log_status_idx ON public.email_send_log(status, created_at DESC);

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own email history" ON public.email_send_log;
CREATE POLICY "Users read own email history" ON public.email_send_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all email history" ON public.email_send_log;
CREATE POLICY "Admins read all email history" ON public.email_send_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._email_send_log_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_send_log_touch ON public.email_send_log;
CREATE TRIGGER email_send_log_touch
  BEFORE UPDATE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public._email_send_log_touch();

-- admin analytics RPC -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_analytics_summary(
  p_from timestamptz DEFAULT now() - interval '30 days',
  p_to   timestamptz DEFAULT now()
)
RETURNS TABLE (
  template_name text,
  sent bigint,
  delivered bigint,
  opened bigint,
  clicked bigint,
  bounced bigint,
  complained bigint,
  failed bigint,
  suppressed bigint,
  delivery_rate numeric,
  open_rate numeric,
  click_rate numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (l.id)
      l.template_name, l.status, l.delivered_at, l.first_opened_at, l.first_clicked_at,
      l.bounced_at, l.complained_at, l.sent_at, l.created_at
    FROM public.email_send_log l
    WHERE l.created_at >= p_from AND l.created_at <= p_to
    ORDER BY l.id, l.updated_at DESC
  )
  SELECT
    x.template_name,
    count(*) FILTER (WHERE x.sent_at IS NOT NULL OR x.status IN ('sent','delivered','opened','clicked','bounced','complained'))::bigint AS sent,
    count(*) FILTER (WHERE x.delivered_at IS NOT NULL OR x.status IN ('delivered','opened','clicked'))::bigint AS delivered,
    count(*) FILTER (WHERE x.first_opened_at IS NOT NULL)::bigint AS opened,
    count(*) FILTER (WHERE x.first_clicked_at IS NOT NULL)::bigint AS clicked,
    count(*) FILTER (WHERE x.bounced_at IS NOT NULL OR x.status = 'bounced')::bigint AS bounced,
    count(*) FILTER (WHERE x.complained_at IS NOT NULL OR x.status = 'complained')::bigint AS complained,
    count(*) FILTER (WHERE x.status = 'failed')::bigint AS failed,
    count(*) FILTER (WHERE x.status = 'suppressed')::bigint AS suppressed,
    ROUND(
      (count(*) FILTER (WHERE x.delivered_at IS NOT NULL OR x.status IN ('delivered','opened','clicked')))::numeric
      / NULLIF(count(*) FILTER (WHERE x.sent_at IS NOT NULL OR x.status IN ('sent','delivered','opened','clicked','bounced','complained')), 0),
    4) AS delivery_rate,
    ROUND(
      (count(*) FILTER (WHERE x.first_opened_at IS NOT NULL))::numeric
      / NULLIF(count(*) FILTER (WHERE x.delivered_at IS NOT NULL OR x.status IN ('delivered','opened','clicked')), 0),
    4) AS open_rate,
    ROUND(
      (count(*) FILTER (WHERE x.first_clicked_at IS NOT NULL))::numeric
      / NULLIF(count(*) FILTER (WHERE x.first_opened_at IS NOT NULL), 0),
    4) AS click_rate
  FROM latest x
  GROUP BY x.template_name
  ORDER BY sent DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.email_analytics_summary(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.email_analytics_summary(timestamptz, timestamptz) TO authenticated, service_role;
