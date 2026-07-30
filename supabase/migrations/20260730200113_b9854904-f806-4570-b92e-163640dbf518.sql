ALTER TABLE public.canvas_cards
  ADD COLUMN IF NOT EXISTS moved_by uuid,
  ADD COLUMN IF NOT EXISTS moved_at timestamptz;

CREATE OR REPLACE FUNCTION public.canvas_move_card(
  _card_id uuid, _x real, _y real, _z_index integer DEFAULT NULL,
  _client_ts timestamptz DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE c public.canvas_cards; ts timestamptz := COALESCE(_client_ts, now());
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);

  -- Stale-move guard: a slow request must never undo a newer move by someone else.
  IF c.moved_at IS NOT NULL AND c.moved_at > ts AND c.moved_by IS DISTINCT FROM auth.uid() THEN
    RETURN c;
  END IF;

  UPDATE public.canvas_cards
     SET x = _x, y = _y, z_index = COALESCE(_z_index, z_index),
         moved_by = auth.uid(), moved_at = ts, updated_at = now()
   WHERE id = _card_id RETURNING * INTO c;
  -- Deliberately NO activity log: position is not a creative event.
  RETURN c;
END; $$;

CREATE OR REPLACE FUNCTION public.canvas_bulk_move(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE song uuid; n integer := 0;
BEGIN
  IF jsonb_typeof(_payload) <> 'array' THEN
    RAISE EXCEPTION 'payload_must_be_array' USING ERRCODE = '22023';
  END IF;
  SELECT DISTINCT cc.song_id INTO song FROM public.canvas_cards cc
   WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e);
  IF song IS NULL THEN RETURN 0; END IF;
  IF (SELECT count(DISTINCT cc.song_id) FROM public.canvas_cards cc
      WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e)) > 1 THEN
    RAISE EXCEPTION 'cross_song_payload' USING ERRCODE = '22023';
  END IF;
  PERFORM public._assert_canvas_write(song);
  WITH src AS (
    SELECT (e->>'id')::uuid AS id, (e->>'x')::real AS x, (e->>'y')::real AS y,
           NULLIF(e->>'z','')::integer AS z
    FROM jsonb_array_elements(_payload) e
  )
  UPDATE public.canvas_cards cc
     SET x = src.x, y = src.y, z_index = COALESCE(src.z, cc.z_index),
         moved_by = auth.uid(), moved_at = now(), updated_at = now()
    FROM src WHERE cc.id = src.id AND cc.song_id = song;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.canvas_move_card(uuid, real, real, integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.canvas_move_card(uuid, real, real, integer, timestamptz) TO authenticated;