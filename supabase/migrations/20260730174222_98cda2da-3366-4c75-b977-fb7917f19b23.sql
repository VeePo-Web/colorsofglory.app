CREATE OR REPLACE FUNCTION public.song_performance_view(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song   record;
  v_result jsonb;
BEGIN
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a member of this song' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.title, s.key_signature, s.tempo_bpm, s.time_signature, s.updated_at
    INTO v_song
  FROM public.songs s
  WHERE s.id = _song_id;

  IF v_song.id IS NULL THEN
    RAISE EXCEPTION 'song not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'song_id', v_song.id,
    'title', v_song.title,
    'key_signature', v_song.key_signature,
    'tempo_bpm', v_song.tempo_bpm,
    'time_signature', v_song.time_signature,
    'updated_at', v_song.updated_at,
    'sections', coalesce((
      SELECT jsonb_agg(sec ORDER BY sec->>'position')
      FROM (
        SELECT jsonb_build_object(
                 'section_id', ss.id,
                 'kind', ss.kind::text,
                 'label', coalesce(nullif(btrim(coalesce(ss.label,'')),''), initcap(replace(ss.kind::text,'_',' '))),
                 'position', lpad(ss.position::text, 6, '0'),
                 'lines', coalesce(sl.content->'lines', '[]'::jsonb),
                 'plain_text', coalesce(sl.plain_text, '')
               ) AS sec
        FROM public.song_sections ss
        LEFT JOIN LATERAL (
          SELECT l.content, l.plain_text
          FROM public.song_lyrics l
          WHERE l.song_id = _song_id AND l.section_id = ss.id
          ORDER BY l.updated_at DESC
          LIMIT 1
        ) sl ON true
        WHERE ss.song_id = _song_id
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.song_performance_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_performance_view(uuid) TO authenticated;