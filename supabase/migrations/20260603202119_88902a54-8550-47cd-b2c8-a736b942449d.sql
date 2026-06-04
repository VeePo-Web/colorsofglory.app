
-- =========================================================
-- Phase D1: Lifecycle integrity helpers
-- =========================================================

-- 1. voice_memos.failure_reason + mark_memo_failed()
ALTER TABLE public.voice_memos
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE OR REPLACE FUNCTION public.mark_memo_failed(_memo_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.voice_memos
    SET status = 'failed',
        failure_reason = LEFT(COALESCE(_reason, 'unknown'), 500),
        updated_at = now()
    WHERE id = _memo_id
      AND status <> 'failed';
  UPDATE public.voice_memo_transcripts
    SET status = 'failed',
        last_error = LEFT(COALESCE(_reason, 'unknown'), 500),
        updated_at = now()
    WHERE memo_id = _memo_id
      AND status <> 'ready';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_memo_failed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_memo_failed(uuid, text) TO service_role;

-- 2. Atomic invite acceptance — race-safe one-shot
CREATE OR REPLACE FUNCTION public.accept_song_invite(_token text, _user_id uuid)
RETURNS TABLE(song_id uuid, role public.song_member_role, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.song_invites;
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
$$;
REVOKE EXECUTE ON FUNCTION public.accept_song_invite(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_song_invite(text, uuid) TO service_role;

-- 3. is_last_owner / can_unarchive_song / safe_transfer_owner
CREATE OR REPLACE FUNCTION public.is_last_owner(_song_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id AND role = 'owner'
  )
  AND (
    SELECT COUNT(*) FROM public.song_members WHERE song_id = _song_id AND role = 'owner'
  ) <= 1;
$$;

CREATE OR REPLACE FUNCTION public.can_unarchive_song(_song_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_uid uuid;
BEGIN
  SELECT owner_user_id INTO owner_uid FROM public.songs WHERE id = _song_id;
  IF owner_uid IS NULL OR owner_uid <> _user_id THEN RETURN false; END IF;
  RETURN public.can_create_song(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_transfer_song_owner(_song_id uuid, _new_owner uuid, _actor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_owner uuid;
BEGIN
  IF _actor IS NULL THEN RETURN 'UNAUTHENTICATED'; END IF;
  SELECT owner_user_id INTO cur_owner FROM public.songs WHERE id = _song_id FOR UPDATE;
  IF cur_owner IS NULL THEN RETURN 'SONG_NOT_FOUND'; END IF;
  IF cur_owner <> _actor AND NOT public.has_role(_actor,'admin') THEN RETURN 'FORBIDDEN'; END IF;
  IF cur_owner = _new_owner THEN RETURN 'NOOP'; END IF;
  IF NOT public.is_song_member(_song_id, _new_owner) THEN RETURN 'NEW_OWNER_NOT_MEMBER'; END IF;
  IF NOT public.can_create_song(_new_owner) THEN RETURN 'TRANSFER_BLOCKED_QUOTA'; END IF;

  UPDATE public.songs SET owner_user_id = _new_owner, updated_at = now() WHERE id = _song_id;
  UPDATE public.song_members SET role = 'collaborator' WHERE song_id = _song_id AND user_id = cur_owner AND role = 'owner';
  INSERT INTO public.song_members(song_id, user_id, role, invited_by_user_id)
    VALUES (_song_id, _new_owner, 'owner', _actor)
    ON CONFLICT (song_id, user_id) DO UPDATE SET role = 'owner';

  PERFORM public.write_audit(_actor, 'transfer_song_owner', 'song', _song_id,
    jsonb_build_object('from', cur_owner), jsonb_build_object('to', _new_owner), NULL);
  RETURN 'OK';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.safe_transfer_song_owner(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_transfer_song_owner(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.safe_leave_song(_song_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.song_member_role;
BEGIN
  IF _user_id IS NULL THEN RETURN 'UNAUTHENTICATED'; END IF;
  SELECT role INTO r FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id;
  IF r IS NULL THEN RETURN 'NOT_A_MEMBER'; END IF;
  IF r = 'owner' AND public.is_last_owner(_song_id, _user_id) THEN
    RETURN 'OWNER_CANNOT_LEAVE';
  END IF;
  DELETE FROM public.song_members WHERE song_id = _song_id AND user_id = _user_id;
  PERFORM public.write_audit(_user_id, 'leave_song', 'song', _song_id, NULL,
    jsonb_build_object('role', r), NULL);
  RETURN 'OK';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.safe_leave_song(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_leave_song(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.safe_unarchive_song(_song_id uuid, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_status public.song_status;
  owner_uid uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN 'UNAUTHENTICATED'; END IF;
  SELECT status, owner_user_id INTO cur_status, owner_uid FROM public.songs WHERE id = _song_id FOR UPDATE;
  IF cur_status IS NULL THEN RETURN 'SONG_NOT_FOUND'; END IF;
  IF owner_uid <> _user_id THEN RETURN 'FORBIDDEN'; END IF;
  IF cur_status = 'active' THEN RETURN 'NOOP'; END IF;
  IF cur_status = 'deleted' THEN RETURN 'SONG_DELETED'; END IF;
  IF NOT public.can_create_song(_user_id) THEN RETURN 'QUOTA_EXCEEDED_SONGS'; END IF;
  UPDATE public.songs SET status = 'active', updated_at = now(), last_activity_at = now() WHERE id = _song_id;
  PERFORM public.write_audit(_user_id, 'unarchive_song', 'song', _song_id, NULL, NULL, NULL);
  RETURN 'OK';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.safe_unarchive_song(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_unarchive_song(uuid, uuid) TO service_role;

-- 4. Cheap helper to sweep expired invites
CREATE OR REPLACE FUNCTION public.expire_pending_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int := 0;
BEGIN
  UPDATE public.song_invites
    SET status = 'expired', updated_at = now()
    WHERE status = 'pending' AND expires_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    PERFORM public.write_audit(NULL, 'expire_pending_invites', 'song_invite', NULL, NULL,
      jsonb_build_object('count', n), NULL);
  END IF;
  RETURN n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.expire_pending_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_pending_invites() TO service_role;

-- =========================================================
-- Phase D2: Scheduled workers (SQL-only paths)
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop prior schedules of the same name if present (idempotent re-run)
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('cog-mature-holds-daily','cog-expire-invites-hourly') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cog-mature-holds-daily',
  '17 7 * * *',
  $cron$ SELECT public.mature_holds(); $cron$
);

SELECT cron.schedule(
  'cog-expire-invites-hourly',
  '7 * * * *',
  $cron$ SELECT public.expire_pending_invites(); $cron$
);
