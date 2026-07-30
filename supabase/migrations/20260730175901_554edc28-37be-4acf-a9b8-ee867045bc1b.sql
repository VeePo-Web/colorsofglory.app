CREATE OR REPLACE FUNCTION public.move_memo_to_section(
  _memo_id uuid,
  _section_id uuid DEFAULT NULL
)
RETURNS TABLE (memo_id uuid, section_id uuid, section_label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song uuid;
  v_prev uuid;
  v_label text;
BEGIN
  SELECT m.song_id, m.section_id INTO v_song, v_prev
    FROM public.voice_memos m WHERE m.id = _memo_id;
  IF v_song IS NULL THEN
    RAISE EXCEPTION 'memo_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_song_write(v_song);

  IF _section_id IS NOT NULL THEN
    SELECT COALESCE(s.label, s.kind::text) INTO v_label
      FROM public.song_sections s
     WHERE s.id = _section_id AND s.song_id = v_song;
    IF v_label IS NULL THEN
      RAISE EXCEPTION 'section_not_in_song' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_prev IS NOT DISTINCT FROM _section_id THEN
    RETURN QUERY SELECT _memo_id, _section_id, v_label;
    RETURN;
  END IF;

  UPDATE public.voice_memos
     SET section_id = _section_id, updated_at = now()
   WHERE id = _memo_id;

  PERFORM public.log_song_activity(
    v_song, 'memo_filed', 'voice_memo', _memo_id,
    jsonb_build_object('section_id', _section_id, 'from_section_id', v_prev)
  );

  RETURN QUERY SELECT _memo_id, _section_id, v_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.song_unfiled_memos(_song_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  duration_ms integer,
  waveform_peaks jsonb,
  author_user_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.title, m.duration_ms, m.waveform_peaks, m.author_user_id, m.created_at
    FROM public.voice_memos m
   WHERE m.song_id = _song_id
     AND m.section_id IS NULL
     AND m.status NOT IN ('deleted', 'archived', 'failed')
     AND public.is_song_member(_song_id, auth.uid())
   ORDER BY m.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.move_memo_to_section(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.song_unfiled_memos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_memo_to_section(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_unfiled_memos(uuid) TO authenticated;