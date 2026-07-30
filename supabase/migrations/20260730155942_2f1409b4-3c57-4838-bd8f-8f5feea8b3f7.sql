ALTER TABLE public.idea_captures
  ADD COLUMN IF NOT EXISTS client_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idea_captures_author_client_key_uidx
  ON public.idea_captures (author_user_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.quick_capture_idempotent(
  _client_key text,
  _song_id uuid DEFAULT NULL,
  _title text DEFAULT '',
  _lyric_snippet text DEFAULT '',
  _scripture_ref text DEFAULT '',
  _tags text[] DEFAULT '{}',
  _section_id uuid DEFAULT NULL,
  _voice_memo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _key text := NULLIF(trim(COALESCE(_client_key, '')), '');
  _existing uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _key IS NULL THEN RAISE EXCEPTION 'client_key_required'; END IF;

  IF _song_id IS NOT NULL AND NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO _existing
    FROM public.idea_captures
   WHERE author_user_id = _uid AND client_key = _key;

  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'created', false);
  END IF;

  INSERT INTO public.idea_captures (
    song_id, author_user_id, title, lyric_snippet, scripture_ref,
    tags, section_id, voice_memo_id, client_key
  ) VALUES (
    _song_id, _uid, NULLIF(_title, ''), NULLIF(_lyric_snippet, ''),
    NULLIF(_scripture_ref, ''), COALESCE(_tags, '{}'), _section_id,
    _voice_memo_id, _key
  )
  ON CONFLICT (author_user_id, client_key) WHERE client_key IS NOT NULL
  DO UPDATE SET updated_at = now()
  RETURNING id INTO _id;

  IF _song_id IS NOT NULL THEN
    UPDATE public.songs SET last_activity_at = now() WHERE id = _song_id;
  END IF;

  RETURN jsonb_build_object('id', _id, 'created', true);
END;
$$;

REVOKE ALL ON FUNCTION public.quick_capture_idempotent(text, uuid, text, text, text, text[], uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_capture_idempotent(text, uuid, text, text, text, text[], uuid, uuid) TO authenticated;