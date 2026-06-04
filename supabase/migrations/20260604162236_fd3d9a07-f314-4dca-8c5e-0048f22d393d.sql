
-- 1. Profiles: optional first/last name + avatar_color
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS avatar_color text;

CREATE OR REPLACE FUNCTION public.assign_avatar_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  colors text[] := ARRAY['#8070C4','#4D8FD2','#53AB8B','#D4AE5C','#C26A95'];
BEGIN
  IF NEW.avatar_color IS NULL THEN
    NEW.avatar_color := colors[(abs(hashtext(COALESCE(NEW.user_id::text, NEW.id::text))) % 5) + 1];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_avatar_color ON public.profiles;
CREATE TRIGGER trg_assign_avatar_color
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_avatar_color();

-- Backfill existing profiles with a deterministic color
UPDATE public.profiles
   SET avatar_color = (ARRAY['#8070C4','#4D8FD2','#53AB8B','#D4AE5C','#C26A95'])[(abs(hashtext(user_id::text)) % 5) + 1]
 WHERE avatar_color IS NULL;

-- 2. Songs: lyrics_snippet for blurred invite preview
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS lyrics_snippet text;

CREATE OR REPLACE FUNCTION public.sync_song_lyrics_snippet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snippet text;
BEGIN
  -- Build the snippet from the first ~150 chars of plain_text across all sections
  SELECT LEFT(string_agg(plain_text, E'\n' ORDER BY updated_at DESC), 200)
    INTO v_snippet
    FROM public.song_lyrics
   WHERE song_id = COALESCE(NEW.song_id, OLD.song_id)
     AND plain_text <> '';

  UPDATE public.songs
     SET lyrics_snippet = v_snippet
   WHERE id = COALESCE(NEW.song_id, OLD.song_id);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_song_lyrics_snippet ON public.song_lyrics;
CREATE TRIGGER trg_sync_song_lyrics_snippet
  AFTER INSERT OR UPDATE OF plain_text OR DELETE ON public.song_lyrics
  FOR EACH ROW EXECUTE FUNCTION public.sync_song_lyrics_snippet();

-- 3. invite_requests — "send me a new invite" when a link is expired/revoked/exhausted
CREATE TABLE IF NOT EXISTS public.invite_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_token        text NOT NULL,
  song_id               uuid REFERENCES public.songs(id) ON DELETE SET NULL,
  requested_by_user_id  uuid,
  requested_by_phone    text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','ignored')),
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  updated_at            timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_requests_song ON public.invite_requests(song_id);
CREATE INDEX IF NOT EXISTS idx_invite_requests_status ON public.invite_requests(status);

GRANT SELECT, INSERT, UPDATE ON public.invite_requests TO authenticated;
GRANT INSERT ON public.invite_requests TO anon;
GRANT ALL ON public.invite_requests TO service_role;

ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Song owners can read invite requests" ON public.invite_requests;
CREATE POLICY "Song owners can read invite requests"
  ON public.invite_requests FOR SELECT
  TO authenticated
  USING (
    song_id IS NOT NULL
    AND public.song_role(song_id, auth.uid()) = 'owner'
  );

DROP POLICY IF EXISTS "Anyone can submit an invite request" ON public.invite_requests;
CREATE POLICY "Anyone can submit an invite request"
  ON public.invite_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (requested_by_user_id IS NULL AND auth.uid() IS NULL)
    OR requested_by_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Song owners can update invite requests" ON public.invite_requests;
CREATE POLICY "Song owners can update invite requests"
  ON public.invite_requests FOR UPDATE
  TO authenticated
  USING (song_id IS NOT NULL AND public.song_role(song_id, auth.uid()) = 'owner')
  WITH CHECK (song_id IS NOT NULL AND public.song_role(song_id, auth.uid()) = 'owner');

DROP TRIGGER IF EXISTS trg_invite_requests_updated_at ON public.invite_requests;
CREATE TRIGGER trg_invite_requests_updated_at
  BEFORE UPDATE ON public.invite_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. song_notification_prefs — per (user, song) notification settings
CREATE TABLE IF NOT EXISTS public.song_notification_prefs (
  user_id                uuid NOT NULL,
  song_id                uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  notify_on_join         boolean NOT NULL DEFAULT true,
  notify_on_contribution boolean NOT NULL DEFAULT true,
  push_enabled           boolean NOT NULL DEFAULT true,
  created_at             timestamp with time zone NOT NULL DEFAULT now(),
  updated_at             timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_notification_prefs TO authenticated;
GRANT ALL ON public.song_notification_prefs TO service_role;

ALTER TABLE public.song_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own notification prefs" ON public.song_notification_prefs;
CREATE POLICY "Users manage their own notification prefs"
  ON public.song_notification_prefs FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_song_notification_prefs_updated_at ON public.song_notification_prefs;
CREATE TRIGGER trg_song_notification_prefs_updated_at
  BEFORE UPDATE ON public.song_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. get_song_activity — exposes audit_logs filtered to song members
-- Returns activity for a song the caller belongs to. SECURITY DEFINER so the
-- view itself filters access; raw audit_logs stays admin-only.
CREATE OR REPLACE FUNCTION public.get_song_activity(
  _song_id uuid,
  _limit   integer DEFAULT 50,
  _offset  integer DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  created_at    timestamp with time zone,
  action        text,
  entity_type   text,
  entity_id     uuid,
  actor_user_id uuid,
  actor_name    text,
  actor_color   text,
  payload       jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
  v_offset integer := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.created_at,
    a.action,
    a.entity_type,
    a.entity_id,
    a.actor_user_id,
    COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), p.display_name) AS actor_name,
    p.avatar_color AS actor_color,
    -- Only emit IDs + small markers; never raw lyric / memo content.
    jsonb_build_object(
      'section', COALESCE(a.after->>'section', a.before->>'section'),
      'memo_id', COALESCE(a.after->>'memo_id', a.before->>'memo_id'),
      'reason',  a.reason
    ) AS payload
  FROM public.audit_logs a
  LEFT JOIN public.profiles p ON p.user_id = a.actor_user_id
  WHERE (a.entity_type IN ('song','song_lyrics','song_voice_memo','song_invite','song_member','song_section','song_note','song_version','song_chord')
         AND (
           (a.entity_type = 'song' AND a.entity_id = _song_id)
           OR (a.after->>'song_id')::uuid = _song_id
           OR (a.before->>'song_id')::uuid = _song_id
         ))
  ORDER BY a.created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_song_activity(uuid, integer, integer) TO authenticated;

-- 6. Realtime publication for song_members so collaborators see joins live
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='song_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_members;
  END IF;
END $$;
