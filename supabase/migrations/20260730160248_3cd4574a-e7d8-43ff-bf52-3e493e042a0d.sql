CREATE TABLE IF NOT EXISTS public.song_room_state (
  user_id uuid NOT NULL,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  last_view text,
  last_card_id uuid,
  last_take_id uuid,
  playback_ms integer NOT NULL DEFAULT 0,
  filter_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.song_room_state TO authenticated;
GRANT ALL ON public.song_room_state TO service_role;

ALTER TABLE public.song_room_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own room state select" ON public.song_room_state
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

CREATE POLICY "own room state insert" ON public.song_room_state
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

CREATE POLICY "own room state update" ON public.song_room_state
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_song_member(song_id, auth.uid()));

CREATE POLICY "own room state delete" ON public.song_room_state
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER song_room_state_touch
  BEFORE UPDATE ON public.song_room_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.save_song_room_state(
  _song_id uuid,
  _last_view text DEFAULT NULL,
  _last_card_id uuid DEFAULT NULL,
  _last_take_id uuid DEFAULT NULL,
  _playback_ms integer DEFAULT NULL,
  _filter_state jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.song_room_state AS s (user_id, song_id, last_view, last_card_id, last_take_id, playback_ms, filter_state)
  VALUES (_uid, _song_id, _last_view, _last_card_id, _last_take_id, COALESCE(_playback_ms, 0), COALESCE(_filter_state, '{}'::jsonb))
  ON CONFLICT (user_id, song_id) DO UPDATE SET
    last_view    = COALESCE(EXCLUDED.last_view, s.last_view),
    last_card_id = COALESCE(EXCLUDED.last_card_id, s.last_card_id),
    last_take_id = COALESCE(EXCLUDED.last_take_id, s.last_take_id),
    playback_ms  = COALESCE(_playback_ms, s.playback_ms),
    filter_state = COALESCE(_filter_state, s.filter_state),
    updated_at   = now();
END;
$$;

REVOKE ALL ON FUNCTION public.save_song_room_state(uuid, text, uuid, uuid, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.save_song_room_state(uuid, text, uuid, uuid, integer, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.song_room_resume(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _state jsonb;
  _last_seen timestamptz;
  _unseen int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s) INTO _state
  FROM public.song_room_state s
  WHERE s.user_id = _uid AND s.song_id = _song_id;

  SELECT p.last_seen_at INTO _last_seen
  FROM public.song_notification_prefs p
  WHERE p.user_id = _uid AND p.song_id = _song_id;

  SELECT count(*) INTO _unseen
  FROM public.song_activity a
  WHERE a.song_id = _song_id
    AND a.actor_user_id IS DISTINCT FROM _uid
    AND (_last_seen IS NULL OR a.created_at > _last_seen);

  RETURN jsonb_build_object(
    'state', _state,
    'last_seen_at', _last_seen,
    'unseen_count', COALESCE(_unseen, 0),
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_room_resume(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_room_resume(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_song_activity_song_created_actor
  ON public.song_activity (song_id, created_at DESC, actor_user_id);