CREATE OR REPLACE FUNCTION public.song_room_delta(
  _song_id uuid,
  _since timestamptz,
  _limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cards jsonb;
  _memos jsonb;
  _takes jsonb;
  _captures jsonb;
  _activity jsonb;
  _now timestamptz := now();
  _lim integer := LEAST(GREATEST(COALESCE(_limit, 200), 1), 500);
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.updated_at), '[]'::jsonb) INTO _cards
  FROM (
    SELECT * FROM public.canvas_cards
    WHERE song_id = _song_id AND updated_at > _since
    ORDER BY updated_at ASC LIMIT _lim
  ) c;

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.updated_at), '[]'::jsonb) INTO _memos
  FROM (
    SELECT * FROM public.voice_memos
    WHERE song_id = _song_id AND updated_at > _since
    ORDER BY updated_at ASC LIMIT _lim
  ) m;

  SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.updated_at), '[]'::jsonb) INTO _takes
  FROM (
    SELECT * FROM public.takes
    WHERE song_id = _song_id AND updated_at > _since
    ORDER BY updated_at ASC LIMIT _lim
  ) t;

  SELECT COALESCE(jsonb_agg(to_jsonb(ic) ORDER BY ic.updated_at), '[]'::jsonb) INTO _captures
  FROM (
    SELECT * FROM public.idea_captures
    WHERE song_id = _song_id AND updated_at > _since
    ORDER BY updated_at ASC LIMIT _lim
  ) ic;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at), '[]'::jsonb) INTO _activity
  FROM (
    SELECT * FROM public.song_activity
    WHERE song_id = _song_id AND created_at > _since
    ORDER BY created_at ASC LIMIT _lim
  ) a;

  RETURN jsonb_build_object(
    'server_time', _now,
    'since', _since,
    'cards', _cards,
    'memos', _memos,
    'takes', _takes,
    'captures', _captures,
    'activity', _activity,
    'truncated', (
      jsonb_array_length(_cards) >= _lim
      OR jsonb_array_length(_memos) >= _lim
      OR jsonb_array_length(_takes) >= _lim
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_room_delta(uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_room_delta(uuid, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.song_room_delta(uuid, timestamptz, integer) TO service_role;

CREATE INDEX IF NOT EXISTS canvas_cards_song_updated_idx ON public.canvas_cards(song_id, updated_at);
CREATE INDEX IF NOT EXISTS voice_memos_song_updated_idx ON public.voice_memos(song_id, updated_at);
CREATE INDEX IF NOT EXISTS takes_song_updated_idx ON public.takes(song_id, updated_at);
CREATE INDEX IF NOT EXISTS idea_captures_song_updated_idx ON public.idea_captures(song_id, updated_at);