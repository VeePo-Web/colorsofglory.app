-- R16: atomic restore + lightweight version timeline

CREATE OR REPLACE FUNCTION public.song_version_timeline(_song_id uuid, _limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  version_number integer,
  kind version_kind,
  label text,
  description text,
  parent_version_id uuid,
  created_by_user_id uuid,
  created_by_name text,
  created_at timestamptz,
  section_count integer,
  line_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.version_number,
    v.kind,
    v.label,
    v.description,
    v.parent_version_id,
    v.created_by_user_id,
    p.display_name,
    v.created_at,
    COALESCE(jsonb_array_length(v.snapshot -> 'sections'), 0)::int,
    COALESCE((
      SELECT SUM(
        CASE
          WHEN COALESCE(s -> 'lyrics' ->> 'plain_text', '') = '' THEN 0
          ELSE array_length(string_to_array(s -> 'lyrics' ->> 'plain_text', E'\n'), 1)
        END
      )
      FROM jsonb_array_elements(COALESCE(v.snapshot -> 'sections', '[]'::jsonb)) AS s
    ), 0)::int
  FROM public.song_versions v
  LEFT JOIN public.profiles p ON p.user_id = v.created_by_user_id
  WHERE v.song_id = _song_id
    AND public.is_song_member(_song_id, auth.uid())
  ORDER BY v.version_number DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

GRANT EXECUTE ON FUNCTION public.song_version_timeline(uuid, int) TO authenticated;

-- Atomic, non-destructive restore. Everything happens in one transaction:
--   1) snapshot the current state ("Before restoring vN", kind auto)
--   2) apply the target snapshot to sections + lyrics
--   3) record a restore_point branched from the restored version
CREATE OR REPLACE FUNCTION public.restore_song_version(_song_id uuid, _version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target public.song_versions%ROWTYPE;
  _head_id uuid;
  _pre_id uuid;
  _restore_id uuid;
  _snap jsonb;
  _cur jsonb;
BEGIN
  PERFORM public._assert_song_write(_song_id);

  SELECT * INTO _target FROM public.song_versions
   WHERE id = _version_id AND song_id = _song_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERSION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  _snap := _target.snapshot;
  IF _snap IS NULL OR _snap -> 'sections' IS NULL OR jsonb_typeof(_snap -> 'sections') <> 'array' THEN
    RAISE EXCEPTION 'SNAPSHOT_UNREADABLE' USING ERRCODE = '22023';
  END IF;

  -- 1) capture current state
  SELECT jsonb_build_object(
    'v', 1,
    'song', jsonb_build_object('title', s.title),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sec.id,
        'kind', sec.kind,
        'label', sec.label,
        'position', sec.position,
        'lyrics', CASE WHEN l.section_id IS NULL THEN NULL
                       ELSE jsonb_build_object('content', l.content, 'plain_text', l.plain_text) END
      ) ORDER BY sec.position)
      FROM public.song_sections sec
      LEFT JOIN public.song_lyrics l ON l.section_id = sec.id
      WHERE sec.song_id = _song_id
    ), '[]'::jsonb)
  ) INTO _cur
  FROM public.songs s WHERE s.id = _song_id;

  SELECT id INTO _head_id FROM public.song_versions
   WHERE song_id = _song_id ORDER BY version_number DESC LIMIT 1;

  INSERT INTO public.song_versions (song_id, kind, label, snapshot, parent_version_id, created_by_user_id)
  VALUES (_song_id, 'auto', 'Before restoring v' || _target.version_number, _cur, _head_id, _uid)
  RETURNING id INTO _pre_id;

  -- 2) apply target snapshot
  DELETE FROM public.song_lyrics
   WHERE song_id = _song_id
     AND section_id NOT IN (
       SELECT (s ->> 'id')::uuid FROM jsonb_array_elements(_snap -> 'sections') s
     );

  DELETE FROM public.song_sections
   WHERE song_id = _song_id
     AND id NOT IN (
       SELECT (s ->> 'id')::uuid FROM jsonb_array_elements(_snap -> 'sections') s
     );

  INSERT INTO public.song_sections (id, song_id, kind, label, position, created_by_user_id, updated_at)
  SELECT (s ->> 'id')::uuid, _song_id, (s ->> 'kind')::section_kind, s ->> 'label',
         COALESCE((s ->> 'position')::int, 0), _uid, now()
    FROM jsonb_array_elements(_snap -> 'sections') s
  ON CONFLICT (id) DO UPDATE
    SET kind = EXCLUDED.kind,
        label = EXCLUDED.label,
        position = EXCLUDED.position,
        updated_at = now();

  DELETE FROM public.song_lyrics
   WHERE song_id = _song_id
     AND section_id IN (
       SELECT (s ->> 'id')::uuid FROM jsonb_array_elements(_snap -> 'sections') s
        WHERE s -> 'lyrics' IS NULL OR jsonb_typeof(s -> 'lyrics') = 'null'
     );

  INSERT INTO public.song_lyrics (song_id, section_id, content, plain_text, updated_by_user_id, updated_at)
  SELECT _song_id, (s ->> 'id')::uuid,
         COALESCE(s -> 'lyrics' -> 'content', '{}'::jsonb),
         COALESCE(s -> 'lyrics' ->> 'plain_text', ''),
         _uid, now()
    FROM jsonb_array_elements(_snap -> 'sections') s
   WHERE s -> 'lyrics' IS NOT NULL AND jsonb_typeof(s -> 'lyrics') <> 'null'
  ON CONFLICT (section_id) DO UPDATE
    SET content = EXCLUDED.content,
        plain_text = EXCLUDED.plain_text,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = now();

  -- 3) record the restore
  INSERT INTO public.song_versions (song_id, kind, label, description, snapshot, parent_version_id, created_by_user_id)
  VALUES (_song_id, 'restore_point', 'Restored from v' || _target.version_number,
          'The song was brought back to version ' || _target.version_number || '.',
          _snap, _target.id, _uid)
  RETURNING id INTO _restore_id;

  UPDATE public.songs SET last_activity_at = now(), updated_at = now() WHERE id = _song_id;

  RETURN jsonb_build_object(
    'pre_restore_version_id', _pre_id,
    'restore_point_version_id', _restore_id,
    'restored_from_version_number', _target.version_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_song_version(uuid, uuid) TO authenticated;