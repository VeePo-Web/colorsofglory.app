-- R17: notes that don't pile up forever

ALTER TABLE public.song_notes
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_user_id uuid;

CREATE INDEX IF NOT EXISTS song_notes_song_live_idx
  ON public.song_notes (song_id, pinned DESC, created_at DESC)
  WHERE archived_at IS NULL;

-- Notes board: one request, authors included, archived hidden by default.
CREATE OR REPLACE FUNCTION public.song_notes_board(
  _song_id uuid,
  _include_resolved boolean DEFAULT true,
  _section_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  song_id uuid,
  section_id uuid,
  body text,
  author_user_id uuid,
  author_name text,
  author_avatar_color text,
  pinned boolean,
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id, n.song_id, n.section_id, n.body,
    n.author_user_id, p.display_name, p.avatar_color,
    n.pinned, n.resolved_at, n.resolved_by_user_id,
    n.created_at, n.updated_at
  FROM public.song_notes n
  LEFT JOIN public.profiles p ON p.user_id = n.author_user_id
  WHERE n.song_id = _song_id
    AND public.is_song_member(_song_id, auth.uid())
    AND n.archived_at IS NULL
    AND (_include_resolved OR n.resolved_at IS NULL)
    AND (
      (_section_id IS NULL AND n.section_id IS NULL)
      OR n.section_id = _section_id
    )
  ORDER BY n.pinned DESC, (n.resolved_at IS NOT NULL), n.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.song_notes_board(uuid, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_note_resolved(_note_id uuid, _resolved boolean)
RETURNS public.song_notes
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.song_notes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.song_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_song_write(_row.song_id);

  UPDATE public.song_notes
     SET resolved_at = CASE WHEN _resolved THEN now() ELSE NULL END,
         resolved_by_user_id = CASE WHEN _resolved THEN auth.uid() ELSE NULL END,
         updated_at = now()
   WHERE id = _note_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_note_resolved(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_note_pinned(_note_id uuid, _pinned boolean)
RETURNS public.song_notes
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.song_notes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.song_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_song_write(_row.song_id);

  UPDATE public.song_notes
     SET pinned = _pinned, updated_at = now()
   WHERE id = _note_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_note_pinned(uuid, boolean) TO authenticated;

-- Soft remove + restore (undo toast)
CREATE OR REPLACE FUNCTION public.archive_song_note(_note_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.song_notes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.song_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF _row.author_user_id <> auth.uid() THEN
    PERFORM public._assert_song_write(_row.song_id);
  END IF;

  UPDATE public.song_notes
     SET archived_at = now(), archived_by_user_id = auth.uid(), updated_at = now()
   WHERE id = _note_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_song_note(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_song_note(_note_id uuid)
RETURNS public.song_notes
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.song_notes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.song_notes WHERE id = _note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF _row.author_user_id <> auth.uid() THEN
    PERFORM public._assert_song_write(_row.song_id);
  END IF;

  UPDATE public.song_notes
     SET archived_at = NULL, archived_by_user_id = NULL, updated_at = now()
   WHERE id = _note_id
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_song_note(uuid) TO authenticated;