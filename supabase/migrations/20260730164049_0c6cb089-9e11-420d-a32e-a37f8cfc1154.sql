
-- R24: Credits board -----------------------------------------------------

ALTER TABLE public.song_members
  ADD COLUMN IF NOT EXISTS credit_note text;

CREATE OR REPLACE FUNCTION public.song_credits_board(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _people jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'not_a_member' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.role_rank, t.joined_at), '[]'::jsonb)
  INTO _people
  FROM (
    SELECT
      sm.user_id,
      COALESCE(p.display_name, 'Someone') AS name,
      p.avatar_url,
      p.avatar_color,
      sm.role,
      CASE sm.role WHEN 'owner' THEN 0 WHEN 'collaborator' THEN 1 ELSE 2 END AS role_rank,
      sm.joined_at,
      sm.credit_note,
      (SELECT count(*) FROM public.song_lyrics l
        WHERE l.song_id = _song_id AND l.updated_by_user_id = sm.user_id) AS lyric_edits,
      (SELECT count(*) FROM public.takes tk
        WHERE tk.song_id = _song_id AND tk.created_by = sm.user_id AND NOT tk.is_archived) AS takes,
      (SELECT count(*) FROM public.idea_captures ic
        WHERE ic.song_id = _song_id AND ic.author_user_id = sm.user_id AND ic.archived_at IS NULL) AS ideas,
      (SELECT count(*) FROM public.song_notes n
        WHERE n.song_id = _song_id AND n.author_user_id = sm.user_id AND n.archived_at IS NULL) AS notes,
      (SELECT count(*) FROM public.chord_progressions cp
        WHERE cp.song_id = _song_id AND cp.created_by_user_id = sm.user_id) AS chord_changes,
      (SELECT min(a.created_at) FROM public.song_activity a
        WHERE a.song_id = _song_id AND a.actor_user_id = sm.user_id) AS first_contribution_at,
      (SELECT max(a.created_at) FROM public.song_activity a
        WHERE a.song_id = _song_id AND a.actor_user_id = sm.user_id) AS last_contribution_at
    FROM public.song_members sm
    LEFT JOIN public.profiles p ON p.user_id = sm.user_id
    WHERE sm.song_id = _song_id
  ) t;

  RETURN jsonb_build_object(
    'song', (
      SELECT jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'dedication', s.dedication,
        'created_at', s.created_at
      ) FROM public.songs s WHERE s.id = _song_id
    ),
    'my_role', public.song_role(_song_id, _uid),
    'people', _people,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.song_credits_board(uuid) TO authenticated;

-- Owner-only credit line --------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_member_credit_note(
  _song_id uuid,
  _member_user_id uuid,
  _credit_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _clean text;
BEGIN
  IF _uid IS NULL OR public.song_role(_song_id, _uid) <> 'owner' THEN
    RAISE EXCEPTION 'owner_only' USING ERRCODE = '42501';
  END IF;

  _clean := NULLIF(btrim(COALESCE(_credit_note, '')), '');
  IF _clean IS NOT NULL AND length(_clean) > 120 THEN
    _clean := left(_clean, 120);
  END IF;

  UPDATE public.song_members
  SET credit_note = _clean
  WHERE song_id = _song_id AND user_id = _member_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_song_activity(_song_id, 'credits_updated', 'song_member', _member_user_id, '{}'::jsonb);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_credit_note(uuid, uuid, text) TO authenticated;
