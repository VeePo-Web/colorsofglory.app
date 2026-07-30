CREATE OR REPLACE FUNCTION public.song_room_capabilities(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _locked boolean;
  _owner uuid;
  _can_write boolean;
  _can_comment boolean;
  _storage_ok boolean := true;
  _reason text := NULL;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT s.is_locked, s.owner_user_id INTO _locked, _owner
  FROM public.songs s WHERE s.id = _song_id;

  _role := public.song_role(_song_id, _uid)::text;

  _can_write   := _role IN ('owner', 'collaborator') AND NOT COALESCE(_locked, false);
  _can_comment := _role IN ('owner', 'collaborator', 'viewer');

  BEGIN
    _storage_ok := public.can_upload_bytes(_owner, 1);
  EXCEPTION WHEN OTHERS THEN
    _storage_ok := true;
  END;

  IF _role = 'viewer' THEN
    _reason := 'view_only';
  ELSIF COALESCE(_locked, false) THEN
    _reason := 'song_locked';
  ELSIF NOT _storage_ok THEN
    _reason := 'storage_full';
  END IF;

  RETURN jsonb_build_object(
    'role', _role,
    'is_owner', _role = 'owner',
    'is_locked', COALESCE(_locked, false),
    'storage_ok', _storage_ok,
    'reason', _reason,
    'can', jsonb_build_object(
      'write_lyrics',   _can_write,
      'edit_board',     _can_write,
      'capture_idea',   _can_write,
      'record_audio',   _can_write AND _storage_ok,
      'upload_audio',   _can_write AND _storage_ok,
      'comment',        _can_comment,
      'react',          _can_comment,
      'invite',         _role = 'owner',
      'manage_members', _role = 'owner',
      'rename_song',    _role = 'owner',
      'archive_song',   _role = 'owner',
      'archive_card',   _can_write,
      'restore_card',   _can_write,
      'export',         _can_comment
    ),
    'server_time', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.song_room_capabilities(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_room_capabilities(uuid) TO authenticated;