
-- R22: Chords board -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.song_chords_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'song', jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'key_signature', s.key_signature,
      'tempo_bpm', s.tempo_bpm,
      'time_signature', s.time_signature
    ),
    'role', public.song_role(_song_id, _uid),
    'progressions', COALESCE((
      SELECT jsonb_agg(p ORDER BY p->>'created_at')
      FROM (
        SELECT jsonb_build_object(
          'id', cp.id,
          'section_id', cp.section_id,
          'section_label', COALESCE(sec.label, sec.kind::text),
          'section_position', sec.position,
          'label', cp.label,
          'chords', cp.chords,
          'created_by_user_id', cp.created_by_user_id,
          'created_by_name', pr.display_name,
          'created_at', cp.created_at,
          'updated_at', cp.updated_at
        ) AS p
        FROM public.chord_progressions cp
        LEFT JOIN public.song_sections sec ON sec.id = cp.section_id
        LEFT JOIN public.profiles pr ON pr.user_id = cp.created_by_user_id
        WHERE cp.song_id = _song_id
      ) q
    ), '[]'::jsonb),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sec.id,
        'kind', sec.kind,
        'label', COALESCE(sec.label, sec.kind::text),
        'position', sec.position
      ) ORDER BY sec.position)
      FROM public.song_sections sec
      WHERE sec.song_id = _song_id
    ), '[]'::jsonb)
  )
  INTO _result
  FROM public.songs s
  WHERE s.id = _song_id;

  RETURN COALESCE(_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_chords_board(uuid) TO authenticated;

-- Save (insert or update) a chord progression ---------------------------
CREATE OR REPLACE FUNCTION public.save_chord_progression(
  _song_id uuid,
  _chords jsonb,
  _progression_id uuid DEFAULT NULL,
  _section_id uuid DEFAULT NULL,
  _label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  PERFORM public._assert_song_write(_song_id);

  IF _section_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.song_sections WHERE id = _section_id AND song_id = _song_id
  ) THEN
    RAISE EXCEPTION 'section_not_in_song' USING ERRCODE = '22023';
  END IF;

  IF _progression_id IS NULL THEN
    INSERT INTO public.chord_progressions (song_id, section_id, label, chords, created_by_user_id)
    VALUES (_song_id, _section_id, _label, COALESCE(_chords, '[]'::jsonb), _uid)
    RETURNING id INTO _id;

    PERFORM public.log_song_activity(_song_id, 'chords_added', 'chord_progression', _id, '{}'::jsonb);
  ELSE
    UPDATE public.chord_progressions
    SET chords = COALESCE(_chords, chords),
        section_id = _section_id,
        label = _label,
        updated_at = now()
    WHERE id = _progression_id AND song_id = _song_id
    RETURNING id INTO _id;

    IF _id IS NULL THEN
      RAISE EXCEPTION 'progression_not_found' USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.log_song_activity(_song_id, 'chords_edited', 'chord_progression', _id, '{}'::jsonb);
  END IF;

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_chord_progression(uuid, jsonb, uuid, uuid, text) TO authenticated;

-- Delete a chord progression --------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_chord_progression(_progression_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _song_id uuid;
BEGIN
  SELECT song_id INTO _song_id FROM public.chord_progressions WHERE id = _progression_id;
  IF _song_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM public._assert_song_write(_song_id);

  DELETE FROM public.chord_progressions WHERE id = _progression_id;

  PERFORM public.log_song_activity(_song_id, 'chords_removed', 'chord_progression', _progression_id, '{}'::jsonb);
  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_chord_progression(uuid) TO authenticated;

-- Set song musical metadata ---------------------------------------------
CREATE OR REPLACE FUNCTION public.set_song_musical_meta(
  _song_id uuid,
  _key_signature text DEFAULT NULL,
  _tempo_bpm integer DEFAULT NULL,
  _time_signature text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.songs%ROWTYPE;
BEGIN
  PERFORM public._assert_song_write(_song_id);

  UPDATE public.songs
  SET key_signature = COALESCE(_key_signature, key_signature),
      tempo_bpm = COALESCE(_tempo_bpm, tempo_bpm),
      time_signature = COALESCE(_time_signature, time_signature),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = _song_id
  RETURNING * INTO _row;

  PERFORM public.log_song_activity(_song_id, 'song_meta_updated', 'song', _song_id, '{}'::jsonb);

  RETURN jsonb_build_object(
    'key_signature', _row.key_signature,
    'tempo_bpm', _row.tempo_bpm,
    'time_signature', _row.time_signature
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_song_musical_meta(uuid, text, integer, text) TO authenticated;
