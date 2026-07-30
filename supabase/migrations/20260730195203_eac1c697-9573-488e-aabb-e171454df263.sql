CREATE OR REPLACE FUNCTION public.song_next_move(_song_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role text;
  _song record;
  _sections int;
  _open_suggestions int;
  _unfiled int;
  _members int;
  _pending_invites int;
  _gap record;
  _unnamed boolean;
  _can_write boolean;
BEGIN
  IF _uid IS NULL OR NOT public.is_song_member(_song_id, _uid) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  _role := public.song_role(_song_id, _uid);
  _can_write := _role IN ('owner', 'contributor');

  SELECT s.* INTO _song FROM public.songs s WHERE s.id = _song_id;

  _unnamed := length(btrim(coalesce(_song.title, ''))) = 0
              OR lower(btrim(coalesce(_song.title, ''))) IN ('untitled', 'untitled song', 'new song');

  SELECT count(*) INTO _sections FROM public.song_sections ss WHERE ss.song_id = _song_id;

  SELECT count(*) INTO _open_suggestions
  FROM public.lyric_suggestions ls
  WHERE ls.song_id = _song_id AND ls.status = 'open';

  SELECT count(*) INTO _unfiled
  FROM public.voice_memos v
  WHERE v.song_id = _song_id AND v.section_id IS NULL AND v.status <> 'deleted';

  SELECT count(*) INTO _members FROM public.song_members m WHERE m.song_id = _song_id;

  SELECT count(*) INTO _pending_invites
  FROM public.song_invites i
  WHERE i.song_id = _song_id AND i.status = 'pending' AND i.expires_at > now();

  -- The most useful unfinished part, nearest the top of the song.
  SELECT g.section_id, g.label, g.gap INTO _gap
  FROM public.song_gaps(_song_id) g
  WHERE g.gap <> 'complete'
  ORDER BY (g.gap = 'empty') DESC, g.section_position
  LIMIT 1;

  -- A finished song asks for nothing.
  IF _song.finished_at IS NOT NULL THEN
    RETURN jsonb_build_object('kind', 'none');
  END IF;

  -- 1. Somebody is waiting on YOU. Answering a person outranks everything.
  IF _open_suggestions > 0 AND _role = 'owner' THEN
    RETURN jsonb_build_object(
      'kind', 'review_suggestion',
      'headline', CASE WHEN _open_suggestions = 1
        THEN 'A suggested line is waiting'
        ELSE _open_suggestions || ' suggested lines are waiting' END,
      'action', 'Read it',
      'target_type', 'suggestions',
      'target_id', null,
      'count', _open_suggestions
    );
  END IF;

  -- 2. The room is brand new — one door, no choices.
  IF _sections = 0 THEN
    RETURN jsonb_build_object(
      'kind', CASE WHEN _can_write THEN 'first_part' ELSE 'none' END,
      'headline', 'This song is empty',
      'action', 'Start a part',
      'target_type', 'section_new',
      'target_id', null
    );
  END IF;

  -- 3. Something was captured but never put anywhere.
  IF _unfiled > 0 AND _can_write THEN
    RETURN jsonb_build_object(
      'kind', 'file_memo',
      'headline', CASE WHEN _unfiled = 1
        THEN 'One recording has no home yet'
        ELSE _unfiled || ' recordings have no home yet' END,
      'action', 'Put it in a part',
      'target_type', 'unfiled',
      'target_id', null,
      'count', _unfiled
    );
  END IF;

  -- 4. A part of the song is unfinished.
  IF _gap.section_id IS NOT NULL AND _can_write THEN
    RETURN jsonb_build_object(
      'kind', CASE _gap.gap
                WHEN 'no_words' THEN 'write_words'
                WHEN 'no_sound' THEN 'record_part'
                ELSE 'fill_part' END,
      'headline', CASE _gap.gap
                WHEN 'no_words' THEN _gap.label || ' has no words yet'
                WHEN 'no_sound' THEN _gap.label || ' has never been sung'
                ELSE _gap.label || ' is still empty' END,
      'action', CASE _gap.gap
                WHEN 'no_sound' THEN 'Sing it'
                ELSE 'Write it' END,
      'target_type', 'section',
      'target_id', _gap.section_id
    );
  END IF;

  -- 5. The song works but has no name — naming makes it findable and shareable.
  IF _unnamed AND _role = 'owner' THEN
    RETURN jsonb_build_object(
      'kind', 'name_song',
      'headline', 'This song still has no name',
      'action', 'Name it',
      'target_type', 'title',
      'target_id', null
    );
  END IF;

  -- 6. It is still a solo song. The invite is the growth loop.
  IF _members <= 1 AND _pending_invites = 0 AND _role = 'owner' THEN
    RETURN jsonb_build_object(
      'kind', 'invite',
      'headline', 'Nobody else has heard this yet',
      'action', 'Invite someone',
      'target_type', 'people',
      'target_id', null
    );
  END IF;

  -- 7. Every part is done — offer the ending, never force it.
  IF _gap.section_id IS NULL AND _sections > 1 AND _role = 'owner' THEN
    RETURN jsonb_build_object(
      'kind', 'finish',
      'headline', 'Every part of this song is filled in',
      'action', 'Call it finished',
      'target_type', 'finish',
      'target_id', null
    );
  END IF;

  RETURN jsonb_build_object('kind', 'none');
END;
$$;

REVOKE ALL ON FUNCTION public.song_next_move(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.song_next_move(uuid) TO authenticated;