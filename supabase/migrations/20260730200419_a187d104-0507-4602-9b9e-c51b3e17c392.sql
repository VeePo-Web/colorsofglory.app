CREATE OR REPLACE FUNCTION public.save_section_lyrics_merged(
  _song_id uuid,
  _section_id uuid,
  _base jsonb,
  _content jsonb,
  _plain_text text DEFAULT NULL,
  _label text DEFAULT NULL,
  _position integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _locked boolean;
  _now timestamptz := now();
  _row public.song_lyrics%ROWTYPE;
  _server jsonb;
  _base_lines jsonb := COALESCE(_base -> 'lines', '[]'::jsonb);
  _mine jsonb := COALESCE(_content -> 'lines', '[]'::jsonb);
  _srv_lines jsonb;
  _out jsonb := '[]'::jsonb;
  _m jsonb;
  _s jsonb;
  _b jsonb;
  _lid text;
  _merged int := 0;
  _suggested int := 0;
  _kept_theirs int := 0;
  _seen text[] := '{}';
  _plain text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT s.is_locked INTO _locked FROM public.songs s WHERE s.id = _song_id;
  IF _locked IS NULL THEN
    RAISE EXCEPTION 'song_not_found' USING ERRCODE = 'P0002';
  END IF;

  _role := public.song_role(_song_id, _uid);
  IF _role IS NULL OR _role NOT IN ('owner', 'collaborator') THEN
    RAISE EXCEPTION 'view_only' USING ERRCODE = '42501';
  END IF;
  IF _locked AND _role <> 'owner' THEN
    RAISE EXCEPTION 'song_locked' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.song_sections WHERE id = _section_id AND song_id = _song_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO _row
    FROM public.song_lyrics
   WHERE section_id = _section_id AND song_id = _song_id
   FOR UPDATE;

  _server := COALESCE(_row.content, '{}'::jsonb);
  _srv_lines := COALESCE(_server -> 'lines', '[]'::jsonb);

  -- Fast path: no server row, or server untouched since this editor loaded.
  IF _row.section_id IS NULL OR _srv_lines = _base_lines OR _row.updated_by_user_id = _uid THEN
    _out := _mine;
    _merged := jsonb_array_length(_mine);
  ELSE
    -- Walk my lines in my order; reconcile each against base + server.
    FOR _m IN SELECT * FROM jsonb_array_elements(_mine) LOOP
      _lid := _m ->> 'id';
      _seen := _seen || _lid;
      SELECT e INTO _s FROM jsonb_array_elements(_srv_lines) e WHERE e ->> 'id' = _lid LIMIT 1;
      SELECT e INTO _b FROM jsonb_array_elements(_base_lines) e WHERE e ->> 'id' = _lid LIMIT 1;

      IF _s IS NULL THEN
        IF _b IS NULL THEN
          _out := _out || jsonb_build_array(_m);   -- line I just wrote
          _merged := _merged + 1;
        END IF;
        -- else: they deleted it while I held it -> respect the deletion
      ELSIF _b IS NULL OR _m = _b THEN
        _out := _out || jsonb_build_array(_s);     -- I did not touch it
      ELSIF _s = _b OR _s = _m THEN
        _out := _out || jsonb_build_array(_m);     -- only I touched it
        _merged := _merged + 1;
      ELSE
        -- Both touched the same line: their text stays, mine becomes a suggestion.
        _out := _out || jsonb_build_array(_s);
        _kept_theirs := _kept_theirs + 1;
        INSERT INTO public.lyric_suggestions
          (song_id, section_id, line_id, original_text, suggested_text, author_user_id, status)
        VALUES
          (_song_id, _section_id, _lid, COALESCE(_s ->> 'text', ''), COALESCE(_m ->> 'text', ''), _uid, 'open');
        _suggested := _suggested + 1;
      END IF;
      _s := NULL; _b := NULL;
    END LOOP;

    -- Lines that exist on the server but never passed through my editor:
    -- either they added them just now, or I deleted a line they had edited.
    FOR _s IN SELECT * FROM jsonb_array_elements(_srv_lines) LOOP
      _lid := _s ->> 'id';
      CONTINUE WHEN _lid = ANY(_seen);
      SELECT e INTO _b FROM jsonb_array_elements(_base_lines) e WHERE e ->> 'id' = _lid LIMIT 1;
      IF _b IS NULL OR _b IS DISTINCT FROM _s THEN
        _out := _out || jsonb_build_array(_s);
      END IF;
      _b := NULL;
    END LOOP;
  END IF;

  SELECT string_agg(COALESCE(e ->> 'text', ''), E'\n' ORDER BY ord)
    INTO _plain
    FROM jsonb_array_elements(_out) WITH ORDINALITY AS t(e, ord);

  IF _label IS NOT NULL OR _position IS NOT NULL THEN
    UPDATE public.song_sections
       SET label = COALESCE(_label, label),
           position = COALESCE(_position, position),
           updated_at = _now
     WHERE id = _section_id AND song_id = _song_id;
  END IF;

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id, created_at, updated_at)
  VALUES (_song_id, _section_id, jsonb_build_object('v', 1, 'lines', _out), COALESCE(_plain, ''), _uid, _now, _now)
  ON CONFLICT (section_id) DO UPDATE
    SET content = EXCLUDED.content,
        plain_text = EXCLUDED.plain_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = EXCLUDED.updated_at;

  UPDATE public.songs SET last_activity_at = _now, updated_at = _now WHERE id = _song_id;

  RETURN jsonb_build_object(
    'status', 'saved',
    'section_id', _section_id,
    'updated_at', _now,
    'updated_by_user_id', _uid,
    'content', jsonb_build_object('v', 1, 'lines', _out),
    'plain_text', COALESCE(_plain, ''),
    'merged_lines', _merged,
    'kept_theirs', _kept_theirs,
    'suggestions_created', _suggested
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_section_lyrics_merged(uuid, uuid, jsonb, jsonb, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_section_lyrics_merged(uuid, uuid, jsonb, jsonb, text, text, integer) TO authenticated;