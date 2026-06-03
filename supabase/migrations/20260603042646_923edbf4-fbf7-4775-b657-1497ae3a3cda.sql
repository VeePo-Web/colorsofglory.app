
-- Enums
CREATE TYPE public.song_member_role AS ENUM ('owner', 'collaborator', 'viewer');
CREATE TYPE public.song_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE public.section_kind AS ENUM ('verse', 'chorus', 'bridge', 'pre_chorus', 'intro', 'outro', 'hook', 'tag', 'other');

-- =========================================================================
-- songs
-- =========================================================================
CREATE TABLE public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled',
  status public.song_status NOT NULL DEFAULT 'active',
  key_signature text,
  tempo_bpm int,
  time_signature text,
  tags text[] NOT NULL DEFAULT '{}',
  cover_color text,
  is_locked boolean NOT NULL DEFAULT false,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- song_members
-- =========================================================================
CREATE TABLE public.song_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.song_member_role NOT NULL DEFAULT 'collaborator',
  invited_by_user_id uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_members TO authenticated;
GRANT ALL ON public.song_members TO service_role;
ALTER TABLE public.song_members ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- Helper functions (must come after song_members exists)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_song_member(_song_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.song_members
    WHERE song_id = _song_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.song_role(_song_id uuid, _user_id uuid)
RETURNS public.song_member_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.song_members
  WHERE song_id = _song_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_song_owner(_song_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.songs
    WHERE id = _song_id AND owner_user_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_song_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.song_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_song_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_song_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_song_owner(uuid, uuid) TO authenticated;

-- =========================================================================
-- Trigger: auto-insert owner membership on song insert
-- =========================================================================
CREATE OR REPLACE FUNCTION public.add_owner_song_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.song_members (song_id, user_id, role, invited_by_user_id)
  VALUES (NEW.id, NEW.owner_user_id, 'owner', NEW.owner_user_id)
  ON CONFLICT (song_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_owner_song_member() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER after_song_insert_add_owner
AFTER INSERT ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.add_owner_song_member();

-- =========================================================================
-- Trigger: touch songs.last_activity_at on child writes
-- =========================================================================
CREATE OR REPLACE FUNCTION public.touch_song_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.song_id;
  ELSE
    sid := NEW.song_id;
  END IF;
  UPDATE public.songs SET last_activity_at = now() WHERE id = sid;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_song_activity() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- songs RLS + triggers
-- =========================================================================
CREATE POLICY "Members can view songs" ON public.songs
  FOR SELECT TO authenticated
  USING (public.is_song_member(id, auth.uid()));

CREATE POLICY "Users can create own songs" ON public.songs
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can update songs" ON public.songs
  FOR UPDATE TO authenticated
  USING (public.is_song_owner(id, auth.uid()))
  WITH CHECK (public.is_song_owner(id, auth.uid()));

CREATE POLICY "Owners can delete songs" ON public.songs
  FOR DELETE TO authenticated
  USING (public.is_song_owner(id, auth.uid()));

CREATE TRIGGER update_songs_updated_at
BEFORE UPDATE ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_songs_owner_status ON public.songs(owner_user_id, status);
CREATE INDEX idx_songs_last_activity ON public.songs(last_activity_at DESC);

-- =========================================================================
-- song_members RLS
-- =========================================================================
CREATE POLICY "Members can view membership" ON public.song_members
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Owners manage membership insert" ON public.song_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_song_owner(song_id, auth.uid()));

CREATE POLICY "Owners manage membership update" ON public.song_members
  FOR UPDATE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()))
  WITH CHECK (public.is_song_owner(song_id, auth.uid()));

CREATE POLICY "Owners manage membership delete" ON public.song_members
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_song_members_user ON public.song_members(user_id);
CREATE INDEX idx_song_members_song ON public.song_members(song_id);

CREATE TRIGGER touch_activity_on_song_members
AFTER INSERT OR UPDATE OR DELETE ON public.song_members
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- =========================================================================
-- song_sections
-- =========================================================================
CREATE TABLE public.song_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  kind public.section_kind NOT NULL DEFAULT 'verse',
  label text,
  position int NOT NULL DEFAULT 0,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_sections TO authenticated;
GRANT ALL ON public.song_sections TO service_role;
ALTER TABLE public.song_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sections" ON public.song_sections
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can insert sections" ON public.song_sections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND created_by_user_id = auth.uid());

CREATE POLICY "Members can update sections" ON public.song_sections
  FOR UPDATE TO authenticated
  USING (public.is_song_member(song_id, auth.uid()))
  WITH CHECK (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Owners can delete sections" ON public.song_sections
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_song_sections_song_position ON public.song_sections(song_id, position);

CREATE TRIGGER update_song_sections_updated_at
BEFORE UPDATE ON public.song_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER touch_activity_on_song_sections
AFTER INSERT OR UPDATE OR DELETE ON public.song_sections
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- =========================================================================
-- song_lyrics
-- =========================================================================
CREATE TABLE public.song_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  section_id uuid NOT NULL UNIQUE REFERENCES public.song_sections(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  plain_text text NOT NULL DEFAULT '',
  updated_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_lyrics TO authenticated;
GRANT ALL ON public.song_lyrics TO service_role;
ALTER TABLE public.song_lyrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lyrics" ON public.song_lyrics
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can insert lyrics" ON public.song_lyrics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND updated_by_user_id = auth.uid());

CREATE POLICY "Members can update lyrics" ON public.song_lyrics
  FOR UPDATE TO authenticated
  USING (public.is_song_member(song_id, auth.uid()))
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND updated_by_user_id = auth.uid());

CREATE POLICY "Owners can delete lyrics" ON public.song_lyrics
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_song_lyrics_song ON public.song_lyrics(song_id);

CREATE TRIGGER update_song_lyrics_updated_at
BEFORE UPDATE ON public.song_lyrics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER touch_activity_on_song_lyrics
AFTER INSERT OR UPDATE OR DELETE ON public.song_lyrics
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- =========================================================================
-- song_notes
-- =========================================================================
CREATE TABLE public.song_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.song_sections(id) ON DELETE SET NULL,
  author_user_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_notes TO authenticated;
GRANT ALL ON public.song_notes TO service_role;
ALTER TABLE public.song_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notes" ON public.song_notes
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can insert notes" ON public.song_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND author_user_id = auth.uid());

CREATE POLICY "Authors or owners can update notes" ON public.song_notes
  FOR UPDATE TO authenticated
  USING (
    public.is_song_member(song_id, auth.uid())
    AND (author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid()))
  )
  WITH CHECK (
    public.is_song_member(song_id, auth.uid())
    AND (author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid()))
  );

CREATE POLICY "Authors or owners can delete notes" ON public.song_notes
  FOR DELETE TO authenticated
  USING (
    author_user_id = auth.uid() OR public.is_song_owner(song_id, auth.uid())
  );

CREATE INDEX idx_song_notes_song_created ON public.song_notes(song_id, created_at DESC);

CREATE TRIGGER update_song_notes_updated_at
BEFORE UPDATE ON public.song_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER touch_activity_on_song_notes
AFTER INSERT OR UPDATE OR DELETE ON public.song_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- =========================================================================
-- chord_progressions
-- =========================================================================
CREATE TABLE public.chord_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.song_sections(id) ON DELETE SET NULL,
  label text,
  chords jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chord_progressions TO authenticated;
GRANT ALL ON public.chord_progressions TO service_role;
ALTER TABLE public.chord_progressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chords" ON public.chord_progressions
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can insert chords" ON public.chord_progressions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_song_member(song_id, auth.uid()) AND created_by_user_id = auth.uid());

CREATE POLICY "Members can update chords" ON public.chord_progressions
  FOR UPDATE TO authenticated
  USING (public.is_song_member(song_id, auth.uid()))
  WITH CHECK (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Owners can delete chords" ON public.chord_progressions
  FOR DELETE TO authenticated
  USING (public.is_song_owner(song_id, auth.uid()));

CREATE INDEX idx_chord_progressions_song ON public.chord_progressions(song_id);

CREATE TRIGGER update_chord_progressions_updated_at
BEFORE UPDATE ON public.chord_progressions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER touch_activity_on_chord_progressions
AFTER INSERT OR UPDATE OR DELETE ON public.chord_progressions
FOR EACH ROW EXECUTE FUNCTION public.touch_song_activity();

-- =========================================================================
-- Realtime
-- =========================================================================
ALTER TABLE public.song_lyrics REPLICA IDENTITY FULL;
ALTER TABLE public.song_sections REPLICA IDENTITY FULL;
ALTER TABLE public.song_members REPLICA IDENTITY FULL;
ALTER TABLE public.song_notes REPLICA IDENTITY FULL;
ALTER TABLE public.chord_progressions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.song_lyrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.song_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chord_progressions;
