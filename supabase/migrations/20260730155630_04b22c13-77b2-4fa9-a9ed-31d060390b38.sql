create or replace function public.song_room_bootstrap(_song_id uuid, _card_limit int default 400)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _role text;
  _seen timestamptz;
  _out jsonb;
begin
  if _uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not public.is_song_member(_song_id, _uid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  _role := public.song_role(_song_id, _uid)::text;

  select last_seen_at into _seen
  from public.song_notification_prefs
  where song_id = _song_id and user_id = _uid;

  select jsonb_build_object(
    'song', (select to_jsonb(s) from public.songs s where s.id = _song_id),
    'my_role', _role,
    'last_seen_at', _seen,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', m.joined_at,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'avatar_color', p.avatar_color
      ) order by m.joined_at)
      from public.song_members m
      left join public.profiles p on p.user_id = m.user_id
      where m.song_id = _song_id
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.position, c.created_at)
      from (
        select * from public.canvas_cards
        where song_id = _song_id
          and archived_at is null
        order by position, created_at
        limit greatest(_card_limit, 1)
      ) c
    ), '[]'::jsonb),
    'memos', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.created_at desc)
      from public.voice_memos v
      where v.song_id = _song_id
    ), '[]'::jsonb),
    'captures', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at desc)
      from public.idea_captures i
      where i.song_id = _song_id
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(sec) order by sec.position)
      from public.song_sections sec
      where sec.song_id = _song_id
    ), '[]'::jsonb),
    'unseen_activity_count', (
      select count(*) from public.song_activity a
      where a.song_id = _song_id
        and (_seen is null or a.created_at > _seen)
        and a.actor_user_id is distinct from _uid
    )
  ) into _out;

  return _out;
end;
$$;

CREATE OR REPLACE FUNCTION public.song_room_search(
  _song_id uuid,
  _q text,
  _limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _term text := trim(COALESCE(_q, ''));
  _rows jsonb;
  _lim integer := LEAST(GREATEST(COALESCE(_limit, 40), 1), 100);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(_term) < 2 THEN
    RETURN jsonb_build_object('q', _term, 'results', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.rank DESC, r.updated_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      c.id, c.kind, c.label, c.body, c.section_kind, c.section_label,
      c.tree_kind, c.created_by, c.take_id, c.updated_at,
      (CASE WHEN COALESCE(c.label, '') ILIKE _term || '%' THEN 100 ELSE 0 END
       + CASE WHEN COALESCE(c.label, '') ILIKE '%' || _term || '%' THEN 60 ELSE 0 END
       + CASE WHEN COALESCE(c.body, '') ILIKE _term || '%' THEN 40 ELSE 0 END
       + CASE WHEN COALESCE(c.body, '') ILIKE '%' || _term || '%' THEN 25 ELSE 0 END
       + CASE WHEN COALESCE(c.section_label, '') ILIKE '%' || _term || '%' THEN 15 ELSE 0 END
      )::int AS rank
    FROM public.canvas_cards c
    WHERE c.song_id = _song_id
      AND c.archived_at IS NULL
      AND (
        COALESCE(c.body, '') ILIKE '%' || _term || '%'
        OR COALESCE(c.label, '') ILIKE '%' || _term || '%'
        OR COALESCE(c.section_label, '') ILIKE '%' || _term || '%'
      )
    ORDER BY rank DESC, c.updated_at DESC
    LIMIT _lim
  ) r;

  RETURN jsonb_build_object('q', _term, 'results', _rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.song_section_summary(_song_id uuid)
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
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.card_count DESC), '[]'::jsonb) INTO _rows
  FROM (
    SELECT
      COALESCE(NULLIF(trim(c.section_label), ''), c.section_kind::text, 'Unfiled') AS section,
      c.tree_kind,
      count(*)::int AS card_count,
      max(c.updated_at) AS last_activity_at
    FROM public.canvas_cards c
    WHERE c.song_id = _song_id
      AND c.archived_at IS NULL
    GROUP BY 1, 2
  ) s;

  RETURN jsonb_build_object('sections', _rows);
END;
$$;