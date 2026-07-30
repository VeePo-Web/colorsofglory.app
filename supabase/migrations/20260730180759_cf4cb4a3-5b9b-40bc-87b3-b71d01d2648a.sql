CREATE OR REPLACE FUNCTION public.song_pending_invites(_song_id uuid)
RETURNS TABLE (
  id uuid,
  token text,
  invited_email text,
  invited_phone text,
  role song_member_role,
  created_by_user_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  is_expired boolean,
  waiting_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.token,
    i.invited_email,
    i.invited_phone,
    i.role,
    i.created_by_user_id,
    i.created_at,
    i.expires_at,
    (i.expires_at <= now()) AS is_expired,
    GREATEST(0, EXTRACT(DAY FROM (now() - i.created_at))::int) AS waiting_days
  FROM public.song_invites i
  WHERE i.song_id = _song_id
    AND i.status = 'pending'
    AND public.is_song_member(_song_id, auth.uid())
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.nudge_song_invite(_invite_id uuid)
RETURNS public.song_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.song_invites;
BEGIN
  SELECT * INTO v_row FROM public.song_invites WHERE id = _invite_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'invite_not_pending' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    v_row.created_by_user_id = auth.uid()
    OR public.song_role(v_row.song_id, auth.uid()) = 'owner'
  ) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_row.updated_at > now() - interval '1 day' AND v_row.updated_at > v_row.created_at THEN
    RAISE EXCEPTION 'nudged_recently' USING ERRCODE = '22023';
  END IF;

  UPDATE public.song_invites
     SET expires_at = now() + interval '14 days',
         updated_at = now()
   WHERE id = _invite_id
  RETURNING * INTO v_row;

  PERFORM public.log_song_activity(
    v_row.song_id, 'invite_nudged', 'song_invite', v_row.id,
    jsonb_build_object('role', v_row.role)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.song_pending_invites(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nudge_song_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_pending_invites(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nudge_song_invite(uuid) TO authenticated;