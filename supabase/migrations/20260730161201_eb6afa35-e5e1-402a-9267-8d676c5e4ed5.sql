-- R13: conflict-safe lyric writes -------------------------------------------

CREATE OR REPLACE FUNCTION public.song_lyrics_heads(_song_id uuid)
RETURNS TABLE (
  section_id uuid,
  label text,
  section_position integer,
  updated_at timestamptz,
  updated_by_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         s.label,
         s.position,
         GREATEST(COALESCE(l.updated_at, s.updated_at), s.updated_at),
         l.updated_by_user_id
  FROM public.song_sections s
  LEFT JOIN public.song_lyrics l
    ON l.section_id = s.id AND l.song_id = s.song_id
  WHERE s.song_id = _song_id
    AND public.is_song_member(_song_id, auth.uid())
  ORDER BY s.position ASC;
$$;

REVOKE ALL ON FUNCTION public.song_lyrics_heads(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_lyrics_heads(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_section_lyrics_guarded(
  _song_id uuid,
  _section_id uuid,
  _content jsonb,
  _plain_text text,
  _expected_updated_at timestamptz DEFAULT NULL,
  _label text DEFAULT NULL,
  _position integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _locked boolean;
  _current timestamptz;
  _row public.song_lyrics%ROWTYPE;
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT s.is_locked INTO _locked FROM public.songs s WHERE s.id = _song_id;
  IF _locked IS NULL THEN
    RAISE EXCEPTION 'song_not_found' USING ERRCODE = 'P0002';
  END IF;

  _role := public.song_role(_song_id, _uid);
  IF _role IS NULL OR _role NOT IN ('owner', 'collaborator') THEN
    RAISE EXCEPTION 'view_only' USING ERRCODE = '42501';
  END IF;

  IF _locked AND _role <> 'owner' THEN
    RAISE EXCEPTION 'song_locked' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.song_sections
   WHERE id = _section_id AND song_id = _song_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO _row
    FROM public.song_lyrics
   WHERE section_id = _section_id AND song_id = _song_id
   FOR UPDATE;

  _current := _row.updated_at;

  -- Conflict: someone else's newer save is sitting under this edit.
  IF _current IS NOT NULL
     AND (_expected_updated_at IS NULL OR _current > _expected_updated_at)
     AND _row.updated_by_user_id IS DISTINCT FROM _uid THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'section_id', _section_id,
      'updated_at', _current,
      'updated_by_user_id', _row.updated_by_user_id,
      'server_content', _row.content,
      'server_plain_text', _row.plain_text
    );
  END IF;

  IF _label IS NOT NULL OR _position IS NOT NULL THEN
    UPDATE public.song_sections
       SET label = COALESCE(_label, label),
           position = COALESCE(_position, position),
           updated_at = _now
     WHERE id = _section_id AND song_id = _song_id;
  END IF;

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id, created_at, updated_at)
  VALUES (_song_id, _section_id, _content, COALESCE(_plain_text, ''), _uid, _now, _now)
  ON CONFLICT (section_id) DO UPDATE
    SET content = EXCLUDED.content,
        plain_text = EXCLUDED.plain_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = EXCLUDED.updated_at;

  UPDATE public.songs SET last_activity_at = _now, updated_at = _now WHERE id = _song_id;

  RETURN jsonb_build_object(
    'status', 'saved',
    'section_id', _section_id,
    'updated_at', _now,
    'updated_by_user_id', _uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_section_lyrics_guarded(uuid, uuid, jsonb, text, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_section_lyrics_guarded(uuid, uuid, jsonb, text, timestamptz, text, integer) TO authenticated;