CREATE OR REPLACE FUNCTION public.canvas_reading_order(_song_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _locked boolean;
  _updated integer := 0;
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

  WITH ordered AS (
    SELECT c.id,
           ROW_NUMBER() OVER (
             ORDER BY
               -- rows of ~200px, then left to right, then oldest first
               FLOOR(COALESCE(c.y, 0)::numeric / 200),
               COALESCE(c.x, 0),
               c.created_at
           ) AS rn
      FROM public.canvas_cards c
     WHERE c.song_id = _song_id
       AND c.archived_at IS NULL
  )
  UPDATE public.canvas_cards c
     SET position = o.rn::integer
    FROM ordered o
   WHERE c.id = o.id
     AND c.position IS DISTINCT FROM o.rn::integer;

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;
$$;

REVOKE ALL ON FUNCTION public.canvas_reading_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_reading_order(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.canvas_reorder_card(
  _card_id uuid,
  _new_position integer
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song_id uuid;
  _role text;
  _locked boolean;
  _old integer;
  _target integer;
  _count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT c.song_id, c.position INTO _song_id, _old
    FROM public.canvas_cards c
   WHERE c.id = _card_id AND c.archived_at IS NULL;
  IF _song_id IS NULL THEN
    RAISE EXCEPTION 'card_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.is_locked INTO _locked FROM public.songs s WHERE s.id = _song_id;
  _role := public.song_role(_song_id, _uid);
  IF _role IS NULL OR _role NOT IN ('owner', 'collaborator') THEN
    RAISE EXCEPTION 'view_only' USING ERRCODE = '42501';
  END IF;
  IF _locked AND _role <> 'owner' THEN
    RAISE EXCEPTION 'song_locked' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO _count
    FROM public.canvas_cards
   WHERE song_id = _song_id AND archived_at IS NULL;

  _target := GREATEST(1, LEAST(COALESCE(_new_position, 1), _count));
  IF _target = _old THEN
    RETURN _target;
  END IF;

  IF _target < _old THEN
    UPDATE public.canvas_cards
       SET position = position + 1
     WHERE song_id = _song_id
       AND archived_at IS NULL
       AND position >= _target
       AND position < _old;
  ELSE
    UPDATE public.canvas_cards
       SET position = position - 1
     WHERE song_id = _song_id
       AND archived_at IS NULL
       AND position > _old
       AND position <= _target;
  END IF;

  UPDATE public.canvas_cards
     SET position = _target,
         moved_by = _uid,
         moved_at = now(),
         updated_at = now()
   WHERE id = _card_id;

  RETURN _target;
END;
$$;

REVOKE ALL ON FUNCTION public.canvas_reorder_card(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_reorder_card(uuid, integer) TO authenticated;