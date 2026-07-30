
CREATE OR REPLACE FUNCTION public.merge_cards_into_section(
  _song_id uuid,
  _card_ids uuid[],
  _kind public.section_kind DEFAULT 'verse',
  _label text DEFAULT NULL,
  _archive_sources boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _section_id uuid;
  _position int;
  _lines jsonb;
  _plain text;
  _used int;
BEGIN
  PERFORM public._assert_song_write(_song_id);

  IF _card_ids IS NULL OR array_length(_card_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_cards' USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(jsonb_agg(l.line ORDER BY l.card_ord, l.line_ord), '[]'::jsonb),
    COALESCE(string_agg(l.text, E'\n' ORDER BY l.card_ord, l.line_ord), ''),
    count(DISTINCT l.card_id)::int
  INTO _lines, _plain, _used
  FROM (
    SELECT
      c.id AS card_id,
      pick.ord AS card_ord,
      ln.ord AS line_ord,
      btrim(ln.value) AS text,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'text', btrim(ln.value),
        'anchors', '[]'::jsonb
      ) AS line
    FROM unnest(_card_ids) WITH ORDINALITY AS pick(card_id, ord)
    JOIN public.canvas_cards c
      ON c.id = pick.card_id AND c.song_id = _song_id AND c.archived_at IS NULL
    CROSS JOIN LATERAL unnest(string_to_array(COALESCE(c.body, ''), E'\n')) WITH ORDINALITY AS ln(value, ord)
    WHERE btrim(ln.value) <> ''
  ) l;

  IF COALESCE(_used, 0) = 0 THEN
    RAISE EXCEPTION 'no_usable_cards' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(max(position), -1) + 1 INTO _position
  FROM public.song_sections WHERE song_id = _song_id;

  INSERT INTO public.song_sections (song_id, kind, label, position, created_by_user_id)
  VALUES (_song_id, _kind, NULLIF(btrim(COALESCE(_label, '')), ''), _position, _uid)
  RETURNING id INTO _section_id;

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id)
  VALUES (_song_id, _section_id, jsonb_build_object('v', 1, 'lines', _lines), _plain, _uid);

  UPDATE public.canvas_cards
     SET section_label = COALESCE(NULLIF(btrim(COALESCE(_label, '')), ''), _kind::text),
         archived_at = CASE WHEN _archive_sources THEN now() ELSE archived_at END,
         archived_by = CASE WHEN _archive_sources THEN _uid ELSE archived_by END,
         updated_at = now()
   WHERE song_id = _song_id AND id = ANY(_card_ids);

  PERFORM public.log_song_activity(_song_id, 'cards_merged_into_section', 'song_section', _section_id,
    jsonb_build_object('card_count', _used, 'kind', _kind::text, 'archived_sources', _archive_sources));

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN jsonb_build_object(
    'section_id', _section_id,
    'position', _position,
    'kind', _kind::text,
    'label', NULLIF(btrim(COALESCE(_label, '')), ''),
    'line_count', jsonb_array_length(_lines),
    'cards_used', _used
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_cards_into_section(uuid, uuid[], public.section_kind, text, boolean) TO authenticated;
