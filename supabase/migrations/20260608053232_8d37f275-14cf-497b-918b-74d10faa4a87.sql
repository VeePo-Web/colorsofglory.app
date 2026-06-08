
-- list_my_songs
CREATE OR REPLACE FUNCTION public.list_my_songs()
RETURNS TABLE (
  id uuid,
  title text,
  cover_color text,
  status song_status,
  last_activity_at timestamptz,
  created_at timestamptz,
  my_role song_member_role,
  voice_memo_count integer,
  collaborator_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.cover_color,
    s.status,
    s.last_activity_at,
    s.created_at,
    sm.role AS my_role,
    COALESCE((SELECT COUNT(*)::int FROM public.voice_memos vm WHERE vm.song_id = s.id), 0) AS voice_memo_count,
    COALESCE((SELECT COUNT(*)::int FROM public.song_members m WHERE m.song_id = s.id), 0) AS collaborator_count
  FROM public.songs s
  JOIN public.song_members sm ON sm.song_id = s.id AND sm.user_id = auth.uid()
  WHERE s.status <> 'deleted'
  ORDER BY s.last_activity_at DESC NULLS LAST, s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_songs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_songs() TO authenticated;

-- get_song_detail
CREATE OR REPLACE FUNCTION public.get_song_detail(_song_id uuid)
RETURNS TABLE (
  id uuid,
  owner_user_id uuid,
  title text,
  status song_status,
  key_signature text,
  tempo_bpm integer,
  time_signature text,
  tags text[],
  cover_color text,
  is_locked boolean,
  last_activity_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  lyrics_snippet text,
  my_role song_member_role,
  section_count integer,
  lyrics_filled_count integer,
  voice_memo_count integer,
  note_count integer,
  collaborator_count integer,
  pending_suggestion_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.owner_user_id, s.title, s.status, s.key_signature, s.tempo_bpm,
    s.time_signature, s.tags, s.cover_color, s.is_locked,
    s.last_activity_at, s.created_at, s.updated_at, s.lyrics_snippet,
    public.song_role(s.id, auth.uid()) AS my_role,
    COALESCE((SELECT COUNT(*)::int FROM public.song_sections x WHERE x.song_id = s.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.song_lyrics x WHERE x.song_id = s.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.voice_memos x WHERE x.song_id = s.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.song_notes x WHERE x.song_id = s.id), 0),
    COALESCE((SELECT COUNT(*)::int FROM public.song_members x WHERE x.song_id = s.id), 0),
    0 AS pending_suggestion_count
  FROM public.songs s
  WHERE s.id = _song_id
    AND public.is_song_member(_song_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_song_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_song_detail(uuid) TO authenticated;

-- list_song_members
CREATE OR REPLACE FUNCTION public.list_song_members(_song_id uuid)
RETURNS TABLE (
  user_id uuid,
  role song_member_role,
  joined_at timestamptz,
  display_name text,
  first_name text,
  avatar_color text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sm.user_id,
    sm.role,
    sm.joined_at,
    p.display_name,
    p.first_name,
    p.avatar_color,
    p.avatar_url
  FROM public.song_members sm
  LEFT JOIN public.profiles p ON p.user_id = sm.user_id
  WHERE sm.song_id = _song_id
    AND public.is_song_member(_song_id, auth.uid())
  ORDER BY
    CASE sm.role WHEN 'owner' THEN 0 WHEN 'collaborator' THEN 1 ELSE 2 END,
    sm.joined_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_song_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_song_members(uuid) TO authenticated;

-- my_song_role
CREATE OR REPLACE FUNCTION public.my_song_role(_song_id uuid)
RETURNS song_member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.song_role(_song_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.my_song_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_song_role(uuid) TO authenticated;
