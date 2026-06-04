
CREATE OR REPLACE FUNCTION public.apply_song_lock_for_quota(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cap int;
  active_cnt int;
  to_lock int;
  locked_ids uuid[];
BEGIN
  cap := public.effective_song_limit(_user_id);
  IF cap IS NULL THEN cap := 1; END IF;

  SELECT COUNT(*) INTO active_cnt
  FROM public.songs
  WHERE owner_user_id = _user_id AND status = 'active';

  to_lock := active_cnt - cap;
  IF to_lock <= 0 THEN RETURN 0; END IF;

  WITH victims AS (
    SELECT id FROM public.songs
    WHERE owner_user_id = _user_id AND status = 'active'
    ORDER BY updated_at ASC
    LIMIT to_lock
  )
  UPDATE public.songs s
  SET status = 'locked', is_locked = true, updated_at = now()
  FROM victims v
  WHERE s.id = v.id
  RETURNING s.id INTO locked_ids;

  PERFORM public.write_audit(_user_id, 'songs_locked_on_downgrade', 'user', _user_id,
    NULL,
    jsonb_build_object('locked_count', to_lock, 'cap', cap),
    NULL);

  RETURN to_lock;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlock_songs_up_to_quota(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cap int;
  active_cnt int;
  to_unlock int;
  unlocked int := 0;
BEGIN
  cap := public.effective_song_limit(_user_id);
  IF cap IS NULL THEN cap := 1; END IF;

  SELECT COUNT(*) INTO active_cnt
  FROM public.songs
  WHERE owner_user_id = _user_id AND status = 'active';

  to_unlock := cap - active_cnt;
  IF to_unlock <= 0 THEN RETURN 0; END IF;

  WITH candidates AS (
    SELECT id FROM public.songs
    WHERE owner_user_id = _user_id AND status = 'locked'
    ORDER BY updated_at ASC
    LIMIT to_unlock
  )
  UPDATE public.songs s
  SET status = 'active', is_locked = false, updated_at = now()
  FROM candidates c
  WHERE s.id = c.id;

  GET DIAGNOSTICS unlocked = ROW_COUNT;

  IF unlocked > 0 THEN
    PERFORM public.write_audit(_user_id, 'songs_unlocked_on_upgrade', 'user', _user_id,
      NULL,
      jsonb_build_object('unlocked_count', unlocked, 'cap', cap),
      NULL);
  END IF;

  RETURN unlocked;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_song_lock_for_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unlock_songs_up_to_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_song_lock_for_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unlock_songs_up_to_quota(uuid) TO service_role;
