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
    ),
    -- R50: the extras the room paints on entry, folded into the same trip.
    'feed_preview', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'kind', f.kind,
        'entity_type', f.entity_type,
        'entity_id', f.entity_id,
        'created_at', f.created_at,
        'is_you', f.actor_user_id is not distinct from _uid,
        'is_unseen', (_seen is null or f.created_at > _seen)
                     and f.actor_user_id is distinct from _uid,
        'actor', case when f.actor_user_id is null then null else jsonb_build_object(
          'user_id', f.actor_user_id,
          'name', coalesce(fp.display_name, 'Someone'),
          'avatar_url', fp.avatar_url,
          'avatar_color', fp.avatar_color
        ) end
      ) order by f.created_at desc)
      from (
        select * from public.song_activity a
        where a.song_id = _song_id
        order by a.created_at desc
        limit 5
      ) f
      left join public.profiles fp on fp.user_id = f.actor_user_id
    ), '[]'::jsonb),
    'pending_invite_count', (
      select count(*) from public.song_invites i
      where i.song_id = _song_id
        and i.status = 'pending'
        and i.expires_at > now()
    ),
    'open_suggestion_count', (
      select count(*) from public.lyric_suggestions ls
      where ls.song_id = _song_id and ls.status = 'open'
    ),
    'unfiled_memo_count', (
      select count(*) from public.voice_memos v
      where v.song_id = _song_id
        and v.section_id is null
        and v.status <> 'deleted'
    ),
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'card_id', r.card_id,
        'kind', r.kind,
        'count', r.n,
        'mine', r.mine
      ))
      from (
        select cr.card_id, cr.kind, count(*)::int as n,
               bool_or(cr.user_id = _uid) as mine
        from public.card_reactions cr
        where cr.song_id = _song_id
        group by cr.card_id, cr.kind
      ) r
    ), '[]'::jsonb)
  ) into _out;

  return _out;
end;
$$;