
-- R30: transcript -> lyrics ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.take_transcript_lines(_take_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song_id uuid;
  _memo_id uuid;
  _status text;
  _tj jsonb;
  _lines jsonb;
BEGIN
  SELECT t.song_id, t.voice_memo_id, t.transcript_status, t.transcript_json
    INTO _song_id, _memo_id, _status, _tj
  FROM public.takes t WHERE t.id = _take_id;

  IF _song_id IS NULL THEN
    RAISE EXCEPTION 'take_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Prefer the take's own transcript; fall back to the memo-level transcript.
  IF _tj IS NULL OR jsonb_typeof(COALESCE(_tj->'segments', 'null'::jsonb)) <> 'array' THEN
    SELECT jsonb_build_object('segments', vt.segments, 'text', vt.text), vt.status::text
      INTO _tj, _status
    FROM public.voice_memo_transcripts vt
    WHERE vt.memo_id = _memo_id
    ORDER BY vt.updated_at DESC
    LIMIT 1;
  END IF;

  IF _tj IS NULL THEN
    RETURN jsonb_build_object('take_id', _take_id, 'song_id', _song_id,
      'status', COALESCE(_status, 'pending'), 'lines', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'ord', s.ord,
             'text', s.text,
             'start_ms', s.start_ms,
             'end_ms', s.end_ms
           ) ORDER BY s.ord), '[]'::jsonb)
  INTO _lines
  FROM (
    SELECT
      seg.ord,
      btrim(COALESCE(seg.value->>'text', '')) AS text,
      NULLIF(seg.value->>'start_ms', '')::int AS start_ms,
      NULLIF(seg.value->>'end_ms', '')::int   AS end_ms
    FROM jsonb_array_elements(COALESCE(_tj->'segments', '[]'::jsonb)) WITH ORDINALITY AS seg(value, ord)
    WHERE btrim(COALESCE(seg.value->>'text', '')) <> ''
  ) s;

  -- No segments but plain text: split on sentence-ish breaks.
  IF jsonb_array_length(_lines) = 0 AND COALESCE(btrim(_tj->>'text'), '') <> '' THEN
    SELECT COALESCE(jsonb_agg(
             jsonb_build_object('ord', f.ord, 'text', f.text,
                                'start_ms', NULL, 'end_ms', NULL) ORDER BY f.ord), '[]'::jsonb)
    INTO _lines
    FROM (
      SELECT p.ord, btrim(p.value) AS text
      FROM unnest(string_to_array(
             regexp_replace(_tj->>'text', '([.!?])\s+', E'\\1\n', 'g'), E'\n'
           )) WITH ORDINALITY AS p(value, ord)
      WHERE btrim(p.value) <> ''
    ) f;
  END IF;

  RETURN jsonb_build_object(
    'take_id', _take_id,
    'song_id', _song_id,
    'status', COALESCE(_status, 'ready'),
    'lines', _lines
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.take_transcript_lines(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.apply_transcript_to_section(
  _section_id uuid,
  _lines text[],
  _mode text DEFAULT 'append'   -- 'append' | 'replace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song_id uuid;
  _existing jsonb := '[]'::jsonb;
  _new jsonb;
  _final jsonb;
  _plain text;
BEGIN
  SELECT song_id INTO _song_id FROM public.song_sections WHERE id = _section_id;
  IF _song_id IS NULL THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_song_write(_song_id);

  IF _mode NOT IN ('append', 'replace') THEN
    RAISE EXCEPTION 'bad_mode' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object('id', gen_random_uuid()::text,
                              'text', btrim(l.value),
                              'anchors', '[]'::jsonb) ORDER BY l.ord), '[]'::jsonb)
  INTO _new
  FROM unnest(COALESCE(_lines, ARRAY[]::text[])) WITH ORDINALITY AS l(value, ord)
  WHERE btrim(l.value) <> '';

  IF jsonb_array_length(_new) = 0 THEN
    RAISE EXCEPTION 'no_lines' USING ERRCODE = '22023';
  END IF;

  IF _mode = 'append' THEN
    SELECT COALESCE(sl.content->'lines', '[]'::jsonb) INTO _existing
    FROM public.song_lyrics sl WHERE sl.section_id = _section_id;
    _final := COALESCE(_existing, '[]'::jsonb) || _new;
  ELSE
    _final := _new;
  END IF;

  SELECT string_agg(x->>'text', E'\n') INTO _plain
  FROM jsonb_array_elements(_final) AS x;

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id)
  VALUES (_song_id, _section_id, jsonb_build_object('v', 1, 'lines', _final),
          COALESCE(_plain, ''), _uid)
  ON CONFLICT (section_id) DO UPDATE
    SET content = EXCLUDED.content,
        plain_text = EXCLUDED.plain_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now();

  PERFORM public.log_song_activity(_song_id, 'transcript_applied', 'song_section', _section_id,
    jsonb_build_object('mode', _mode, 'line_count', jsonb_array_length(_new)));

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN jsonb_build_object(
    'section_id', _section_id,
    'mode', _mode,
    'added', jsonb_array_length(_new),
    'total', jsonb_array_length(_final)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_transcript_to_section(uuid, text[], text) TO authenticated;
