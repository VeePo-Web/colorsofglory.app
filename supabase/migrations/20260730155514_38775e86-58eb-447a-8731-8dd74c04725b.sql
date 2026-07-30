-- R7: recoverable deletes for canvas cards
ALTER TABLE public.canvas_cards
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS canvas_cards_song_archived_idx
  ON public.canvas_cards (song_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS canvas_cards_song_live_idx
  ON public.canvas_cards (song_id, position)
  WHERE archived_at IS NULL;

-- Archive (soft delete)
CREATE OR REPLACE FUNCTION public.archive_canvas_card(_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);

  UPDATE public.canvas_cards
     SET archived_at = COALESCE(archived_at, now()),
         archived_by = auth.uid(),
         updated_at = now()
   WHERE id = _card_id;

  RETURN jsonb_build_object('id', _card_id, 'song_id', c.song_id, 'archived_at', now());
END;
$$;

-- Restore (undo)
CREATE OR REPLACE FUNCTION public.restore_canvas_card(_card_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM public.canvas_cards WHERE id = _card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_found'; END IF;
  PERFORM public._assert_canvas_write(c.song_id);

  UPDATE public.canvas_cards
     SET archived_at = NULL,
         archived_by = NULL,
         updated_at = now()
   WHERE id = _card_id;

  RETURN jsonb_build_object('id', _card_id, 'song_id', c.song_id, 'restored', true);
END;
$$;

-- Recently archived, newest first (the room's "recently removed" drawer)
CREATE OR REPLACE FUNCTION public.list_archived_canvas_cards(_song_id uuid, _limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.archived_at DESC), '[]'::jsonb)
    INTO result
    FROM (
      SELECT id, song_id, kind, label, body, section_kind, section_label,
             tree_kind, take_id, created_by, archived_at, archived_by
        FROM public.canvas_cards
       WHERE song_id = _song_id
         AND archived_at IS NOT NULL
         AND archived_at > now() - interval '30 days'
       ORDER BY archived_at DESC
       LIMIT GREATEST(1, LEAST(_limit, 200))
    ) t;

  RETURN jsonb_build_object('cards', result);
END;
$$;

-- Hard purge after the 30-day grace window (cron/service use)
CREATE OR REPLACE FUNCTION public.purge_archived_canvas_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.canvas_cards
   WHERE archived_at IS NOT NULL
     AND archived_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_archived_canvas_cards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_archived_canvas_cards() TO service_role;

GRANT EXECUTE ON FUNCTION public.archive_canvas_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_canvas_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_archived_canvas_cards(uuid, int) TO authenticated;