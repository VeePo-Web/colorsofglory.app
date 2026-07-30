CREATE OR REPLACE FUNCTION public.song_pending_work(_song_id uuid)
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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO _items
  FROM (
    SELECT
      t.id                                   AS take_id,
      t.voice_memo_id,
      t.friendly_name,
      t.duration_ms,
      t.transcript_status                    AS status,
      t.transcript_error                     AS error,
      COALESCE(vt.attempt_count, 0)          AS attempt_count,
      COALESCE(vt.max_attempts, 3)           AS max_attempts,
      vt.next_attempt_at,
      vt.last_attempt_at,
      (t.transcript_status = 'failed')       AS can_retry,
      (t.waveform_peaks IS NULL)             AS waveform_pending,
      t.created_at
    FROM public.takes t
    LEFT JOIN public.voice_memo_transcripts vt
      ON vt.memo_id = t.voice_memo_id AND vt.song_id = t.song_id
    WHERE t.song_id = _song_id
      AND t.is_archived = false
      AND (
        t.transcript_status IN ('pending', 'processing', 'failed')
        OR t.waveform_peaks IS NULL
      )
    LIMIT 100
  ) x;

  RETURN jsonb_build_object('items', _items, 'server_time', now());
END;
$$;

REVOKE ALL ON FUNCTION public.song_pending_work(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_pending_work(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.retry_take_transcript(_take_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song uuid;
  _memo uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT t.song_id, t.voice_memo_id INTO _song, _memo
  FROM public.takes t WHERE t.id = _take_id;

  IF _song IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_canvas_write(_song);

  UPDATE public.takes
  SET transcript_status = 'pending',
      transcript_error = NULL,
      updated_at = now()
  WHERE id = _take_id;

  UPDATE public.voice_memo_transcripts
  SET status = 'pending',
      attempt_count = 0,
      next_attempt_at = now(),
      last_error = NULL,
      error = NULL,
      updated_at = now()
  WHERE memo_id = _memo AND song_id = _song;

  RETURN jsonb_build_object('ok', true, 'take_id', _take_id);
END;
$$;

REVOKE ALL ON FUNCTION public.retry_take_transcript(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.retry_take_transcript(uuid) TO authenticated;