
CREATE OR REPLACE FUNCTION public.song_recently_removed(
  _song_id uuid,
  _limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _lim integer := GREATEST(LEAST(COALESCE(_limit, 50), 200), 1);
  _rows jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH items AS (
    SELECT 'card'::text AS kind, cc.id,
           COALESCE(NULLIF(cc.label,''), left(COALESCE(cc.body,''), 60), 'Idea') AS title,
           cc.archived_at AS removed_at, cc.archived_by AS removed_by
    FROM public.canvas_cards cc
    WHERE cc.song_id = _song_id AND cc.archived_at IS NOT NULL
      AND cc.archived_at > now() - interval '30 days'

    UNION ALL
    SELECT 'note', sn.id, left(COALESCE(sn.body,''), 60), sn.archived_at, sn.archived_by_user_id
    FROM public.song_notes sn
    WHERE sn.song_id = _song_id AND sn.archived_at IS NOT NULL
      AND sn.archived_at > now() - interval '30 days'

    UNION ALL
    SELECT 'capture', ic.id, COALESCE(ic.title, left(COALESCE(ic.lyric_snippet,''), 60), 'Captured idea'),
           ic.archived_at, ic.archived_by
    FROM public.idea_captures ic
    WHERE ic.song_id = _song_id AND ic.archived_at IS NOT NULL
      AND ic.archived_at > now() - interval '30 days'

    UNION ALL
    SELECT 'take', tk.id, COALESCE(tk.friendly_name, 'Take'), tk.updated_at, tk.created_by
    FROM public.takes tk
    WHERE tk.song_id = _song_id AND tk.is_archived = true
      AND tk.updated_at > now() - interval '30 days'
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', i.kind,
    'id', i.id,
    'title', i.title,
    'removed_at', i.removed_at,
    'removed_by', CASE WHEN i.removed_by IS NULL THEN NULL ELSE jsonb_build_object(
        'user_id', i.removed_by,
        'name', COALESCE(NULLIF(btrim(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), p.display_name, 'Someone'),
        'avatar_color', p.avatar_color) END,
    'is_you', (i.removed_by = _uid)
  ) ORDER BY i.removed_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (SELECT * FROM items ORDER BY removed_at DESC LIMIT _lim) i
  LEFT JOIN public.profiles p ON p.user_id = i.removed_by;

  RETURN jsonb_build_object('song_id', _song_id, 'rows', _rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_song_item(
  _song_id uuid,
  _kind text,
  _id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public._assert_song_write(_song_id);

  IF _kind = 'card' THEN
    UPDATE public.canvas_cards
       SET archived_at = NULL, archived_by = NULL, updated_at = now()
     WHERE id = _id AND song_id = _song_id AND archived_at IS NOT NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSIF _kind = 'note' THEN
    UPDATE public.song_notes
       SET archived_at = NULL, archived_by_user_id = NULL, updated_at = now()
     WHERE id = _id AND song_id = _song_id AND archived_at IS NOT NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSIF _kind = 'capture' THEN
    UPDATE public.idea_captures
       SET archived_at = NULL, archived_by = NULL, updated_at = now()
     WHERE id = _id AND song_id = _song_id AND archived_at IS NOT NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSIF _kind = 'take' THEN
    UPDATE public.takes
       SET is_archived = false, updated_at = now()
     WHERE id = _id AND song_id = _song_id AND is_archived = true;
    GET DIAGNOSTICS _n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'unknown_kind';
  END IF;

  IF _n = 0 THEN RAISE EXCEPTION 'item_not_found'; END IF;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, _uid, 'item_restored',
          CASE _kind WHEN 'card' THEN 'canvas_card' WHEN 'note' THEN 'song_note'
                     WHEN 'capture' THEN 'idea_capture' ELSE 'take' END,
          _id, jsonb_build_object('kind', _kind));

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN jsonb_build_object('kind', _kind, 'id', _id, 'restored', true);
END;
$$;

REVOKE ALL ON FUNCTION public.song_recently_removed(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_recently_removed(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_recently_removed(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.restore_song_item(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_song_item(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_song_item(uuid, text, uuid) TO service_role;
