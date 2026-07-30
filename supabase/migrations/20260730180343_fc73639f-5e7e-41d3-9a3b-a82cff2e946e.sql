ALTER TABLE public.song_notes
  ADD COLUMN IF NOT EXISTS take_id uuid REFERENCES public.takes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS at_ms integer;

ALTER TABLE public.song_notes DROP CONSTRAINT IF EXISTS song_notes_moment_valid;
ALTER TABLE public.song_notes
  ADD CONSTRAINT song_notes_moment_valid CHECK (
    (at_ms IS NULL OR at_ms >= 0) AND (at_ms IS NULL OR take_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS song_notes_take_idx
  ON public.song_notes (take_id, at_ms)
  WHERE take_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.add_moment_note(
  _take_id uuid,
  _at_ms integer,
  _body text
)
RETURNS public.song_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song uuid;
  v_memo uuid;
  v_section uuid;
  v_row public.song_notes;
BEGIN
  SELECT t.song_id, t.voice_memo_id INTO v_song, v_memo FROM public.takes t WHERE t.id = _take_id;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'take_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF length(btrim(coalesce(_body, ''))) = 0 THEN
    RAISE EXCEPTION 'empty_body' USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_song_write(v_song);

  SELECT m.section_id INTO v_section FROM public.voice_memos m WHERE m.id = v_memo;

  INSERT INTO public.song_notes (song_id, section_id, author_user_id, body, take_id, at_ms)
  VALUES (v_song, v_section, auth.uid(), btrim(_body), _take_id, GREATEST(COALESCE(_at_ms, 0), 0))
  RETURNING * INTO v_row;

  PERFORM public.log_song_activity(
    v_song, 'moment_note_added', 'song_note', v_row.id,
    jsonb_build_object('take_id', _take_id, 'at_ms', v_row.at_ms, 'section_id', v_section)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.take_moment_notes(_take_id uuid)
RETURNS TABLE (
  id uuid,
  at_ms integer,
  body text,
  author_user_id uuid,
  resolved_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.at_ms, n.body, n.author_user_id, n.resolved_at, n.created_at
    FROM public.song_notes n
    JOIN public.takes t ON t.id = n.take_id
   WHERE n.take_id = _take_id
     AND n.archived_at IS NULL
     AND public.is_song_member(t.song_id, auth.uid())
   ORDER BY n.at_ms ASC NULLS LAST, n.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.add_moment_note(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.take_moment_notes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_moment_note(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.take_moment_notes(uuid) TO authenticated;