CREATE OR REPLACE FUNCTION public.capture_idea(
  _song_id uuid,
  _client_key text,
  _body text DEFAULT NULL,
  _section_id uuid DEFAULT NULL,
  _take_id uuid DEFAULT NULL
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
  _card_id uuid;
  _line_id uuid;
  _text text := NULLIF(btrim(COALESCE(_body, '')), '');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _client_key IS NULL OR btrim(_client_key) = '' THEN
    RAISE EXCEPTION 'client_key_required' USING ERRCODE = '22023';
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

  -- Idempotency: same client key in this song is the same capture.
  SELECT c.id INTO _card_id
    FROM public.canvas_cards c
   WHERE c.song_id = _song_id
     AND c.client_key = _client_key
   LIMIT 1;

  IF _card_id IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'card', 'card_id', _card_id, 'section_id', _section_id);
  END IF;

  -- Typed capture with a section in view: it becomes a lyric line in that part.
  IF _take_id IS NULL AND _text IS NOT NULL AND _section_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.song_sections ss
                  WHERE ss.id = _section_id AND ss.song_id = _song_id) THEN
    INSERT INTO public.lyric_lines (section_id, text, position, created_by)
    SELECT _section_id,
           _text,
           COALESCE(MAX(l.position), 0) + 1,
           _uid
      FROM public.lyric_lines l
     WHERE l.section_id = _section_id
    RETURNING id INTO _line_id;

    RETURN jsonb_build_object('kind', 'line', 'line_id', _line_id, 'section_id', _section_id);
  END IF;

  -- Otherwise it lands at the top of the ideas shelf.
  UPDATE public.canvas_cards
     SET position = position + 1
   WHERE song_id = _song_id AND archived_at IS NULL;

  INSERT INTO public.canvas_cards (
    song_id, client_key, kind, body, take_id, position, x, y, created_by
  ) VALUES (
    _song_id,
    _client_key,
    CASE WHEN _take_id IS NOT NULL THEN 'audio' ELSE 'text' END,
    _text,
    _take_id,
    1,
    0,
    0,
    _uid
  )
  RETURNING id INTO _card_id;

  RETURN jsonb_build_object('kind', 'card', 'card_id', _card_id, 'section_id', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_idea(uuid, text, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_idea(uuid, text, text, uuid, uuid) TO authenticated;