CREATE OR REPLACE FUNCTION public.song_arrival(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _first boolean := false;
  _seen timestamptz;
  _title text;
  _owner uuid;
  _owner_name text;
  _inviter_name text;
  _sections int := 0;
  _takes int := 0;
  _people int := 0;
  _with_words int := 0;
  _empty_section uuid;
  _empty_label text;
  _kind text;
  _headline text;
  _action text;
  _target text;
  _target_id uuid;
  _permission text;
  _room_line text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  _role := public.song_role(_song_id, _uid);
  IF _role IS NULL THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT s.title, s.owner_user_id INTO _title, _owner
    FROM public.songs s WHERE s.id = _song_id;

  SELECT p.last_seen_at INTO _seen
    FROM public.song_notification_prefs p
   WHERE p.song_id = _song_id AND p.user_id = _uid;
  _first := (_seen IS NULL);

  SELECT COALESCE(NULLIF(TRIM(pr.display_name), ''), 'the owner')
    INTO _owner_name
    FROM public.profiles pr WHERE pr.user_id = _owner;

  SELECT COALESCE(NULLIF(TRIM(pr.display_name), ''), NULL)
    INTO _inviter_name
    FROM public.song_members m
    LEFT JOIN public.profiles pr ON pr.user_id = m.invited_by_user_id
   WHERE m.song_id = _song_id AND m.user_id = _uid;

  SELECT count(*) INTO _sections FROM public.song_sections WHERE song_id = _song_id;
  SELECT count(*) INTO _takes FROM public.takes WHERE song_id = _song_id AND NOT is_archived;
  SELECT count(*) INTO _people FROM public.song_members WHERE song_id = _song_id;
  SELECT count(*) INTO _with_words
    FROM public.song_lyrics l
   WHERE l.song_id = _song_id AND length(TRIM(COALESCE(l.plain_text, ''))) > 0;

  SELECT s.id, COALESCE(NULLIF(TRIM(s.label), ''), initcap(replace(s.kind::text, '_', ' ')))
    INTO _empty_section, _empty_label
    FROM public.song_sections s
    LEFT JOIN public.song_lyrics l ON l.section_id = s.id
   WHERE s.song_id = _song_id
     AND length(TRIM(COALESCE(l.plain_text, ''))) = 0
   ORDER BY s.position ASC
   LIMIT 1;

  -- What is already here, in one sentence a stranger understands.
  _room_line := CASE
    WHEN _sections = 0 AND _takes = 0 THEN 'Nothing here yet — it starts with you.'
    WHEN _takes = 0 THEN _sections || CASE WHEN _sections = 1 THEN ' part' ELSE ' parts' END || ', no recordings yet.'
    WHEN _sections = 0 THEN _takes || CASE WHEN _takes = 1 THEN ' recording' ELSE ' recordings' END || ', no words yet.'
    ELSE _sections || CASE WHEN _sections = 1 THEN ' part' ELSE ' parts' END || ' and ' ||
         _takes || CASE WHEN _takes = 1 THEN ' recording' ELSE ' recordings' END || '.'
  END;

  -- What you may do here, said as a capability, never as a role name.
  _permission := CASE _role
    WHEN 'owner' THEN 'This song is yours.'
    WHEN 'collaborator' THEN 'You can write, record and comment here.'
    ELSE 'You can listen and read here.'
  END;

  -- The one first move. Listening always beats writing for a newcomer.
  IF _role = 'viewer' THEN
    IF _takes > 0 THEN
      _kind := 'listen'; _headline := 'Start with what ' || _owner_name || ' has so far.';
      _action := 'Listen'; _target := 'takes';
    ELSE
      _kind := 'read'; _headline := 'Read the words so far.'; _action := 'Open the words'; _target := 'sheet';
    END IF;
  ELSIF _sections = 0 AND _takes = 0 THEN
    _kind := 'first_part'; _headline := 'This song is empty. Put down the first idea.';
    _action := 'Add a part'; _target := 'section_new';
  ELSIF _takes > 0 AND _first THEN
    _kind := 'listen'; _headline := 'Hear it before you change it.';
    _action := 'Listen'; _target := 'takes';
  ELSIF _empty_section IS NOT NULL THEN
    _kind := 'fill_part'; _headline := _empty_label || ' has no words yet.';
    _action := 'Write it'; _target := 'section'; _target_id := _empty_section;
  ELSIF _with_words > 0 AND _takes = 0 THEN
    _kind := 'record'; _headline := 'There are words but nothing sung yet.';
    _action := 'Record it'; _target := 'record';
  ELSE
    _kind := 'listen'; _headline := 'Have a listen and leave one note.';
    _action := 'Listen'; _target := 'takes';
  END IF;

  -- Mark the visit so the welcome never shows twice.
  INSERT INTO public.song_notification_prefs (user_id, song_id, last_seen_at)
  VALUES (_uid, _song_id, now())
  ON CONFLICT (user_id, song_id) DO UPDATE SET last_seen_at = now(), updated_at = now();

  RETURN jsonb_build_object(
    'first_visit', _first,
    'song_id', _song_id,
    'title', _title,
    'is_owner', (_owner = _uid),
    'owner_name', _owner_name,
    'invited_by_name', _inviter_name,
    'people_count', _people,
    'room_line', _room_line,
    'permission_line', _permission,
    'first_move', jsonb_build_object(
      'kind', _kind,
      'headline', _headline,
      'action', _action,
      'target_type', _target,
      'target_id', _target_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_arrival(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.song_arrival(uuid) TO authenticated;