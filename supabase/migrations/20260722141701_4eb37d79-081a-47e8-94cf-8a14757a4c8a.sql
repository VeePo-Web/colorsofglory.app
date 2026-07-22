
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_dedupe_key
  ON public.notification_queue (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_queue_drain_idx
  ON public.notification_queue (scheduled_for) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS notification_queue_user_sent_idx
  ON public.notification_queue (user_id, sent_at) WHERE sent_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  reason text NOT NULL DEFAULT 'unsubscribe',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_suppressions TO authenticated;
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own suppressions" ON public.email_suppressions;
CREATE POLICY "Users read own suppressions" ON public.email_suppressions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own suppressions" ON public.email_suppressions;
CREATE POLICY "Users manage own suppressions" ON public.email_suppressions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unsubscribed_all boolean NOT NULL DEFAULT false,
  song_activity boolean NOT NULL DEFAULT true,
  weekly_recaps boolean NOT NULL DEFAULT true,
  tips_guides boolean NOT NULL DEFAULT true,
  invite_suggestions boolean NOT NULL DEFAULT true,
  encouragement boolean NOT NULL DEFAULT true,
  product_news boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_prefs_owner_select" ON public.email_preferences;
CREATE POLICY "email_prefs_owner_select" ON public.email_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "email_prefs_owner_update" ON public.email_preferences;
CREATE POLICY "email_prefs_owner_update" ON public.email_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_email_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS email_preferences_touch ON public.email_preferences;
CREATE TRIGGER email_preferences_touch BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_email_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.provision_email_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS profiles_provision_email_prefs ON public.profiles;
CREATE TRIGGER profiles_provision_email_prefs AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.provision_email_preferences();

INSERT INTO public.email_preferences (user_id)
SELECT p.user_id FROM public.profiles p
LEFT JOIN public.email_preferences ep ON ep.user_id = p.user_id
WHERE ep.user_id IS NULL;

CREATE TABLE IF NOT EXISTS public.nudge_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  suppressed_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
GRANT ALL ON public.nudge_dismissals TO service_role;
ALTER TABLE public.nudge_dismissals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  first_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);
GRANT ALL ON public.feature_usage TO service_role;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mark_feature_used(_feature text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF _feature IS NULL OR length(_feature) = 0 OR length(_feature) > 64 THEN
    RAISE EXCEPTION 'invalid_feature';
  END IF;
  INSERT INTO public.feature_usage (user_id, feature) VALUES (_uid, _feature)
  ON CONFLICT (user_id, feature) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.mark_feature_used(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_feature_used(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.email_rolling_counts(_user_id uuid)
RETURNS TABLE(last_24h int, last_7d int)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.notification_queue
      WHERE user_id = _user_id AND category IS NOT NULL
        AND sent_at >= now() - interval '24 hours'),
    (SELECT count(*)::int FROM public.notification_queue
      WHERE user_id = _user_id AND category IS NOT NULL
        AND sent_at >= now() - interval '7 days');
$$;

CREATE OR REPLACE FUNCTION public.first_invite_ever(_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.song_invites WHERE created_by_user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.owner_first_accepted_invite(_song_id uuid, _owner_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.song_members
           WHERE song_id = _song_id AND user_id <> _owner_id) = 1;
$$;

CREATE OR REPLACE FUNCTION public.dormancy(_user_id uuid)
RETURNS TABLE(last_active_at timestamptz, days_inactive int, has_unfinished_song boolean, collaborator_waiting boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH last_act AS (
    SELECT max(created_at) AS ts FROM public.song_activity WHERE actor_user_id = _user_id
  ),
  unfinished AS (
    SELECT EXISTS (SELECT 1 FROM public.songs s WHERE s.owner_user_id = _user_id) AS v
  ),
  waiting AS (
    SELECT EXISTS (
      SELECT 1 FROM public.song_members sm
      JOIN public.song_activity sa ON sa.song_id = sm.song_id AND sa.actor_user_id <> _user_id
      WHERE sm.user_id = _user_id
        AND sa.created_at > coalesce((SELECT ts FROM last_act), 'epoch'::timestamptz)
    ) AS v
  )
  SELECT
    (SELECT ts FROM last_act),
    GREATEST(0, EXTRACT(day FROM (now() - coalesce((SELECT ts FROM last_act), now())))::int),
    (SELECT v FROM unfinished),
    (SELECT v FROM waiting);
$$;

CREATE OR REPLACE FUNCTION public.storage_usage_summary(_user_id uuid)
RETURNS TABLE(used_bytes bigint, quota_bytes bigint, pct numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    coalesce(su.bytes_used, 0)::bigint,
    coalesce(su.bytes_limit, 0)::bigint,
    CASE WHEN coalesce(su.bytes_limit,0) = 0 THEN 0::numeric
         ELSE round((su.bytes_used::numeric / su.bytes_limit::numeric) * 100, 1) END
  FROM public.storage_usage su WHERE su.user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.catalog_size(_user_id uuid)
RETURNS TABLE(owned_songs int, member_songs int)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*)::int FROM public.songs WHERE owner_user_id = _user_id),
    (SELECT count(*)::int FROM public.song_members WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.education_candidates(_user_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
    SELECT
      s.id AS song_id,
      s.title AS title,
      EXISTS(SELECT 1 FROM public.voice_memos vm WHERE vm.song_id = s.id) AS has_memo,
      EXISTS(SELECT 1 FROM public.song_lyrics sl WHERE sl.song_id = s.id AND coalesce(length(sl.plain_text),0) > 0) AS has_lyrics_chords,
      (SELECT count(*)::int FROM public.song_sections ss WHERE ss.song_id = s.id) AS section_count,
      (SELECT count(*)::int FROM public.takes tk WHERE tk.song_id = s.id) AS take_count,
      (SELECT count(*)::int FROM public.song_members sm WHERE sm.song_id = s.id) AS contributor_count,
      (SELECT count(*)::int FROM public.canvas_cards cc WHERE cc.song_id = s.id) AS element_count
    FROM public.songs s
    WHERE s.owner_user_id = _user_id
       OR EXISTS(SELECT 1 FROM public.song_members m WHERE m.song_id = s.id AND m.user_id = _user_id)
    LIMIT 50
  ) t;
$$;

REVOKE ALL ON FUNCTION public.email_rolling_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.first_invite_ever(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_first_accepted_invite(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dormancy(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_usage_summary(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalog_size(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.education_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_rolling_counts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.first_invite_ever(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.owner_first_accepted_invite(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.dormancy(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.storage_usage_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.catalog_size(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.education_candidates(uuid) TO service_role;
