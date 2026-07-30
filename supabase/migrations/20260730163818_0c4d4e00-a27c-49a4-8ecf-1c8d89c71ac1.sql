
-- R23: Catalog board -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.song_catalog_board(_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.last_activity_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      s.id,
      s.title,
      s.status,
      s.cover_color,
      s.key_signature,
      s.tempo_bpm,
      s.lyrics_snippet,
      s.is_locked,
      s.last_activity_at,
      s.created_at,
      sm.role AS my_role,
      (s.owner_user_id = _uid) AS is_owner,
      (SELECT count(*) FROM public.song_members m WHERE m.song_id = s.id) AS member_count,
      prefs.last_seen_at,
      (
        SELECT count(*)
        FROM public.song_activity a
        WHERE a.song_id = s.id
          AND a.actor_user_id IS DISTINCT FROM _uid
          AND a.created_at > COALESCE(prefs.last_seen_at, s.created_at)
      ) AS unseen_count,
      (
        SELECT jsonb_build_object(
          'kind', a.kind,
          'actor_name', p.display_name,
          'created_at', a.created_at
        )
        FROM public.song_activity a
        LEFT JOIN public.profiles p ON p.user_id = a.actor_user_id
        WHERE a.song_id = s.id
        ORDER BY a.created_at DESC
        LIMIT 1
      ) AS last_event
    FROM public.songs s
    JOIN public.song_members sm ON sm.song_id = s.id AND sm.user_id = _uid
    LEFT JOIN public.song_notification_prefs prefs
      ON prefs.song_id = s.id AND prefs.user_id = _uid
    WHERE s.status <> 'deleted'
    ORDER BY s.last_activity_at DESC
    LIMIT GREATEST(COALESCE(_limit, 100), 1)
  ) t;

  RETURN jsonb_build_object(
    'songs', _rows,
    'owned_count', (
      SELECT count(*) FROM public.songs s
      WHERE s.owner_user_id = _uid AND s.status = 'active'
    ),
    'total_unseen', (
      SELECT COALESCE(sum((x->>'unseen_count')::int), 0)
      FROM jsonb_array_elements(_rows) x
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_catalog_board(integer) TO authenticated;

-- Mark every song seen ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_all_songs_seen()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.song_notification_prefs (user_id, song_id, last_seen_at)
  SELECT _uid, sm.song_id, now()
  FROM public.song_members sm
  WHERE sm.user_id = _uid
  ON CONFLICT (user_id, song_id)
  DO UPDATE SET last_seen_at = now(), updated_at = now();

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_songs_seen() TO authenticated;
