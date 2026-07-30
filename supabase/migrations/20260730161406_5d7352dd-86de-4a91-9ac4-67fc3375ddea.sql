-- R14: one-call export payload for a song ------------------------------------

CREATE OR REPLACE FUNCTION public.song_export_payload(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _song record;
  _sections jsonb;
  _takes jsonb;
  _credits jsonb;
  _meta jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.title, s.key_signature, s.tempo_bpm, s.time_signature,
         s.dedication, s.tags, s.created_at, s.updated_at, s.owner_user_id
    INTO _song
    FROM public.songs s
   WHERE s.id = _song_id;

  IF _song.id IS NULL THEN
    RAISE EXCEPTION 'song_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x.position), '[]'::jsonb) INTO _sections
  FROM (
    SELECT sec.position,
           jsonb_build_object(
             'section_id', sec.id,
             'label', COALESCE(sec.label, initcap(replace(sec.kind::text, '_', ' '))),
             'kind', sec.kind,
             'position', sec.position,
             'content', l.content,
             'plain_text', COALESCE(l.plain_text, ''),
             'updated_at', l.updated_at
           ) AS section
      FROM public.song_sections sec
      LEFT JOIN public.song_lyrics l
        ON l.section_id = sec.id AND l.song_id = sec.song_id
     WHERE sec.song_id = _song_id
  ) q, LATERAL (SELECT q.section) AS x(section)
  , LATERAL (SELECT q.position) AS p(position);

  -- rebuild cleanly (the LATERAL above is only for ordering ergonomics)
  SELECT COALESCE(jsonb_agg(t.section ORDER BY t.position), '[]'::jsonb) INTO _sections
  FROM (
    SELECT sec.position,
           jsonb_build_object(
             'section_id', sec.id,
             'label', COALESCE(sec.label, initcap(replace(sec.kind::text, '_', ' '))),
             'kind', sec.kind,
             'position', sec.position,
             'content', l.content,
             'plain_text', COALESCE(l.plain_text, ''),
             'updated_at', l.updated_at
           ) AS section
      FROM public.song_sections sec
      LEFT JOIN public.song_lyrics l
        ON l.section_id = sec.id AND l.song_id = sec.song_id
     WHERE sec.song_id = _song_id
  ) t;

  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'take_id', tk.id,
             'name', COALESCE(tk.friendly_name, 'Take'),
             'duration_ms', tk.duration_ms,
             'is_primary', tk.is_primary,
             'created_by', tk.created_by,
             'created_at', tk.created_at
           ) ORDER BY tk.created_at
         ), '[]'::jsonb) INTO _takes
    FROM public.takes tk
   WHERE tk.song_id = _song_id AND tk.is_archived = false;

  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'role', c->>'name'), '[]'::jsonb) INTO _credits
  FROM (
    SELECT jsonb_build_object(
             'user_id', m.user_id,
             'name', COALESCE(NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), p.display_name, 'Collaborator'),
             'role', m.role,
             'joined_at', m.joined_at,
             'contributions', (
               SELECT COALESCE(jsonb_agg(DISTINCT k), '[]'::jsonb) FROM (
                 SELECT 'Lyrics'::text AS k WHERE EXISTS (
                   SELECT 1 FROM public.song_lyrics l WHERE l.song_id = _song_id AND l.updated_by_user_id = m.user_id)
                 UNION ALL
                 SELECT 'Voice memo' WHERE EXISTS (
                   SELECT 1 FROM public.takes t2 WHERE t2.song_id = _song_id AND t2.created_by = m.user_id AND t2.is_archived = false)
                 UNION ALL
                 SELECT 'Ideas' WHERE EXISTS (
                   SELECT 1 FROM public.canvas_cards cc WHERE cc.song_id = _song_id AND cc.created_by = m.user_id AND cc.archived_at IS NULL)
                 UNION ALL
                 SELECT 'Notes' WHERE EXISTS (
                   SELECT 1 FROM public.song_notes n WHERE n.song_id = _song_id AND n.author_user_id = m.user_id)
                 UNION ALL
                 SELECT 'Chords' WHERE EXISTS (
                   SELECT 1 FROM public.chord_progressions cp WHERE cp.song_id = _song_id AND cp.created_by_user_id = m.user_id)
               ) kinds(k)
             )
           ) AS c
      FROM public.song_members m
      LEFT JOIN public.profiles p ON p.user_id = m.user_id
     WHERE m.song_id = _song_id
  ) creds;

  SELECT cp.chords INTO _meta
    FROM public.chord_progressions cp
   WHERE cp.song_id = _song_id AND cp.label = '__sheet_meta__'
   LIMIT 1;

  RETURN jsonb_build_object(
    'song', jsonb_build_object(
      'id', _song.id,
      'title', _song.title,
      'key_signature', _song.key_signature,
      'tempo_bpm', _song.tempo_bpm,
      'time_signature', _song.time_signature,
      'dedication', _song.dedication,
      'tags', to_jsonb(_song.tags),
      'created_at', _song.created_at,
      'updated_at', _song.updated_at,
      'owner_user_id', _song.owner_user_id
    ),
    'sheet_meta', COALESCE(_meta, '{}'::jsonb),
    'sections', _sections,
    'takes', _takes,
    'credits', _credits,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_export_payload(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_export_payload(uuid) TO authenticated;