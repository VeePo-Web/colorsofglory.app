
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.memo_status AS ENUM ('uploading','ready','failed','deleted');
CREATE TYPE public.transcription_status AS ENUM ('pending','processing','ready','failed','skipped');

-- =====================================================
-- TABLE: voice_memos
-- =====================================================
CREATE TABLE public.voice_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.song_sections(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  duration_ms integer,
  byte_size bigint NOT NULL DEFAULT 0,
  title text,
  status public.memo_status NOT NULL DEFAULT 'uploading',
  waveform_peaks jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_memos TO authenticated;
GRANT ALL ON public.voice_memos TO service_role;

ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view memos"
  ON public.voice_memos FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can insert memos"
  ON public.voice_memos FOR INSERT TO authenticated
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND author_user_id = auth.uid());

CREATE POLICY "Author or owner can update memos"
  ON public.voice_memos FOR UPDATE TO authenticated
  USING (public.is_song_member(song_id, auth.uid()) AND (author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid())))
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND (author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid())));

CREATE POLICY "Author or owner can delete memos"
  ON public.voice_memos FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_voice_memos_song_created ON public.voice_memos (song_id, created_at DESC);
CREATE INDEX idx_voice_memos_section ON public.voice_memos (section_id) WHERE section_id IS NOT NULL;
CREATE INDEX idx_voice_memos_author ON public.voice_memos (author_user_id);

-- =====================================================
-- TABLE: voice_memo_transcripts
-- =====================================================
CREATE TABLE public.voice_memo_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id uuid NOT NULL UNIQUE REFERENCES public.voice_memos(id) ON DELETE CASCADE,
  song_id uuid NOT NULL,
  status public.transcription_status NOT NULL DEFAULT 'pending',
  language text,
  text text NOT NULL DEFAULT '',
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.voice_memo_transcripts TO authenticated;
GRANT ALL ON public.voice_memo_transcripts TO service_role;

ALTER TABLE public.voice_memo_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transcripts"
  ON public.voice_memo_transcripts FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE INDEX idx_transcripts_song ON public.voice_memo_transcripts (song_id);
CREATE INDEX idx_transcripts_pending ON public.voice_memo_transcripts (status)
  WHERE status IN ('pending','processing');

-- =====================================================
-- TABLE: storage_usage
-- =====================================================
CREATE TABLE public.storage_usage (
  user_id uuid PRIMARY KEY,
  bytes_used bigint NOT NULL DEFAULT 0,
  bytes_limit bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storage_usage TO authenticated;
GRANT ALL ON public.storage_usage TO service_role;

ALTER TABLE public.storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own storage usage"
  ON public.storage_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- APP SETTINGS: default free storage cap
-- =====================================================
INSERT INTO public.app_settings (key, value, description)
VALUES ('free_storage_mb', '200'::jsonb, 'Free-plan storage cap in megabytes per song owner')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- HELPERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.effective_storage_limit(_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  mb int;
BEGIN
  SELECT COALESCE((value::text)::int, 200) INTO mb
    FROM public.app_settings WHERE key = 'free_storage_mb';
  RETURN COALESCE(mb, 200)::bigint * 1024 * 1024;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.effective_storage_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_storage_limit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_storage_delta(_owner_user_id uuid, _delta bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.storage_usage (user_id, bytes_used, updated_at)
  VALUES (_owner_user_id, GREATEST(_delta, 0), now())
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = GREATEST(public.storage_usage.bytes_used + _delta, 0),
        updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_storage_delta(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_storage_delta(uuid, bigint) TO service_role;

-- =====================================================
-- TRIGGERS
-- =====================================================
-- updated_at maintenance
CREATE TRIGGER trg_voice_memos_updated_at
  BEFORE UPDATE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_transcripts_updated_at
  BEFORE UPDATE ON public.voice_memo_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity touching
CREATE TRIGGER trg_voice_memos_touch_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- Storage delta tracking
CREATE OR REPLACE FUNCTION public.voice_memo_storage_delta()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_uid uuid;
  old_counts boolean;
  new_counts boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ready' AND NEW.byte_size > 0 THEN
      SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = NEW.song_id;
      IF owner_uid IS NOT NULL THEN
        PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size);
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    old_counts := (OLD.status = 'ready');
    new_counts := (NEW.status = 'ready');
    SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = NEW.song_id;
    IF owner_uid IS NULL THEN
      RETURN NEW;
    END IF;
    IF old_counts AND NOT new_counts THEN
      PERFORM public.apply_storage_delta(owner_uid, -OLD.byte_size);
    ELSIF NOT old_counts AND new_counts THEN
      PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size);
    ELSIF old_counts AND new_counts AND OLD.byte_size <> NEW.byte_size THEN
      PERFORM public.apply_storage_delta(owner_uid, NEW.byte_size - OLD.byte_size);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'ready' AND OLD.byte_size > 0 THEN
      SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = OLD.song_id;
      IF owner_uid IS NOT NULL THEN
        PERFORM public.apply_storage_delta(owner_uid, -OLD.byte_size);
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_voice_memos_storage_delta
  AFTER INSERT OR UPDATE OR DELETE ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.voice_memo_storage_delta();

-- =====================================================
-- REALTIME
-- =====================================================
ALTER TABLE public.voice_memos REPLICA IDENTITY FULL;
ALTER TABLE public.voice_memo_transcripts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_memos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_memo_transcripts;
