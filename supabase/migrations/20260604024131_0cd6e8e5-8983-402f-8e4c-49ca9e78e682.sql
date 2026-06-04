CREATE OR REPLACE FUNCTION public.accept_song_invite(_token text, _user_id uuid)
 RETURNS TABLE(song_id uuid, role song_member_role, code text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.song_invites;
  already_member boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::public.song_member_role, 'UNAUTHENTICATED'::text;
    RETURN;
  END IF;

  SELECT * INTO inv
    FROM public.song_invites
    WHERE token = _token
    FOR UPDATE;

  IF inv.id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::public.song_member_role, 'INVITE_NOT_FOUND'::text;
    RETURN;
  END IF;

  -- Idempotent replay: if this user already redeemed this invite (i.e. is already
  -- a member of the invite's song), short-circuit with OK without touching
  -- use_count / status / audit. This absorbs double-clicks, refreshes, and
  -- deep-link reopens after a successful accept.
  SELECT EXISTS (
    SELECT 1 FROM public.song_members
    WHERE song_id = inv.song_id AND user_id = _user_id
  ) INTO already_member;

  IF already_member THEN
    RETURN QUERY SELECT inv.song_id, inv.role, 'OK'::text;
    RETURN;
  END IF;

  IF inv.status <> 'pending' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::public.song_member_role, 'INVITE_ALREADY_USED'::text;
    RETURN;
  END IF;

  IF inv.expires_at <= now() THEN
    UPDATE public.song_invites SET status='expired', updated_at=now() WHERE id = inv.id;
    RETURN QUERY SELECT NULL::uuid, NULL::public.song_member_role, 'INVITE_EXPIRED'::text;
    RETURN;
  END IF;

  IF inv.use_count >= inv.max_uses THEN
    UPDATE public.song_invites SET status='accepted', updated_at=now() WHERE id = inv.id;
    RETURN QUERY SELECT NULL::uuid, NULL::public.song_member_role, 'INVITE_EXHAUSTED'::text;
    RETURN;
  END IF;

  INSERT INTO public.song_members (song_id, user_id, role, invited_by_user_id)
  VALUES (inv.song_id, _user_id, inv.role, inv.created_by_user_id)
  ON CONFLICT (song_id, user_id) DO NOTHING;

  UPDATE public.song_invites
    SET use_count = use_count + 1,
        accepted_by_user_id = COALESCE(accepted_by_user_id, _user_id),
        accepted_at = COALESCE(accepted_at, now()),
        status = CASE WHEN use_count + 1 >= max_uses THEN 'accepted'::invite_status ELSE 'pending'::invite_status END,
        updated_at = now()
    WHERE id = inv.id;

  PERFORM public.write_audit(_user_id, 'accept_song_invite', 'song_invite', inv.id, NULL,
    jsonb_build_object('song_id', inv.song_id, 'role', inv.role), NULL);

  RETURN QUERY SELECT inv.song_id, inv.role, 'OK'::text;
END;
$function$;