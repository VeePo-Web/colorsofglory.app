
-- Phase A backend gates: quota helpers + worker indexes
-- Helpers are SECURITY DEFINER so edge functions and RLS policies can call them safely.

-- 1) Free plan owned-song quota
CREATE OR REPLACE FUNCTION public.owned_active_song_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int
  FROM public.songs
  WHERE owner_user_id = _user_id
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.can_create_song(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  plan public.sub_plan;
  cap int;
  cur int;
BEGIN
  plan := public.current_plan(_user_id);
  IF plan IN ('pro','founder_pro') THEN
    RETURN true;
  END IF;
  SELECT COALESCE((value::text)::int, 1) INTO cap
    FROM public.app_settings WHERE key = 'free_owned_song_limit';
  cur := public.owned_active_song_count(_user_id);
  RETURN cur < COALESCE(cap, 1);
END;
$$;

-- 2) Storage upload precheck — owner of the target song bears the bytes.
CREATE OR REPLACE FUNCTION public.can_upload_bytes(_owner_user_id uuid, _bytes bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  used bigint;
  lim bigint;
BEGIN
  IF _bytes IS NULL OR _bytes < 0 THEN RETURN false; END IF;
  SELECT COALESCE(bytes_used, 0) INTO used FROM public.storage_usage WHERE user_id = _owner_user_id;
  lim := public.effective_storage_limit(_owner_user_id);
  RETURN (COALESCE(used,0) + _bytes) <= lim;
END;
$$;

-- 3) Invite gate — only owner or collaborator can create invites for a song.
CREATE OR REPLACE FUNCTION public.can_invite(_song_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.song_members
    WHERE song_id = _song_id
      AND user_id = _user_id
      AND role IN ('owner','collaborator')
  );
$$;

GRANT EXECUTE ON FUNCTION public.owned_active_song_count(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_create_song(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_upload_bytes(uuid, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_invite(uuid, uuid) TO authenticated, service_role;

-- 4) Worker / triage indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_billing_events_unprocessed
  ON public.billing_events (created_at)
  WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transcripts_pending
  ON public.voice_memo_transcripts (next_attempt_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_songs_owner_active
  ON public.songs (owner_user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_song_invites_pending_token
  ON public.song_invites (token)
  WHERE status = 'pending';
