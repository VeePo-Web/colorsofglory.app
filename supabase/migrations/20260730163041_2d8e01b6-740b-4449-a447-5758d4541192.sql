-- R20: one-request voice board + guarded, activity-logged take actions

CREATE OR REPLACE FUNCTION public.song_voice_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _memos jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(m ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO _memos
  FROM (
    SELECT
      vm.id,
      vm.song_id,
      vm.section_id,
      vm.author_user_id,
      vm.title,
      vm.status::text AS status,
      vm.duration_ms,
      vm.notes,
      vm.created_at,
      vm.updated_at,
      COALESCE(p.display_name, 'Someone') AS author_name,
      p.avatar_color AS author_avatar_color,
      COALESCE(t.takes, '[]'::jsonb) AS takes,
      COALESCE(t.take_count, 0) AS take_count,
      t.primary_take_id,
      tr.status::text AS transcript_status,
      NULLIF(tr.text, '') AS transcript_preview
    FROM public.voice_memos vm
    LEFT JOIN public.profiles p ON p.user_id = vm.author_user_id
    LEFT JOIN LATERAL (
      SELECT
        jsonb_agg(
          jsonb_build_object(
            'id', tk.id,
            'storage_path', tk.storage_path,
            'mime_type', tk.mime_type,
            'duration_ms', tk.duration_ms,
            'byte_size', tk.byte_size,
            'waveform_peaks', tk.waveform_peaks,
            'friendly_name', tk.friendly_name,
            'name_is_custom', tk.name_is_custom,
            'is_primary', tk.is_primary,
            'is_archived', tk.is_archived,
            'transcript_status', tk.transcript_status,
            'created_by', tk.created_by,
            'created_at', tk.created_at
          ) ORDER BY tk.is_primary DESC, tk.created_at DESC
        ) AS takes,
        COUNT(*) AS take_count,
        MAX(tk.id) FILTER (WHERE tk.is_primary) AS primary_take_id
      FROM public.takes tk
      WHERE tk.voice_memo_id = vm.id
        AND tk.is_archived = false
    ) t ON TRUE
    LEFT JOIN public.voice_memo_transcripts tr ON tr.memo_id = vm.id
    WHERE vm.song_id = _song_id
      AND vm.status <> 'deleted'
  ) m;

  RETURN jsonb_build_object(
    'memos', _memos,
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_voice_board(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_voice_board(uuid) TO authenticated;

-- ---------- guarded take actions ----------

CREATE OR REPLACE FUNCTION public.rename_take(_take_id uuid, _friendly_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.takes;
  _uid uuid;
  _name text := NULLIF(btrim(_friendly_name), '');
BEGIN
  SELECT * INTO _row FROM public.takes WHERE id = _take_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  _uid := public._assert_song_write(_row.song_id);

  UPDATE public.takes
  SET friendly_name = _name,
      name_is_custom = (_name IS NOT NULL),
      updated_at = now()
  WHERE id = _take_id;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (_row.song_id, _uid, 'take_renamed', 'take', _take_id, jsonb_build_object('name', _name));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_take_archived(_take_id uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.takes;
  _uid uuid;
BEGIN
  SELECT * INTO _row FROM public.takes WHERE id = _take_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  _uid := public._assert_song_write(_row.song_id);

  UPDATE public.takes
  SET is_archived = _archived,
      is_primary = CASE WHEN _archived THEN false ELSE is_primary END,
      updated_at = now()
  WHERE id = _take_id;

  -- if we archived the primary take, promote the newest remaining take
  IF _archived AND _row.is_primary THEN
    UPDATE public.takes
    SET is_primary = true, updated_at = now()
    WHERE id = (
      SELECT id FROM public.takes
      WHERE voice_memo_id = _row.voice_memo_id AND is_archived = false
      ORDER BY created_at DESC LIMIT 1
    );
  END IF;

  INSERT INTO public.song_activity (song_id, actor_user_id, kind, entity_type, entity_id, payload)
  VALUES (
    _row.song_id, _uid,
    CASE WHEN _archived THEN 'take_archived' ELSE 'take_restored' END,
    'take', _take_id, '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rename_take(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_take_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_take(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_take_archived(uuid, boolean) TO authenticated;