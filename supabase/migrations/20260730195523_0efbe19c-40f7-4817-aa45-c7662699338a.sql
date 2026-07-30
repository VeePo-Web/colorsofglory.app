-- ── Who is in this song, and what colour are they? ─────────────────────────
-- One person = one colour, everywhere they appear (avatar, edit marks, pins,
-- takes). The slot is derived from join order so it is stable for everyone and
-- identical on every device — never hashed per-client.
CREATE OR REPLACE FUNCTION public.song_cast(_song_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  initials text,
  avatar_url text,
  role text,
  color_index integer,
  is_you boolean,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT public.is_song_member(_song_id, auth.uid()) AS ok
  ),
  m AS (
    SELECT
      sm.user_id,
      sm.role::text AS role,
      sm.joined_at,
      row_number() OVER (
        ORDER BY (sm.role::text = 'owner') DESC, sm.joined_at, sm.user_id
      ) - 1 AS slot
    FROM public.song_members sm, guard g
    WHERE g.ok AND sm.song_id = _song_id
  )
  SELECT
    m.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'Someone'),
    upper(
      left(coalesce(nullif(btrim(p.display_name), ''), 'S'), 1) ||
      coalesce(
        left(nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 2), ''), 1),
        ''
      )
    ),
    p.avatar_url,
    m.role,
    (m.slot % 8)::integer,
    m.user_id = auth.uid(),
    m.joined_at
  FROM m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  ORDER BY m.slot;
$$;

REVOKE ALL ON FUNCTION public.song_cast(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_cast(uuid) TO authenticated;

-- ── Where is the conversation happening? ───────────────────────────────────
-- Every note and suggestion, returned as a MARKER on the thing it is about:
-- a lyric line, or a millisecond inside a take. One request, colour already
-- bound, so the room can paint pins without an N+1 storm.
CREATE OR REPLACE FUNCTION public.song_anchors(_song_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT public.is_song_member(_song_id, auth.uid()) AS ok
  ),
  cast_colors AS (
    SELECT c.user_id, c.color_index, c.display_name, c.initials
    FROM public.song_cast(_song_id) c
  ),
  line_marks AS (
    SELECT
      ls.section_id,
      ls.line_id,
      count(*)::int AS open_count,
      min(ls.created_at) AS first_at,
      (array_agg(ls.author_user_id ORDER BY ls.created_at))[1] AS lead_author
    FROM public.lyric_suggestions ls, guard g
    WHERE g.ok AND ls.song_id = _song_id AND ls.status = 'open'
    GROUP BY ls.section_id, ls.line_id
  ),
  take_marks AS (
    SELECT
      n.id AS note_id,
      n.take_id,
      n.at_ms,
      n.author_user_id,
      left(n.body, 90) AS preview,
      n.created_at
    FROM public.song_notes n, guard g
    WHERE g.ok
      AND n.song_id = _song_id
      AND n.take_id IS NOT NULL
      AND n.at_ms IS NOT NULL
      AND n.parent_note_id IS NULL
  ),
  section_marks AS (
    SELECT
      n.section_id,
      count(*)::int AS note_count,
      max(n.created_at) AS latest_at
    FROM public.song_notes n, guard g
    WHERE g.ok
      AND n.song_id = _song_id
      AND n.section_id IS NOT NULL
      AND n.take_id IS NULL
      AND n.parent_note_id IS NULL
    GROUP BY n.section_id
  )
  SELECT jsonb_build_object(
    'lines', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section_id', lm.section_id,
        'line_id', lm.line_id,
        'kind', 'suggestion',
        'count', lm.open_count,
        'author_user_id', lm.lead_author,
        'color_index', coalesce(cc.color_index, 0),
        'author_name', coalesce(cc.display_name, 'Someone'),
        'first_at', lm.first_at
      ) ORDER BY lm.first_at)
      FROM line_marks lm
      LEFT JOIN cast_colors cc ON cc.user_id = lm.lead_author
    ), '[]'::jsonb),
    'moments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'note_id', tm.note_id,
        'take_id', tm.take_id,
        'at_ms', tm.at_ms,
        'author_user_id', tm.author_user_id,
        'color_index', coalesce(cc.color_index, 0),
        'author_name', coalesce(cc.display_name, 'Someone'),
        'preview', tm.preview
      ) ORDER BY tm.take_id, tm.at_ms)
      FROM take_marks tm
      LEFT JOIN cast_colors cc ON cc.user_id = tm.author_user_id
    ), '[]'::jsonb),
    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section_id', sm.section_id,
        'count', sm.note_count,
        'latest_at', sm.latest_at
      ) ORDER BY sm.latest_at DESC)
      FROM section_marks sm
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.song_anchors(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_anchors(uuid) TO authenticated;