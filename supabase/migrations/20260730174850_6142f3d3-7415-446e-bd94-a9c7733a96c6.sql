CREATE TABLE IF NOT EXISTS public.card_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.canvas_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('amen','heart','keeper')),
  note_text text CHECK (note_text IS NULL OR char_length(note_text) <= 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, user_id, kind)
);

CREATE INDEX IF NOT EXISTS card_reactions_song_idx ON public.card_reactions (song_id, created_at);
CREATE INDEX IF NOT EXISTS card_reactions_card_idx ON public.card_reactions (card_id);

GRANT SELECT, INSERT, DELETE ON public.card_reactions TO authenticated;
GRANT ALL ON public.card_reactions TO service_role;

ALTER TABLE public.card_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read reactions in their songs"
ON public.card_reactions FOR SELECT TO authenticated
USING (public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can add their own reactions"
ON public.card_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

CREATE POLICY "Members can withdraw their own reactions"
ON public.card_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.card_reactions;