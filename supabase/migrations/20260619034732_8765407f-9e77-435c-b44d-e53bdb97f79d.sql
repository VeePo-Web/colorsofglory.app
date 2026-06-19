
-- 1. Schema additions
ALTER TABLE public.canvas_cards
  ADD COLUMN IF NOT EXISTS parent_card_id uuid NULL REFERENCES public.canvas_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid NULL,
  ADD COLUMN IF NOT EXISTS tree_kind text NOT NULL DEFAULT 'ideas',
  ADD COLUMN IF NOT EXISTS section_label text NULL,
  ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'canvas_cards_tree_kind_check') THEN
    ALTER TABLE public.canvas_cards
      ADD CONSTRAINT canvas_cards_tree_kind_check CHECK (tree_kind IN ('ideas','final'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS canvas_cards_song_tree_idx ON public.canvas_cards (song_id, tree_kind);
CREATE INDEX IF NOT EXISTS canvas_cards_parent_idx ON public.canvas_cards (song_id, parent_card_id);
CREATE INDEX IF NOT EXISTS canvas_cards_group_idx ON public.canvas_cards (song_id, group_id);

-- 2. Helper: assert caller can write to a song
CREATE OR REPLACE FUNCTION public._assert_canvas_write(_song_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r song_member_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;
  r := public.song_role(_song_id, auth.uid());
  IF r IS NULL THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;
  IF r NOT IN ('owner','collaborator') THEN
    RAISE EXCEPTION 'insufficient_role' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- 3. Move a single card
CREATE OR REPLACE FUNCTION public.canvas_move_card(
  _card_id uuid, _x real, _y real, _z_index integer DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  UPDATE public.canvas_cards
     SET x = _x, y = _y,
         z_index = COALESCE(_z_index, z_index),
         updated_at = now()
   WHERE id = _card_id
   RETURNING * INTO c;
  RETURN c;
END;
$$;

-- 4. Bulk move: payload jsonb array of {id, x, y, z?}
CREATE OR REPLACE FUNCTION public.canvas_bulk_move(_payload jsonb)
RETURNS integer
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  song uuid;
  n integer := 0;
BEGIN
  IF jsonb_typeof(_payload) <> 'array' THEN
    RAISE EXCEPTION 'payload_must_be_array' USING ERRCODE = '22023';
  END IF;
  -- Confirm all rows belong to one song the caller can write
  SELECT DISTINCT cc.song_id INTO song
  FROM public.canvas_cards cc
  WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e);
  IF song IS NULL THEN RETURN 0; END IF;
  IF (SELECT count(DISTINCT cc.song_id)
        FROM public.canvas_cards cc
       WHERE cc.id IN (SELECT (e->>'id')::uuid FROM jsonb_array_elements(_payload) e)) > 1 THEN
    RAISE EXCEPTION 'cross_song_payload' USING ERRCODE = '22023';
  END IF;
  PERFORM public._assert_canvas_write(song);

  WITH src AS (
    SELECT (e->>'id')::uuid AS id,
           (e->>'x')::real  AS x,
           (e->>'y')::real  AS y,
           NULLIF(e->>'z','')::integer AS z
    FROM jsonb_array_elements(_payload) e
  )
  UPDATE public.canvas_cards cc
     SET x = src.x, y = src.y,
         z_index = COALESCE(src.z, cc.z_index),
         updated_at = now()
    FROM src
   WHERE cc.id = src.id AND cc.song_id = song;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 5. Link cards (parent_id -> child_id) — same song, no cycles
CREATE OR REPLACE FUNCTION public.canvas_link_cards(_parent_id uuid, _child_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ps uuid; cs uuid;
  walker uuid; depth int := 0;
  result public.canvas_cards;
BEGIN
  IF _parent_id = _child_id THEN
    RAISE EXCEPTION 'self_link_forbidden' USING ERRCODE = '22023';
  END IF;
  SELECT song_id INTO ps FROM public.canvas_cards WHERE id = _parent_id;
  SELECT song_id INTO cs FROM public.canvas_cards WHERE id = _child_id;
  IF ps IS NULL OR cs IS NULL THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  IF ps <> cs THEN RAISE EXCEPTION 'cross_song_link_forbidden' USING ERRCODE = '22023'; END IF;
  PERFORM public._assert_canvas_write(ps);

  -- Cycle detect: walk up from parent, fail if we hit child
  walker := _parent_id;
  WHILE walker IS NOT NULL AND depth < 64 LOOP
    IF walker = _child_id THEN
      RAISE EXCEPTION 'cycle_forbidden' USING ERRCODE = '22023';
    END IF;
    SELECT parent_card_id INTO walker FROM public.canvas_cards WHERE id = walker;
    depth := depth + 1;
  END LOOP;

  UPDATE public.canvas_cards
     SET parent_card_id = _parent_id, updated_at = now()
   WHERE id = _child_id
   RETURNING * INTO result;
  RETURN result;
END;
$$;

-- 6. Unlink a card
CREATE OR REPLACE FUNCTION public.canvas_unlink_card(_card_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  UPDATE public.canvas_cards
     SET parent_card_id = NULL, updated_at = now()
   WHERE id = _card_id
   RETURNING * INTO c;
  RETURN c;
END;
$$;

-- 7. Group cards together (assigns a fresh group_id to all listed cards in one song)
CREATE OR REPLACE FUNCTION public.canvas_group_cards(_card_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  song uuid;
  new_group uuid := gen_random_uuid();
BEGIN
  IF _card_ids IS NULL OR array_length(_card_ids,1) IS NULL THEN
    RAISE EXCEPTION 'empty_card_ids' USING ERRCODE = '22023';
  END IF;
  SELECT DISTINCT cc.song_id INTO song FROM public.canvas_cards cc WHERE cc.id = ANY(_card_ids);
  IF (SELECT count(DISTINCT cc.song_id) FROM public.canvas_cards cc WHERE cc.id = ANY(_card_ids)) > 1 THEN
    RAISE EXCEPTION 'cross_song_group_forbidden' USING ERRCODE = '22023';
  END IF;
  IF song IS NULL THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(song);
  UPDATE public.canvas_cards SET group_id = new_group, updated_at = now()
   WHERE id = ANY(_card_ids);
  RETURN new_group;
END;
$$;

-- 8. Set section label and/or tree kind
CREATE OR REPLACE FUNCTION public.canvas_set_section(
  _card_id uuid, _section_label text, _tree_kind text DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.canvas_cards;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);
  IF _tree_kind IS NOT NULL AND _tree_kind NOT IN ('ideas','final') THEN
    RAISE EXCEPTION 'invalid_tree_kind' USING ERRCODE = '22023';
  END IF;
  UPDATE public.canvas_cards
     SET section_label = _section_label,
         tree_kind = COALESCE(_tree_kind, tree_kind),
         updated_at = now()
   WHERE id = _card_id
   RETURNING * INTO c;
  RETURN c;
END;
$$;

-- 9. Promote a card to the final tree (clones it, preserves origin)
CREATE OR REPLACE FUNCTION public.canvas_promote_to_final(_card_id uuid)
RETURNS public.canvas_cards
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.canvas_cards;
  dst public.canvas_cards;
BEGIN
  SELECT * INTO src FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public._assert_canvas_write(src.song_id);

  INSERT INTO public.canvas_cards (
    song_id, created_by, take_id, kind, section_kind, label, body,
    start_ms, end_ms, position, x, y,
    parent_card_id, group_id, tree_kind, section_label, z_index
  ) VALUES (
    src.song_id, auth.uid(), src.take_id, src.kind, src.section_kind, src.label, src.body,
    src.start_ms, src.end_ms, src.position, src.x, src.y,
    src.id, src.group_id, 'final', src.section_label, src.z_index
  )
  RETURNING * INTO dst;
  RETURN dst;
END;
$$;

-- 10. Grants
GRANT EXECUTE ON FUNCTION public.canvas_move_card(uuid, real, real, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_bulk_move(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_link_cards(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_unlink_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_group_cards(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_set_section(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_promote_to_final(uuid) TO authenticated;
-- _assert_canvas_write is internal; do not grant.
REVOKE ALL ON FUNCTION public._assert_canvas_write(uuid) FROM PUBLIC;
