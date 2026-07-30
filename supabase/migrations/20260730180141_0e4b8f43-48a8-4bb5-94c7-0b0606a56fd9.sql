ALTER TABLE public.song_notes
  ADD COLUMN IF NOT EXISTS parent_note_id uuid REFERENCES public.song_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS song_notes_parent_idx
  ON public.song_notes (parent_note_id, created_at)
  WHERE parent_note_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reply_to_note(
  _parent_note_id uuid,
  _body text
)
RETURNS public.song_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.song_notes;
  v_row public.song_notes;
BEGIN
  SELECT * INTO v_parent FROM public.song_notes WHERE id = _parent_note_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'note_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_parent.parent_note_id IS NOT NULL THEN
    RAISE EXCEPTION 'replies_are_one_level' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(coalesce(_body, ''))) = 0 THEN
    RAISE EXCEPTION 'empty_body' USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_song_write(v_parent.song_id);

  INSERT INTO public.song_notes (song_id, section_id, author_user_id, body, parent_note_id)
  VALUES (v_parent.song_id, v_parent.section_id, auth.uid(), btrim(_body), v_parent.id)
  RETURNING * INTO v_row;

  PERFORM public.log_song_activity(
    v_parent.song_id, 'note_replied', 'song_note', v_row.id,
    jsonb_build_object('parent_note_id', v_parent.id, 'section_id', v_parent.section_id)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.note_replies(_parent_note_id uuid)
RETURNS SETOF public.song_notes
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.*
    FROM public.song_notes n
    JOIN public.song_notes p ON p.id = n.parent_note_id
   WHERE n.parent_note_id = _parent_note_id
     AND n.archived_at IS NULL
     AND public.is_song_member(p.song_id, auth.uid())
   ORDER BY n.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.reply_to_note(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.note_replies(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_to_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.note_replies(uuid) TO authenticated;