-- R19: sheet bootstrap + atomic save

CREATE OR REPLACE FUNCTION public.song_sheet_bootstrap(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_song_member(_song_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'label', s.label,
        'kind', s.kind,
        'position', s.position,
        'updated_at', s.updated_at,
        'content', l.content,
        'lyrics_updated_at', l.updated_at
      ) ORDER BY s.position ASC)
      FROM public.song_sections s
      LEFT JOIN public.song_lyrics l ON l.section_id = s.id
      WHERE s.song_id = _song_id
    ), '[]'::jsonb),
    'meta', (
      SELECT cp.chords FROM public.chord_progressions cp
      WHERE cp.song_id = _song_id AND cp.label = '__sheet_meta__'
      LIMIT 1
    ),
    'updated_at', GREATEST(
      COALESCE((SELECT max(updated_at) FROM public.song_sections WHERE song_id = _song_id), 'epoch'::timestamptz),
      COALESCE((SELECT max(updated_at) FROM public.song_lyrics WHERE song_id = _song_id), 'epoch'::timestamptz),
      COALESCE((SELECT max(updated_at) FROM public.chord_progressions WHERE song_id = _song_id AND label = '__sheet_meta__'), 'epoch'::timestamptz)
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.song_sheet_bootstrap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.song_sheet_bootstrap(uuid) TO authenticated;

-- Atomic sheet save.
-- _sections: [{ id, label, kind, position, content, plain_text }]
-- _removed_ids: section ids to drop
-- _meta: sheet meta jsonb (key, mode, originalKey, capo, bpm, display)
CREATE OR REPLACE FUNCTION public.save_song_sheet(
  _song_id uuid,
  _sections jsonb,
  _removed_ids uuid[],
  _meta jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  role song_member_role;
  now_ts timestamptz := now();
  sec jsonb;
BEGIN
  role := public.song_role(_song_id, uid);
  IF role IS NULL OR role = 'viewer' THEN
    RAISE EXCEPTION 'write_not_allowed' USING ERRCODE = '42501';
  END IF;

  IF _sections IS NOT NULL AND jsonb_typeof(_sections) = 'array' THEN
    FOR sec IN SELECT * FROM jsonb_array_elements(_sections) LOOP
      INSERT INTO public.song_sections (id, song_id, label, kind, position, created_by_user_id, updated_at)
      VALUES (
        (sec->>'id')::uuid,
        _song_id,
        NULLIF(sec->>'label', ''),
        COALESCE(NULLIF(sec->>'kind', ''), 'other')::section_kind,
        COALESCE((sec->>'position')::int, 0),
        uid,
        now_ts
      )
      ON CONFLICT (id) DO UPDATE
        SET label = EXCLUDED.label,
            kind = EXCLUDED.kind,
            position = EXCLUDED.position,
            updated_at = now_ts;

      INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id, updated_at)
      VALUES (
        _song_id,
        (sec->>'id')::uuid,
        COALESCE(sec->'content', '{}'::jsonb),
        COALESCE(sec->>'plain_text', ''),
        uid,
        now_ts
      )
      ON CONFLICT (section_id) DO UPDATE
        SET content = EXCLUDED.content,
            plain_text = EXCLUDED.plain_text,
            updated_by_user_id = uid,
            updated_at = now_ts;
    END LOOP;
  END IF;

  IF _removed_ids IS NOT NULL AND array_length(_removed_ids, 1) > 0 THEN
    DELETE FROM public.song_lyrics WHERE song_id = _song_id AND section_id = ANY(_removed_ids);
    DELETE FROM public.song_sections WHERE song_id = _song_id AND id = ANY(_removed_ids);
  END IF;

  IF _meta IS NOT NULL AND _meta <> 'null'::jsonb THEN
    IF EXISTS (SELECT 1 FROM public.chord_progressions WHERE song_id = _song_id AND label = '__sheet_meta__') THEN
      UPDATE public.chord_progressions
      SET chords = _meta, updated_at = now_ts
      WHERE song_id = _song_id AND label = '__sheet_meta__';
    ELSE
      INSERT INTO public.chord_progressions (song_id, section_id, label, chords, created_by_user_id)
      VALUES (_song_id, NULL, '__sheet_meta__', _meta, uid);
    END IF;

    -- Mirror key/tempo onto the song so the catalog can show them cheaply.
    UPDATE public.songs
    SET key_signature = COALESCE(NULLIF(_meta->>'key', ''), key_signature),
        tempo_bpm = COALESCE((_meta->>'bpm')::int, tempo_bpm),
        last_activity_at = now_ts,
        updated_at = now_ts
    WHERE id = _song_id;
  ELSE
    UPDATE public.songs SET last_activity_at = now_ts, updated_at = now_ts WHERE id = _song_id;
  END IF;

  RETURN jsonb_build_object('saved_at', now_ts);
END;
$$;

REVOKE ALL ON FUNCTION public.save_song_sheet(uuid, jsonb, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_song_sheet(uuid, jsonb, uuid[], jsonb) TO authenticated;