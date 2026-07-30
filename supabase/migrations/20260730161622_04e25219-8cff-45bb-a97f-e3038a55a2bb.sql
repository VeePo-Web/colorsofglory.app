-- R15: atomic arrangement operations -----------------------------------------

CREATE OR REPLACE FUNCTION public._assert_song_write(_song_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _locked boolean;
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
  RETURN _uid;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_song_write(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reorder_song_sections(
  _song_id uuid,
  _ordered_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := public._assert_song_write(_song_id);
  _existing uuid[];
  _now timestamptz := now();
BEGIN
  SELECT COALESCE(array_agg(id ORDER BY id), '{}') INTO _existing
    FROM public.song_sections WHERE song_id = _song_id;

  IF (SELECT COALESCE(array_agg(x ORDER BY x), '{}') FROM unnest(_ordered_ids) AS x) IS DISTINCT FROM _existing THEN
    RETURN jsonb_build_object(
      'status', 'stale',
      'current_ids', to_jsonb(_existing)
    );
  END IF;

  -- Two-phase: park out of range first so any ordering constraint can't collide.
  UPDATE public.song_sections
     SET position = position + 100000
   WHERE song_id = _song_id;

  UPDATE public.song_sections s
     SET position = o.ord - 1,
         updated_at = _now
    FROM (SELECT id, ordinality AS ord FROM unnest(_ordered_ids) WITH ORDINALITY AS t(id, ordinality)) o
   WHERE s.id = o.id AND s.song_id = _song_id;

  UPDATE public.songs SET last_activity_at = _now, updated_at = _now WHERE id = _song_id;

  RETURN jsonb_build_object('status', 'saved', 'ordered_ids', to_jsonb(_ordered_ids), 'updated_at', _now);
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_song_sections(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_song_sections(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.duplicate_song_section(
  _song_id uuid,
  _section_id uuid,
  _label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := public._assert_song_write(_song_id);
  _src public.song_sections%ROWTYPE;
  _new_id uuid := gen_random_uuid();
  _now timestamptz := now();
BEGIN
  SELECT * INTO _src FROM public.song_sections
   WHERE id = _section_id AND song_id = _song_id;
  IF _src.id IS NULL THEN
    RAISE EXCEPTION 'section_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.song_sections
     SET position = position + 1, updated_at = _now
   WHERE song_id = _song_id AND position > _src.position;

  INSERT INTO public.song_sections (id, song_id, kind, label, position, created_by_user_id, created_at, updated_at)
  VALUES (_new_id, _song_id, _src.kind,
          COALESCE(_label, COALESCE(_src.label, initcap(replace(_src.kind::text, '_', ' '))) || ' (copy)'),
          _src.position + 1, _uid, _now, _now);

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id, created_at, updated_at)
  SELECT _song_id, _new_id, l.content, l.plain_text, _uid, _now, _now
    FROM public.song_lyrics l
   WHERE l.section_id = _section_id AND l.song_id = _song_id;

  UPDATE public.songs SET last_activity_at = _now, updated_at = _now WHERE id = _song_id;

  RETURN jsonb_build_object('status', 'created', 'section_id', _new_id, 'position', _src.position + 1, 'updated_at', _now);
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_song_section(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_song_section(uuid, uuid, text) TO authenticated;