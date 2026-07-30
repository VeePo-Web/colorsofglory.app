
-- R29: compare mode -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.song_compare_takes(
  _song_id uuid,
  _section_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _items jsonb;
BEGIN
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO _items
  FROM (
    SELECT
      t.id,
      t.voice_memo_id,
      m.section_id,
      s.kind::text        AS section_kind,
      s.label             AS section_label,
      COALESCE(t.friendly_name, m.title, 'Take') AS name,
      t.duration_ms,
      t.storage_path,
      t.mime_type,
      t.is_primary,
      t.is_archived,
      t.waveform_peaks,
      t.created_by,
      p.display_name      AS created_by_name,
      p.avatar_color      AS created_by_color,
      t.created_at
    FROM public.takes t
    JOIN public.voice_memos m ON m.id = t.voice_memo_id
    LEFT JOIN public.song_sections s ON s.id = m.section_id
    LEFT JOIN public.profiles p ON p.user_id = t.created_by
    WHERE t.song_id = _song_id
      AND t.is_archived = false
      AND (_section_id IS NULL OR m.section_id = _section_id)
  ) x;

  RETURN jsonb_build_object(
    'song_id', _song_id,
    'section_id', _section_id,
    'takes', _items,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_compare_takes(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.choose_take(
  _take_id uuid,
  _set_aside_take_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song_id uuid;
  _memo_id uuid;
BEGIN
  SELECT song_id, voice_memo_id INTO _song_id, _memo_id
  FROM public.takes WHERE id = _take_id;

  IF _song_id IS NULL THEN
    RAISE EXCEPTION 'take_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_song_write(_song_id);

  UPDATE public.takes
     SET is_primary = false, updated_at = now()
   WHERE voice_memo_id = _memo_id AND is_primary = true AND id <> _take_id;

  UPDATE public.takes
     SET is_primary = true, is_archived = false, updated_at = now()
   WHERE id = _take_id;

  IF _set_aside_take_id IS NOT NULL AND _set_aside_take_id <> _take_id THEN
    UPDATE public.takes
       SET is_archived = true, is_primary = false, updated_at = now()
     WHERE id = _set_aside_take_id AND song_id = _song_id;
  END IF;

  PERFORM public.log_song_activity(_song_id, 'take_chosen', 'take', _take_id,
    jsonb_build_object('set_aside_take_id', _set_aside_take_id));

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN jsonb_build_object(
    'take_id', _take_id,
    'voice_memo_id', _memo_id,
    'set_aside_take_id', _set_aside_take_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.choose_take(uuid, uuid) TO authenticated;
