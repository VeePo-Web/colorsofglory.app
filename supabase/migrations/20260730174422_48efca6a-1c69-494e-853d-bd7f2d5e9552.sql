CREATE OR REPLACE FUNCTION public.duplicate_song(_song_id uuid, _title text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_src     record;
  v_new_id  uuid;
  v_title   text;
  v_count   integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_song_member(_song_id, v_uid) THEN
    RAISE EXCEPTION 'not a member of this song' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_create_song(v_uid) THEN
    RETURN jsonb_build_object('status', 'limit_reached');
  END IF;

  SELECT s.* INTO v_src FROM public.songs s WHERE s.id = _song_id;
  IF v_src.id IS NULL THEN
    RAISE EXCEPTION 'song not found' USING ERRCODE = 'P0002';
  END IF;

  v_title := coalesce(nullif(btrim(coalesce(_title, '')), ''), v_src.title || ' (copy)');

  INSERT INTO public.songs (owner_user_id, title, status, key_signature, tempo_bpm,
                            time_signature, tags, cover_color, dedication)
  VALUES (v_uid, v_title, 'active', v_src.key_signature, v_src.tempo_bpm,
          v_src.time_signature, v_src.tags, v_src.cover_color, v_src.dedication)
  RETURNING id INTO v_new_id;

  WITH src AS (
    SELECT ss.id AS old_id, ss.kind, ss.label, ss.position
    FROM public.song_sections ss
    WHERE ss.song_id = _song_id
    ORDER BY ss.position
  ),
  ins AS (
    INSERT INTO public.song_sections (song_id, kind, label, position, created_by_user_id)
    SELECT v_new_id, src.kind, src.label, src.position, v_uid FROM src
    RETURNING id, position
  )
  SELECT count(*)::int INTO v_count FROM ins;

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id)
  SELECT v_new_id, ns.id, sl.content, sl.plain_text, v_uid
  FROM public.song_sections os
  JOIN public.song_sections ns
    ON ns.song_id = v_new_id AND ns.position = os.position
  JOIN LATERAL (
    SELECT l.content, l.plain_text
    FROM public.song_lyrics l
    WHERE l.song_id = _song_id AND l.section_id = os.id
    ORDER BY l.updated_at DESC
    LIMIT 1
  ) sl ON true
  WHERE os.song_id = _song_id;

  INSERT INTO public.chord_progressions (song_id, section_id, label, chords, created_by_user_id)
  SELECT v_new_id, ns.id, cp.label, cp.chords, v_uid
  FROM public.chord_progressions cp
  LEFT JOIN public.song_sections os ON os.id = cp.section_id
  LEFT JOIN public.song_sections ns
    ON ns.song_id = v_new_id AND os.id IS NOT NULL AND ns.position = os.position
  WHERE cp.song_id = _song_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (v_new_id, v_uid, 'song_copied', 'song', _song_id,
          jsonb_build_object('from_song_id', _song_id, 'sections', v_count));

  RETURN jsonb_build_object('status', 'created', 'song_id', v_new_id,
                            'title', v_title, 'sections', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_song(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.duplicate_song(uuid, text) TO authenticated;