
-- R27: song hub board — tiny read for the 5-panel room screen --------------

CREATE OR REPLACE FUNCTION public.song_hub_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _last_seen timestamptz;
  _song public.songs;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _song FROM public.songs WHERE id = _song_id;
  _role := public.song_role(_song_id, _uid);

  SELECT last_seen_at INTO _last_seen
  FROM public.song_notification_prefs
  WHERE song_id = _song_id AND user_id = _uid;

  RETURN jsonb_build_object(
    'song', jsonb_build_object(
      'id', _song.id,
      'title', _song.title,
      'status', _song.status,
      'key_signature', _song.key_signature,
      'tempo_bpm', _song.tempo_bpm,
      'time_signature', _song.time_signature,
      'is_locked', _song.is_locked,
      'lyrics_snippet', _song.lyrics_snippet,
      'dedication', _song.dedication,
      'last_activity_at', _song.last_activity_at
    ),
    'role', _role,
    'can_write', _role IN ('owner', 'collaborator'),

    'lyrics', jsonb_build_object(
      'section_count', (SELECT count(*) FROM public.song_sections s WHERE s.song_id = _song_id),
      'line_count', (
        SELECT COALESCE(sum(jsonb_array_length(COALESCE(sl.content->'lines', '[]'::jsonb))), 0)
        FROM public.song_lyrics sl WHERE sl.song_id = _song_id
      ),
      'updated_at', (SELECT max(sl.updated_at) FROM public.song_lyrics sl WHERE sl.song_id = _song_id),
      'preview', (
        SELECT COALESCE(sec.label, sec.kind::text)
        FROM public.song_sections sec
        WHERE sec.song_id = _song_id
        ORDER BY sec.position
        LIMIT 1
      )
    ),

    'voice', jsonb_build_object(
      'memo_count', (SELECT count(*) FROM public.voice_memos m WHERE m.song_id = _song_id AND m.status <> 'deleted'),
      'take_count', (SELECT count(*) FROM public.takes t WHERE t.song_id = _song_id AND NOT t.is_archived),
      'total_duration_ms', (SELECT COALESCE(sum(t.duration_ms), 0) FROM public.takes t WHERE t.song_id = _song_id AND NOT t.is_archived),
      'updated_at', (SELECT max(t.created_at) FROM public.takes t WHERE t.song_id = _song_id AND NOT t.is_archived)
    ),

    'chords', jsonb_build_object(
      'progression_count', (SELECT count(*) FROM public.chord_progressions c WHERE c.song_id = _song_id AND COALESCE(c.label,'') <> '__sheet_meta__'),
      'updated_at', (SELECT max(c.updated_at) FROM public.chord_progressions c WHERE c.song_id = _song_id)
    ),

    'notes', jsonb_build_object(
      'open_count', (SELECT count(*) FROM public.song_notes n WHERE n.song_id = _song_id AND n.archived_at IS NULL AND n.resolved_at IS NULL),
      'pinned_count', (SELECT count(*) FROM public.song_notes n WHERE n.song_id = _song_id AND n.archived_at IS NULL AND n.pinned),
      'updated_at', (SELECT max(n.updated_at) FROM public.song_notes n WHERE n.song_id = _song_id AND n.archived_at IS NULL)
    ),

    'people', jsonb_build_object(
      'member_count', (SELECT count(*) FROM public.song_members sm WHERE sm.song_id = _song_id),
      'pending_invite_count', (SELECT count(*) FROM public.song_invites i WHERE i.song_id = _song_id AND i.status = 'pending' AND i.expires_at > now()),
      'avatars', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'user_id', sm.user_id,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url,
                 'avatar_color', p.avatar_color
               ) ORDER BY sm.joined_at), '[]'::jsonb)
        FROM (SELECT * FROM public.song_members m WHERE m.song_id = _song_id ORDER BY m.joined_at LIMIT 5) sm
        LEFT JOIN public.profiles p ON p.user_id = sm.user_id
      )
    ),

    'waiting', jsonb_build_object(
      'unseen_activity', (
        SELECT count(*) FROM public.song_activity a
        WHERE a.song_id = _song_id
          AND a.actor_user_id IS DISTINCT FROM _uid
          AND (_last_seen IS NULL OR a.created_at > _last_seen)
      ),
      'open_suggestions', (
        SELECT count(*) FROM public.lyric_suggestions s
        WHERE s.song_id = _song_id AND s.status = 'open'
      ),
      'unfiled_captures', (
        SELECT count(*) FROM public.idea_captures c
        WHERE c.song_id = _song_id
          AND c.archived_at IS NULL
          AND c.promoted_card_id IS NULL
      ),
      'failed_transcripts', (
        SELECT count(*) FROM public.takes t
        WHERE t.song_id = _song_id AND t.transcript_status = 'failed'
      )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_hub_board(uuid) TO authenticated;
