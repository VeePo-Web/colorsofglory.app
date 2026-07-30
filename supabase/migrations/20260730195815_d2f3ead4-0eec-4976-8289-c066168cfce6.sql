DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.lyric_suggestions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.song_notes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.card_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.lyric_suggestions REPLICA IDENTITY FULL;
ALTER TABLE public.song_notes REPLICA IDENTITY FULL;
ALTER TABLE public.card_reactions REPLICA IDENTITY FULL;