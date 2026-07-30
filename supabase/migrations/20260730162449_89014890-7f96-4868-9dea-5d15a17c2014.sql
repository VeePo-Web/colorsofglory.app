-- R18: People board + safe membership management

CREATE OR REPLACE FUNCTION public.song_people_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role song_member_role;
  result jsonb;
BEGIN
  my_role := public.song_role(_song_id, auth.uid());
  IF my_role IS NULL THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'my_role', my_role,
    'can_manage', (my_role = 'owner'),
    'members', COALESCE((
      SELECT jsonb_agg(m ORDER BY m->>'sort_key')
      FROM (
        SELECT jsonb_build_object(
          'user_id', sm.user_id,
          'role', sm.role,
          'joined_at', sm.joined_at,
          'display_name', p.display_name,
          'first_name', p.first_name,
          'avatar_url', p.avatar_url,
          'avatar_color', p.avatar_color,
          'is_me', (sm.user_id = auth.uid()),
          'last_seen_at', np.last_seen_at,
          'contribution_count', (
            SELECT count(*) FROM public.song_activity sa
            WHERE sa.song_id = _song_id AND sa.actor_user_id = sm.user_id
          ),
          'sort_key', (CASE sm.role WHEN 'owner' THEN '0' WHEN 'collaborator' THEN '1' ELSE '2' END)
                      || to_char(sm.joined_at, 'YYYYMMDDHH24MISS')
        ) AS m
        FROM public.song_members sm
        LEFT JOIN public.profiles p ON p.user_id = sm.user_id
        LEFT JOIN public.song_notification_prefs np
          ON np.user_id = sm.user_id AND np.song_id = _song_id
        WHERE sm.song_id = _song_id
      ) t
    ), '[]'::jsonb),
    'pending_invites', CASE WHEN my_role = 'owner' THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', si.id,
        'role', si.role,
        'invited_email', si.invited_email,
        'invited_phone', si.invited_phone,
        'created_at', si.created_at,
        'expires_at', si.expires_at,
        'use_count', si.use_count,
        'max_uses', si.max_uses
      ) ORDER BY si.created_at DESC)
      FROM public.song_invites si
      WHERE si.song_id = _song_id
        AND si.status = 'pending'
        AND si.expires_at > now()
    ), '[]'::jsonb) ELSE '[]'::jsonb END
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.song_people_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.song_people_board(uuid) TO authenticated;

-- Change a member's role (owner only; owner role itself is immutable here)
CREATE OR REPLACE FUNCTION public.set_song_member_role(_song_id uuid, _user_id uuid, _role song_member_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev song_member_role;
BEGIN
  IF public.song_role(_song_id, auth.uid()) <> 'owner' THEN
    RAISE EXCEPTION 'owner_only' USING ERRCODE = '42501';
  END IF;
  IF _role = 'owner' THEN
    RAISE EXCEPTION 'cannot_assign_owner' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO prev FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id;
  IF prev IS NULL THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF prev = 'owner' THEN
    RAISE EXCEPTION 'cannot_change_owner' USING ERRCODE = '22023';
  END IF;

  UPDATE public.song_members SET role = _role WHERE song_id = _song_id AND user_id = _user_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, auth.uid(), 'member_role_changed', 'song_member', _user_id,
          jsonb_build_object('from', prev, 'to', _role));

  RETURN jsonb_build_object('user_id', _user_id, 'role', _role, 'previous_role', prev);
END;
$$;

REVOKE ALL ON FUNCTION public.set_song_member_role(uuid, uuid, song_member_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_song_member_role(uuid, uuid, song_member_role) TO authenticated;

-- Remove a member (owner may remove others; anyone may remove themselves)
CREATE OR REPLACE FUNCTION public.remove_song_member(_song_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  target_role song_member_role;
BEGIN
  SELECT role INTO target_role FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id;
  IF target_role IS NULL THEN
    RETURN jsonb_build_object('removed', false, 'reason', 'not_a_member');
  END IF;
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot_remove_owner' USING ERRCODE = '22023';
  END IF;
  IF caller <> _user_id AND public.song_role(_song_id, caller) <> 'owner' THEN
    RAISE EXCEPTION 'owner_only' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, caller,
          CASE WHEN caller = _user_id THEN 'member_left' ELSE 'member_removed' END,
          'song_member', _user_id, jsonb_build_object('role', target_role));

  RETURN jsonb_build_object('removed', true, 'user_id', _user_id, 'role', target_role);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_song_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_song_member(uuid, uuid) TO authenticated;

-- Revoke a pending invite (owner only)
CREATE OR REPLACE FUNCTION public.revoke_song_invite(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.song_invites;
BEGIN
  SELECT * INTO inv FROM public.song_invites WHERE id = _invite_id;
  IF inv.id IS NULL THEN
    RETURN jsonb_build_object('revoked', false, 'reason', 'not_found');
  END IF;
  IF public.song_role(inv.song_id, auth.uid()) <> 'owner' THEN
    RAISE EXCEPTION 'owner_only' USING ERRCODE = '42501';
  END IF;
  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('revoked', false, 'reason', inv.status::text);
  END IF;

  UPDATE public.song_invites SET status = 'revoked', updated_at = now() WHERE id = _invite_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (inv.song_id, auth.uid(), 'invite_revoked', 'song_invite', inv.id, '{}'::jsonb);

  RETURN jsonb_build_object('revoked', true, 'invite_id', _invite_id);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_song_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_song_invite(uuid) TO authenticated;