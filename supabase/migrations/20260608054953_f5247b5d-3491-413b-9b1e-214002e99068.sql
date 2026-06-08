
-- ============================================================================
-- Capture/Takes/Intake migration
-- ============================================================================

-- 1) profiles.timezone for friendly-name calculation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;

-- 2) idea_captures (anchor for quick-capture sheet)
CREATE TABLE IF NOT EXISTS public.idea_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid REFERENCES public.songs(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  title text,
  lyric_snippet text,
  scripture_ref text,
  tags text[] NOT NULL DEFAULT '{}',
  section_id uuid REFERENCES public.song_sections(id) ON DELETE SET NULL,
  voice_memo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idea_captures_song_idx ON public.idea_captures(song_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idea_captures_author_idx ON public.idea_captures(author_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_captures TO authenticated;
GRANT ALL ON public.idea_captures TO service_role;

ALTER TABLE public.idea_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read song captures"
  ON public.idea_captures FOR SELECT TO authenticated
  USING (
    (song_id IS NOT NULL AND public.is_song_member(song_id, auth.uid()))
    OR (song_id IS NULL AND author_user_id = auth.uid())
  );

CREATE POLICY "authors write captures"
  ON public.idea_captures FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (song_id IS NULL OR public.is_song_member(song_id, auth.uid()))
  );

CREATE POLICY "authors update own captures"
  ON public.idea_captures FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

CREATE POLICY "authors delete own captures"
  ON public.idea_captures FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

CREATE TRIGGER idea_captures_updated_at BEFORE UPDATE ON public.idea_captures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) takes (multiple per voice_memo, non-destructive)
CREATE TABLE IF NOT EXISTS public.takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_memo_id uuid NOT NULL REFERENCES public.voice_memos(id) ON DELETE CASCADE,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'audio/webm',
  duration_ms integer,
  byte_size bigint NOT NULL DEFAULT 0,
  waveform_peaks jsonb,
  friendly_name text,
  name_is_custom boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS takes_one_primary
  ON public.takes(voice_memo_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS takes_memo_idx
  ON public.takes(voice_memo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS takes_song_idx
  ON public.takes(song_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.takes TO authenticated;
GRANT ALL ON public.takes TO service_role;

ALTER TABLE public.takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read takes"
  ON public.takes FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "members insert takes"
  ON public.takes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_song_member(song_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "creators or owners update takes"
  ON public.takes FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.song_role(song_id, auth.uid()) = 'owner'
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.song_role(song_id, auth.uid()) = 'owner'
  );

CREATE POLICY "creators or owners delete takes"
  ON public.takes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.song_role(song_id, auth.uid()) = 'owner'
  );

CREATE TRIGGER takes_updated_at BEFORE UPDATE ON public.takes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Friendly-name generator + trigger
CREATE OR REPLACE FUNCTION public.compute_friendly_take_name(_created_at timestamptz, _tz text, _duration_ms integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  local_ts timestamp;
  hour_of_day int;
  dow int;
  bucket text;
  day_label text;
  duration_label text;
  total_seconds int;
  mins int;
  secs int;
BEGIN
  local_ts := _created_at AT TIME ZONE COALESCE(_tz, 'UTC');
  hour_of_day := EXTRACT(HOUR FROM local_ts)::int;
  dow := EXTRACT(DOW FROM local_ts)::int; -- 0=Sun ... 6=Sat

  bucket := CASE
    WHEN hour_of_day BETWEEN 5 AND 10 THEN 'morning'
    WHEN hour_of_day BETWEEN 11 AND 13 THEN 'midday'
    WHEN hour_of_day BETWEEN 14 AND 16 THEN 'afternoon'
    WHEN hour_of_day BETWEEN 17 AND 20 THEN 'evening'
    ELSE 'late night'
  END;

  day_label := CASE dow
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN 'Monday'
    WHEN 2 THEN 'Tuesday'
    WHEN 3 THEN 'Wednesday'
    WHEN 4 THEN 'Thursday'
    WHEN 5 THEN 'Friday'
    WHEN 6 THEN 'Saturday'
  END;

  total_seconds := COALESCE(_duration_ms, 0) / 1000;
  mins := total_seconds / 60;
  secs := total_seconds % 60;
  duration_label := CASE
    WHEN total_seconds = 0 THEN ''
    WHEN mins = 0 THEN ' · ' || secs || ' sec'
    WHEN secs = 0 THEN ' · ' || mins || ' min'
    ELSE ' · ' || mins || ' min ' || secs || ' sec'
  END;

  RETURN day_label || ' ' || bucket || duration_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_default_take_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  user_tz text;
BEGIN
  IF NEW.friendly_name IS NULL OR NEW.friendly_name = '' THEN
    SELECT timezone INTO user_tz FROM public.profiles WHERE id = NEW.created_by;
    NEW.friendly_name := public.compute_friendly_take_name(NEW.created_at, COALESCE(user_tz, 'UTC'), NEW.duration_ms);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER takes_set_default_name
  BEFORE INSERT ON public.takes
  FOR EACH ROW EXECUTE FUNCTION public.set_default_take_name();

-- 5) Backfill: one primary take per existing voice_memo
INSERT INTO public.takes (
  voice_memo_id, song_id, created_by, storage_path, mime_type,
  duration_ms, byte_size, waveform_peaks, is_primary, created_at
)
SELECT
  vm.id, vm.song_id, vm.author_user_id, vm.storage_path, vm.mime_type,
  vm.duration_ms, vm.byte_size, vm.waveform_peaks, true, vm.created_at
FROM public.voice_memos vm
WHERE NOT EXISTS (SELECT 1 FROM public.takes t WHERE t.voice_memo_id = vm.id);

-- 6) RPC: list_takes
CREATE OR REPLACE FUNCTION public.list_takes(_voice_memo_id uuid, _include_archived boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  voice_memo_id uuid,
  song_id uuid,
  created_by uuid,
  storage_path text,
  duration_ms integer,
  byte_size bigint,
  waveform_peaks jsonb,
  friendly_name text,
  name_is_custom boolean,
  is_primary boolean,
  is_archived boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _song_id uuid;
BEGIN
  SELECT vm.song_id INTO _song_id FROM public.voice_memos vm WHERE vm.id = _voice_memo_id;
  IF _song_id IS NULL THEN RETURN; END IF;
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN RETURN; END IF;

  RETURN QUERY
    SELECT t.id, t.voice_memo_id, t.song_id, t.created_by, t.storage_path,
           t.duration_ms, t.byte_size, t.waveform_peaks, t.friendly_name,
           t.name_is_custom, t.is_primary, t.is_archived, t.created_at
    FROM public.takes t
    WHERE t.voice_memo_id = _voice_memo_id
      AND (_include_archived OR NOT t.is_archived)
    ORDER BY t.is_primary DESC, t.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_takes(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_takes(uuid, boolean) TO authenticated;

-- 7) RPC: set_primary_take
CREATE OR REPLACE FUNCTION public.set_primary_take(_take_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vm uuid;
  _song uuid;
BEGIN
  SELECT voice_memo_id, song_id INTO _vm, _song FROM public.takes WHERE id = _take_id;
  IF _vm IS NULL THEN RAISE EXCEPTION 'take not found'; END IF;
  IF NOT public.is_song_member(_song, auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  UPDATE public.takes SET is_primary = false WHERE voice_memo_id = _vm AND is_primary;
  UPDATE public.takes SET is_primary = true, is_archived = false WHERE id = _take_id;
  RETURN _take_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_primary_take(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_primary_take(uuid) TO authenticated;

-- 8) RPC: quick_capture (atomic Stage-2 save; voice memo upload happens client-side first)
CREATE OR REPLACE FUNCTION public.quick_capture(
  _song_id uuid,
  _title text,
  _lyric_snippet text,
  _scripture_ref text,
  _tags text[],
  _section_id uuid,
  _voice_memo_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _capture_id uuid;
BEGIN
  IF _song_id IS NOT NULL AND NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  INSERT INTO public.idea_captures (
    song_id, author_user_id, title, lyric_snippet, scripture_ref, tags, section_id, voice_memo_id
  ) VALUES (
    _song_id, auth.uid(), NULLIF(_title,''), NULLIF(_lyric_snippet,''), NULLIF(_scripture_ref,''),
    COALESCE(_tags, '{}'), _section_id, _voice_memo_id
  )
  RETURNING id INTO _capture_id;

  IF _song_id IS NOT NULL THEN
    UPDATE public.songs SET last_activity_at = now() WHERE id = _song_id;
  END IF;

  RETURN _capture_id;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_capture(uuid, text, text, text, text[], uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quick_capture(uuid, text, text, text, text[], uuid, uuid) TO authenticated;
