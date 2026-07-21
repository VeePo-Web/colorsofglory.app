-- Email system foundation (docs/email/COG-EMAIL-SYSTEM.md §1/§7).
-- Additive only: extends notification_queue into a scheduled, categorized,
-- dedupe-safe outbox, and adds the suppression set the governance layer
-- (canSend) consults before every lifecycle send.

-- 1) notification_queue: scheduling + category + dedupe -------------------

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

-- One row per dedupe key, EVER — "the welcome sends once" is a DB
-- constraint, not a hope (a sent row keeps holding its key). Recurring
-- kinds (weekly digests etc.) use period-stamped keys, e.g.
-- 'digest.what_changed:<song>:2026-W30'.
CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_dedupe_key
  ON public.notification_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_queue_drain_idx
  ON public.notification_queue (scheduled_for)
  WHERE sent_at IS NULL;

-- Rolling-cap lookups: "how many lifecycle emails did this user get lately?"
CREATE INDEX IF NOT EXISTS notification_queue_user_sent_idx
  ON public.notification_queue (user_id, sent_at)
  WHERE sent_at IS NOT NULL;

-- 2) email_suppressions: the consent/health ledger ------------------------
-- category 'all' = global pause of every lifecycle email. Reasons:
-- 'unsubscribe' | 'hard_bounce' | 'complaint' | 'dismissed_twice' | 'admin'.

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  expires_at timestamptz,          -- null = permanent (unsubscribe); set for 60-day nudge suppressions
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own suppressions" ON public.email_suppressions;
CREATE POLICY "Users read own suppressions"
  ON public.email_suppressions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own suppressions" ON public.email_suppressions;
CREATE POLICY "Users manage own suppressions"
  ON public.email_suppressions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;
