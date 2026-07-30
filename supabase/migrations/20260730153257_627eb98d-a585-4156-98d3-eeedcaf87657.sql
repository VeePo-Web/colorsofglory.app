ALTER TABLE public.canvas_cards ADD COLUMN IF NOT EXISTS client_key text;

CREATE UNIQUE INDEX IF NOT EXISTS canvas_cards_song_client_key_uidx
  ON public.canvas_cards(song_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.canvas_upsert_card_idempotent(
  _song_id uuid,
  _client_key text,
  _kind text,
  _body text,
  _label text DEFAULT NULL,
  _section_kind text DEFAULT NULL,
  _section_label text DEFAULT NULL,
  _tree_kind text DEFAULT 'ideas',
  _x numeric DEFAULT NULL,
  _y numeric DEFAULT NULL,
  _parent_card_id uuid DEFAULT NULL,
  _take_id uuid DEFAULT NULL
)
RETURNS public.canvas_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.canvas_cards;
  inserted public.canvas_cards;
BEGIN
  IF _client_key IS NULL OR length(trim(_client_key)) = 0 THEN
    RAISE EXCEPTION 'client_key_required';
  END IF;

  PERFORM public._assert_canvas_write(_song_id);

  SELECT * INTO existing
  FROM public.canvas_cards
  WHERE song_id = _song_id AND client_key = _client_key;

  IF FOUND THEN
    RETURN existing;
  END IF;

  INSERT INTO public.canvas_cards (
    song_id, created_by, client_key, kind, body, label,
    section_kind, section_label, tree_kind, x, y, parent_card_id, take_id, position
  ) VALUES (
    _song_id, auth.uid(), _client_key, _kind, _body, _label,
    _section_kind, _section_label, COALESCE(_tree_kind, 'ideas'),
    _x, _y, _parent_card_id, _take_id, 0
  )
  ON CONFLICT (song_id, client_key) WHERE client_key IS NOT NULL DO NOTHING
  RETURNING * INTO inserted;

  IF inserted.id IS NULL THEN
    SELECT * INTO inserted
    FROM public.canvas_cards
    WHERE song_id = _song_id AND client_key = _client_key;
  END IF;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.canvas_upsert_card_idempotent(uuid, text, text, text, text, text, text, text, numeric, numeric, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_upsert_card_idempotent(uuid, text, text, text, text, text, text, text, numeric, numeric, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.canvas_upsert_card_idempotent(uuid, text, text, text, text, text, text, text, numeric, numeric, uuid, uuid) TO service_role;