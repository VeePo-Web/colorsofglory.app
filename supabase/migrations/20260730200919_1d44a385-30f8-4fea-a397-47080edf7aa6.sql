ALTER TABLE public.takes ADD COLUMN IF NOT EXISTS client_key text;

CREATE UNIQUE INDEX IF NOT EXISTS takes_song_client_key_uidx
  ON public.takes (song_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_take_idempotent(
  _song_id uuid,
  _client_key text,
  _storage_path text,
  _mime_type text DEFAULT 'audio/webm',
  _duration_ms integer DEFAULT NULL,
  _byte_size bigint DEFAULT 0,
  _waveform_peaks jsonb DEFAULT NULL,
  _section_id uuid DEFAULT NULL,
  _title text DEFAULT NULL,
  _voice_memo_id uuid DEFAULT NULL,
  _make_primary boolean DEFAULT false
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
  _now timestamptz := now();
  _memo_id uuid := _voice_memo_id;
  _take public.takes%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _client_key IS NULL OR length(TRIM(_client_key)) = 0 THEN
    RAISE EXCEPTION 'client_key_required' USING ERRCODE = '22023';
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

  -- Already landed on an earlier attempt: hand back the same take.
  SELECT * INTO _take
    FROM public.takes
   WHERE song_id = _song_id AND client_key = _client_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'exists', 'take_id', _take.id,
                              'voice_memo_id', _take.voice_memo_id,
                              'storage_path', _take.storage_path);
  END IF;

  IF _memo_id IS NULL THEN
    INSERT INTO public.voice_memos
      (song_id, section_id, author_user_id, storage_path, mime_type, duration_ms,
       byte_size, title, status, waveform_peaks, created_at, updated_at)
    VALUES
      (_song_id, _section_id, _uid, _storage_path, COALESCE(_mime_type, 'audio/webm'),
       _duration_ms, COALESCE(_byte_size, 0), _title, 'ready', _waveform_peaks, _now, _now)
    RETURNING id INTO _memo_id;
  END IF;

  INSERT INTO public.takes
    (voice_memo_id, song_id, created_by, storage_path, mime_type, duration_ms,
     byte_size, waveform_peaks, is_primary, client_key, created_at, updated_at)
  VALUES
    (_memo_id, _song_id, _uid, _storage_path, COALESCE(_mime_type, 'audio/webm'),
     _duration_ms, COALESCE(_byte_size, 0), _waveform_peaks, false, _client_key, _now, _now)
  RETURNING * INTO _take;

  IF _make_primary THEN
    UPDATE public.takes SET is_primary = (id = _take.id), updated_at = _now
     WHERE voice_memo_id = _memo_id;
  END IF;

  UPDATE public.songs SET last_activity_at = _now, updated_at = _now WHERE id = _song_id;

  RETURN jsonb_build_object('status', 'created', 'take_id', _take.id,
                            'voice_memo_id', _memo_id,
                            'storage_path', _take.storage_path);
END;
$$;

REVOKE ALL ON FUNCTION public.create_take_idempotent(uuid, text, text, text, integer, bigint, jsonb, uuid, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_take_idempotent(uuid, text, text, text, integer, bigint, jsonb, uuid, text, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.takes_landed(_song_id uuid, _client_keys text[])
RETURNS TABLE (client_key text, take_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.client_key, t.id
    FROM public.takes t
   WHERE t.song_id = _song_id
     AND t.client_key = ANY(_client_keys)
     AND public.is_song_member(_song_id, auth.uid());
$$;

REVOKE ALL ON FUNCTION public.takes_landed(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.takes_landed(uuid, text[]) TO authenticated;