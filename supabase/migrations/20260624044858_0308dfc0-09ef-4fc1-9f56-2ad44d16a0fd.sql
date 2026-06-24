
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notification_queue;
CREATE POLICY "Users read own notifications"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_unsent
  ON public.notification_queue(created_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS public.reconciliation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  window_hours int NOT NULL,
  stripe_invoice_count int NOT NULL DEFAULT 0,
  local_event_count int NOT NULL DEFAULT 0,
  drift_count int NOT NULL DEFAULT 0,
  drift_invoice_ids text[] NOT NULL DEFAULT '{}'::text[],
  notes text
);
GRANT SELECT ON public.reconciliation_reports TO authenticated;
GRANT ALL ON public.reconciliation_reports TO service_role;
ALTER TABLE public.reconciliation_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read reconciliation" ON public.reconciliation_reports;
CREATE POLICY "Admins read reconciliation"
  ON public.reconciliation_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enqueue_reward_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_user uuid;
BEGIN
  IF NEW.referrer_type = 'user' THEN
    target_user := NEW.referrer_user_id;
  ELSIF NEW.referrer_type = 'founder' THEN
    SELECT user_id INTO target_user FROM public.founders WHERE id = NEW.referrer_founder_id;
  END IF;
  IF target_user IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_queue(user_id, kind, payload)
    VALUES (target_user, 'reward_minted',
      jsonb_build_object('reward_event_id', NEW.id, 'amount_cents', NEW.amount_cents, 'status', NEW.status));
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'payable' THEN
      INSERT INTO public.notification_queue(user_id, kind, payload)
      VALUES (target_user, 'reward_matured',
        jsonb_build_object('reward_event_id', NEW.id, 'amount_cents', NEW.amount_cents));
    ELSIF NEW.status = 'paid' THEN
      INSERT INTO public.notification_queue(user_id, kind, payload)
      VALUES (target_user, 'reward_paid',
        jsonb_build_object('reward_event_id', NEW.id, 'amount_cents', NEW.amount_cents));
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_reward_events_notify ON public.reward_events;
CREATE TRIGGER trg_reward_events_notify
AFTER INSERT OR UPDATE OF status ON public.reward_events
FOR EACH ROW EXECUTE FUNCTION public.enqueue_reward_notification();

CREATE OR REPLACE FUNCTION public.enqueue_payout_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('paid','failed','approved') THEN
      INSERT INTO public.notification_queue(user_id, kind, payload)
      VALUES (NEW.user_id,
        CASE NEW.status WHEN 'paid' THEN 'payout_sent'
                        WHEN 'failed' THEN 'payout_failed'
                        ELSE 'payout_approved' END,
        jsonb_build_object('payout_id', NEW.id, 'amount_cents', NEW.amount_cents));
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_payouts_notify ON public.payouts;
CREATE TRIGGER trg_payouts_notify
AFTER UPDATE OF status ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_payout_notification();

DROP FUNCTION IF EXISTS public.approve_payout(uuid);
CREATE OR REPLACE FUNCTION public.approve_payout(_payout_id uuid)
RETURNS public.payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay public.payouts; method text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO pay FROM public.payouts WHERE id = _payout_id FOR UPDATE;
  IF pay IS NULL THEN RAISE EXCEPTION 'payout_not_found'; END IF;
  IF pay.status NOT IN ('draft','pending') THEN RAISE EXCEPTION 'invalid_status:%', pay.status; END IF;
  SELECT payout_method INTO method FROM public.profiles WHERE user_id = pay.user_id;
  IF method IS NULL THEN RAISE EXCEPTION 'payout_method_missing'; END IF;
  UPDATE public.payouts
    SET status = 'approved', approved_at = now(), approved_by = auth.uid(), updated_at = now()
    WHERE id = _payout_id RETURNING * INTO pay;
  RETURN pay;
END;$$;
