-- R21: idea inbox — nothing you capture stays homeless, nothing is destroyed

ALTER TABLE public.idea_captures
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS idea_captures_author_open_idx
  ON public.idea_captures (author_user_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.capture_inbox(_song_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _unfiled jsonb;
  _song jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  IF _song_id IS NOT NULL AND NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO _unfiled
  FROM (
    SELECT ic.id, ic.title, ic.lyric_snippet, ic.scripture_ref, ic.tags,
           ic.voice_memo_id, ic.section_id, ic.song_id, ic.promoted_card_id,
           ic.created_at,
           vm.duration_ms AS memo_duration_ms,
           'Me'::text AS author_name
    FROM public.idea_captures ic
    LEFT JOIN public.voice_memos vm ON vm.id = ic.voice_memo_id
    WHERE ic.author_user_id = _uid
      AND ic.song_id IS NULL
      AND ic.archived_at IS NULL
  ) x;

  IF _song_id IS NULL THEN
    _song := '[]'::jsonb;
  ELSE
    SELECT COALESCE(jsonb_agg(y ORDER BY y.created_at DESC), '[]'::jsonb)
    INTO _song
    FROM (
      SELECT ic.id, ic.title, ic.lyric_snippet, ic.scripture_ref, ic.tags,
             ic.voice_memo_id, ic.section_id, ic.song_id, ic.promoted_card_id,
             ic.created_at,
             vm.duration_ms AS memo_duration_ms,
             COALESCE(p.display_name, 'Someone') AS author_name
      FROM public.idea_captures ic
      LEFT JOIN public.voice_memos vm ON vm.id = ic.voice_memo_id
      LEFT JOIN public.profiles p ON p.user_id = ic.author_user_id
      WHERE ic.song_id = _song_id
        AND ic.archived_at IS NULL
    ) y;
  END IF;

  RETURN jsonb_build_object(
    'unfiled', _unfiled,
    'song', _song,
    'unfiled_count', jsonb_array_length(_unfiled),
    'server_time', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_capture_archived(_capture_id uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.idea_captures;
  _uid uuid := auth.uid();
BEGIN
  SELECT * INTO _row FROM public.idea_captures WHERE id = _capture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;

  IF _row.song_id IS NOT NULL THEN
    _uid := public._assert_song_write(_row.song_id);
  ELSIF _uid IS NULL OR _row.author_user_id <> _uid THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.idea_captures
  SET archived_at = CASE WHEN _archived THEN now() ELSE NULL END,
      archived_by = CASE WHEN _archived THEN _uid ELSE NULL END,
      updated_at = now()
  WHERE id = _capture_id;

  IF _row.song_id IS NOT NULL THEN
    INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
    VALUES (_row.song_id, _uid,
            CASE WHEN _archived THEN 'capture_archived' ELSE 'capture_restored' END,
            'capture', _capture_id, '{}'::jsonb);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.file_capture_into_song(
  _capture_id uuid,
  _song_id uuid,
  _section_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.idea_captures;
  _uid uuid;
BEGIN
  SELECT * INTO _row FROM public.idea_captures WHERE id = _capture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  IF _row.author_user_id <> auth.uid() AND _row.song_id IS NOT NULL THEN
    PERFORM public._assert_song_write(_row.song_id);
  END IF;

  _uid := public._assert_song_write(_song_id);

  UPDATE public.idea_captures
  SET song_id = _song_id,
      section_id = COALESCE(_section_id, section_id),
      updated_at = now()
  WHERE id = _capture_id;

  UPDATE public.songs SET last_activity_at = now() WHERE id = _song_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_song_id, _uid, 'capture_filed', 'capture', _capture_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_inbox(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_capture_archived(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.file_capture_into_song(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_inbox(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_capture_archived(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_capture_into_song(uuid, uuid, uuid) TO authenticated;