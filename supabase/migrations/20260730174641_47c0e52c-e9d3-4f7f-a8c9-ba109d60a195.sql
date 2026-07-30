ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE OR REPLACE FUNCTION public.finish_song(_song_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _now timestamptz := now();
BEGIN
  IF public.song_role(_song_id, auth.uid()) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.songs
     SET finished_at = COALESCE(finished_at, _now),
         last_activity_at = _now,
         updated_at = _now
   WHERE id = _song_id
  RETURNING finished_at INTO _now;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, auth.uid(), 'song_finished', 'song', _song_id, '{}'::jsonb);

  RETURN _now;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_song(_song_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.song_role(_song_id, auth.uid()) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'NOT_OWNER' USING ERRCODE = '42501';
  END IF;

  UPDATE public.songs
     SET finished_at = NULL,
         last_activity_at = now(),
         updated_at = now()
   WHERE id = _song_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, auth.uid(), 'song_reopened', 'song', _song_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.finish_song(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_song(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_song(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_song(uuid) TO authenticated;