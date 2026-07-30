CREATE OR REPLACE FUNCTION public.song_feed_grouped(
  _song_id uuid,
  _before timestamptz DEFAULT NULL,
  _limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows jsonb;
  _lim int := LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT a.id, a.actor_user_id, a.kind, a.entity_type, a.entity_id, a.created_at
    FROM public.song_activity a
    WHERE a.song_id = _song_id
      AND (_before IS NULL OR a.created_at < _before)
    ORDER BY a.created_at DESC
    LIMIT 400
  ),
  bucketed AS (
    SELECT b.*,
           to_timestamp(floor(extract(epoch FROM b.created_at) / 600) * 600) AS bucket
    FROM base b
  ),
  grouped AS (
    SELECT
      actor_user_id,
      kind,
      entity_type,
      bucket,
      count(*)::int                        AS item_count,
      max(created_at)                      AS last_at,
      min(created_at)                      AS first_at,
      (array_agg(entity_id ORDER BY created_at DESC))[1:8] AS entity_ids,
      (array_agg(id ORDER BY created_at DESC))[1:8]        AS activity_ids
    FROM bucketed
    GROUP BY actor_user_id, kind, entity_type, bucket
  )
  SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.last_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      g.actor_user_id,
      p.display_name AS actor_name,
      p.avatar_url   AS actor_avatar,
      p.avatar_color AS actor_color,
      g.kind,
      g.entity_type,
      g.item_count,
      g.first_at,
      g.last_at,
      g.entity_ids,
      g.activity_ids,
      (g.actor_user_id IS NOT DISTINCT FROM _uid) AS is_self
    FROM grouped g
    LEFT JOIN public.profiles p ON p.user_id = g.actor_user_id
    ORDER BY g.last_at DESC
    LIMIT _lim
  ) g;

  RETURN jsonb_build_object(
    'entries', _rows,
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_feed_grouped(uuid, timestamptz, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.song_feed_grouped(uuid, timestamptz, integer) TO authenticated;