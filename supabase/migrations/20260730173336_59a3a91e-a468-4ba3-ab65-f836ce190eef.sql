
CREATE OR REPLACE FUNCTION public.song_feed(
  _song_id uuid,
  _limit integer DEFAULT 40,
  _before timestamptz DEFAULT NULL
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
  _last_seen timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT last_seen_at INTO _last_seen
  FROM public.song_notification_prefs
  WHERE song_id = _song_id AND user_id = _uid;

  WITH base AS (
    SELECT a.id, a.kind, a.entity_type, a.entity_id, a.actor_user_id, a.created_at
    FROM public.song_activity a
    WHERE a.song_id = _song_id
      AND (_before IS NULL OR a.created_at < _before)
    ORDER BY a.created_at DESC
    LIMIT GREATEST(LEAST(COALESCE(_limit, 40), 200), 1) * 3
  ),
  marked AS (
    SELECT b.*,
      CASE WHEN lag(b.kind) OVER w IS NOT DISTINCT FROM b.kind
            AND lag(b.actor_user_id) OVER w IS NOT DISTINCT FROM b.actor_user_id
            AND lag(b.created_at) OVER w - b.created_at < interval '10 minutes'
           THEN 0 ELSE 1 END AS is_new_group
    FROM base b
    WINDOW w AS (ORDER BY b.created_at DESC)
  ),
  grouped AS (
    SELECT m.*, sum(m.is_new_group) OVER (ORDER BY m.created_at DESC ROWS UNBOUNDED PRECEDING) AS grp
    FROM marked m
  ),
  collapsed AS (
    SELECT
      min(g.id::text) AS row_key,
      g.grp,
      max(g.kind) AS kind,
      max(g.entity_type) AS entity_type,
      (array_agg(g.entity_id ORDER BY g.created_at DESC))[1] AS entity_id,
      max(g.actor_user_id::text)::uuid AS actor_user_id,
      count(*)::int AS event_count,
      max(g.created_at) AS created_at
    FROM grouped g
    GROUP BY g.grp
    ORDER BY max(g.created_at) DESC
    LIMIT GREATEST(LEAST(COALESCE(_limit, 40), 200), 1)
  )
  SELECT COALESCE(jsonb_agg(row_json ORDER BY created_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT c.created_at, jsonb_build_object(
      'row_key', c.row_key,
      'kind', c.kind,
      'entity_type', c.entity_type,
      'entity_id', c.entity_id,
      'event_count', c.event_count,
      'created_at', c.created_at,
      'is_unseen', (_last_seen IS NULL OR c.created_at > _last_seen),
      'is_you', (c.actor_user_id = _uid),
      'actor', CASE WHEN c.actor_user_id IS NULL THEN NULL ELSE jsonb_build_object(
          'user_id', c.actor_user_id,
          'name', COALESCE(NULLIF(trim(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), p.display_name, 'Someone'),
          'avatar_url', p.avatar_url,
          'avatar_color', p.avatar_color
        ) END,
      'label', CASE c.entity_type
          WHEN 'song_section' THEN COALESCE(sec.label, initcap(replace(sec.kind::text, '_', ' ')))
          WHEN 'canvas_card' THEN COALESCE(NULLIF(cc.label,''), NULLIF(cc.section_label,''), left(COALESCE(cc.body,''), 40))
          WHEN 'take' THEN COALESCE(tk.friendly_name, 'a take')
          WHEN 'voice_memo' THEN COALESCE(vm.title, 'a recording')
          WHEN 'song_note' THEN left(COALESCE(sn.body,''), 40)
          ELSE NULL
        END,
      'target', CASE c.entity_type
          WHEN 'song_section' THEN jsonb_build_object('view','sheet','id', c.entity_id)
          WHEN 'canvas_card' THEN jsonb_build_object('view','canvas','id', c.entity_id)
          WHEN 'take' THEN jsonb_build_object('view','takes','id', c.entity_id)
          WHEN 'voice_memo' THEN jsonb_build_object('view','takes','id', c.entity_id)
          WHEN 'song_note' THEN jsonb_build_object('view','notes','id', c.entity_id)
          WHEN 'lyric_suggestion' THEN jsonb_build_object('view','suggestions','id', c.entity_id)
          WHEN 'song_member' THEN jsonb_build_object('view','people','id', c.entity_id)
          ELSE NULL
        END
    ) AS row_json
    FROM collapsed c
    LEFT JOIN public.profiles p ON p.user_id = c.actor_user_id
    LEFT JOIN public.song_sections sec ON c.entity_type = 'song_section' AND sec.id = c.entity_id
    LEFT JOIN public.canvas_cards cc ON c.entity_type = 'canvas_card' AND cc.id = c.entity_id
    LEFT JOIN public.takes tk ON c.entity_type = 'take' AND tk.id = c.entity_id
    LEFT JOIN public.voice_memos vm ON c.entity_type = 'voice_memo' AND vm.id = c.entity_id
    LEFT JOIN public.song_notes sn ON c.entity_type = 'song_note' AND sn.id = c.entity_id
  ) s;

  RETURN jsonb_build_object(
    'song_id', _song_id,
    'last_seen_at', _last_seen,
    'rows', _rows,
    'has_more', (jsonb_array_length(_rows) >= GREATEST(LEAST(COALESCE(_limit, 40), 200), 1))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_feed(uuid, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_feed(uuid, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_feed(uuid, integer, timestamptz) TO service_role;
