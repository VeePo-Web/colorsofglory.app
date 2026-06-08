ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS transcript_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS transcript_json jsonb,
  ADD COLUMN IF NOT EXISTS transcript_error text;

CREATE TABLE IF NOT EXISTS public.canvas_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  take_id uuid REFERENCES public.takes(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('lyrics','chords','scripture','idea','section')),
  section_kind text,
  label text,
  body text NOT NULL DEFAULT '',
  start_ms integer,
  end_ms integer,
  position integer NOT NULL DEFAULT 0,
  x real,
  y real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS canvas_cards_song_idx ON public.canvas_cards (song_id, position);
CREATE INDEX IF NOT EXISTS canvas_cards_take_idx ON public.canvas_cards (take_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canvas_cards TO authenticated;
GRANT ALL ON public.canvas_cards TO service_role;

ALTER TABLE public.canvas_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read canvas_cards" ON public.canvas_cards
  FOR SELECT TO authenticated
  USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "members insert canvas_cards" ON public.canvas_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_song_member(song_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "members update canvas_cards" ON public.canvas_cards
  FOR UPDATE TO authenticated
  USING (public.is_song_member(song_id, auth.uid()))
  WITH CHECK (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "creators or owners delete canvas_cards" ON public.canvas_cards
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.song_role(song_id, auth.uid()) = 'owner'::song_member_role
  );

CREATE TRIGGER trg_canvas_cards_updated_at
  BEFORE UPDATE ON public.canvas_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();