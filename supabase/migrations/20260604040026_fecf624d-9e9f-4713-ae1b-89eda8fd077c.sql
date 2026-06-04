
-- 1. Enum
CREATE TYPE public.onboarding_step AS ENUM (
  'not_started',
  'intent_selected',
  'founder_code_seen',
  'first_song_created',
  'first_idea_captured',
  'first_voice_memo_added',
  'first_lyrics_added',
  'first_collaborator_invited',
  'completed',
  'dismissed'
);

-- 2. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN onboarding_step public.onboarding_step NOT NULL DEFAULT 'not_started',
  ADD COLUMN onboarding_state jsonb NOT NULL DEFAULT jsonb_build_object('history','[]'::jsonb),
  ADD COLUMN onboarding_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN first_song_id uuid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_onboarding_state_size
  CHECK (octet_length(onboarding_state::text) < 4096);

-- 3. Rank helper
CREATE OR REPLACE FUNCTION public.onboarding_step_rank(_s public.onboarding_step)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _s
    WHEN 'not_started' THEN 0
    WHEN 'intent_selected' THEN 1
    WHEN 'founder_code_seen' THEN 2
    WHEN 'first_song_created' THEN 3
    WHEN 'first_idea_captured' THEN 4
    WHEN 'first_voice_memo_added' THEN 5
    WHEN 'first_lyrics_added' THEN 6
    WHEN 'first_collaborator_invited' THEN 7
    WHEN 'completed' THEN 99
    WHEN 'dismissed' THEN 99
  END;
$$;

-- 4. Legal-next helper
CREATE OR REPLACE FUNCTION public.onboarding_legal_next(_from public.onboarding_step)
RETURNS public.onboarding_step[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _from
    WHEN 'not_started' THEN ARRAY['intent_selected','dismissed']::public.onboarding_step[]
    WHEN 'intent_selected' THEN ARRAY['founder_code_seen','first_song_created','dismissed']::public.onboarding_step[]
    WHEN 'founder_code_seen' THEN ARRAY['first_song_created','dismissed']::public.onboarding_step[]
    WHEN 'first_song_created' THEN ARRAY['first_idea_captured','first_voice_memo_added','first_lyrics_added','dismissed']::public.onboarding_step[]
    WHEN 'first_idea_captured' THEN ARRAY['first_voice_memo_added','first_lyrics_added','first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_voice_memo_added' THEN ARRAY['first_lyrics_added','first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_lyrics_added' THEN ARRAY['first_collaborator_invited','completed','dismissed']::public.onboarding_step[]
    WHEN 'first_collaborator_invited' THEN ARRAY['completed','dismissed']::public.onboarding_step[]
    ELSE ARRAY[]::public.onboarding_step[]
  END;
$$;

-- 5. Advance function
CREATE OR REPLACE FUNCTION public.advance_onboarding(
  _user_id uuid,
  _to public.onboarding_step,
  _patch jsonb,
  _source text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur public.onboarding_step;
  cur_state jsonb;
  legal public.onboarding_step[];
  new_state jsonb;
  hist jsonb;
  allowed_keys text[] := ARRAY['intent','first_song_id','first_memo_id','founder_code_redeemed','dismissed_reason','dismissed_at','completed_at'];
  clean_patch jsonb := '{}'::jsonb;
  k text;
BEGIN
  IF _user_id IS NULL THEN RETURN 'UNAUTHENTICATED'; END IF;

  SELECT onboarding_step, onboarding_state INTO cur, cur_state
    FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL THEN RETURN 'PROFILE_NOT_FOUND'; END IF;

  -- No-op
  IF cur = _to THEN RETURN 'OK'; END IF;

  -- Terminal
  IF cur IN ('completed','dismissed') THEN RETURN 'TERMINAL'; END IF;

  -- Legal transition?
  legal := public.onboarding_legal_next(cur);
  IF NOT (_to = ANY(legal)) THEN RETURN 'INVALID_TRANSITION'; END IF;

  -- Whitelist patch keys
  IF _patch IS NOT NULL AND jsonb_typeof(_patch) = 'object' THEN
    FOREACH k IN ARRAY allowed_keys LOOP
      IF _patch ? k THEN
        clean_patch := clean_patch || jsonb_build_object(k, _patch -> k);
      END IF;
    END LOOP;
  END IF;

  -- Append history (trim to last 20)
  hist := COALESCE(cur_state -> 'history', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('step', _to, 'at', now(), 'source', COALESCE(_source,'user')));
  IF jsonb_array_length(hist) > 20 THEN
    hist := (SELECT jsonb_agg(e) FROM (
      SELECT e FROM jsonb_array_elements(hist) WITH ORDINALITY AS t(e, ord)
      ORDER BY ord DESC LIMIT 20
    ) sub);
    hist := (SELECT jsonb_agg(value ORDER BY idx DESC) FROM jsonb_array_elements(hist) WITH ORDINALITY AS x(value, idx));
  END IF;

  new_state := COALESCE(cur_state, '{}'::jsonb) || clean_patch || jsonb_build_object('history', hist);

  IF _to = 'dismissed' AND NOT (new_state ? 'dismissed_at') THEN
    new_state := new_state || jsonb_build_object('dismissed_at', now());
  END IF;
  IF _to = 'completed' AND NOT (new_state ? 'completed_at') THEN
    new_state := new_state || jsonb_build_object('completed_at', now());
  END IF;

  UPDATE public.profiles
    SET onboarding_step = _to,
        onboarding_state = new_state,
        onboarding_updated_at = now(),
        first_song_id = COALESCE(first_song_id, NULLIF(new_state ->> 'first_song_id','')::uuid)
    WHERE user_id = _user_id;

  PERFORM public.write_audit(_user_id, 'onboarding_advance', 'profile', _user_id,
    jsonb_build_object('from', cur),
    jsonb_build_object('to', _to, 'source', _source),
    NULL);

  RETURN 'OK';
END;
$$;

-- 6. Convenience: complete from anywhere non-terminal
CREATE OR REPLACE FUNCTION public.complete_onboarding(_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cur public.onboarding_step;
BEGIN
  SELECT onboarding_step INTO cur FROM public.profiles WHERE user_id = _user_id FOR UPDATE;
  IF cur IS NULL THEN RETURN 'PROFILE_NOT_FOUND'; END IF;
  IF cur IN ('completed','dismissed') THEN RETURN 'TERMINAL'; END IF;
  UPDATE public.profiles
    SET onboarding_step = 'completed',
        onboarding_state = onboarding_state || jsonb_build_object('completed_at', now()),
        onboarding_updated_at = now()
    WHERE user_id = _user_id;
  PERFORM public.write_audit(_user_id, 'onboarding_complete_forced', 'profile', _user_id,
    jsonb_build_object('from', cur), jsonb_build_object('to','completed'), NULL);
  RETURN 'OK';
END;
$$;

-- 7. Auto-evidence: songs
CREATE OR REPLACE FUNCTION public.on_song_insert_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prof_first uuid;
  cur_step public.onboarding_step;
  patch jsonb;
BEGIN
  SELECT first_song_id, onboarding_step INTO prof_first, cur_step
    FROM public.profiles WHERE user_id = NEW.owner_user_id;
  IF cur_step IS NULL OR cur_step IN ('completed','dismissed') THEN RETURN NEW; END IF;
  IF public.onboarding_step_rank(cur_step) >= public.onboarding_step_rank('first_song_created') THEN
    RETURN NEW;
  END IF;
  patch := jsonb_build_object('first_song_id', NEW.id);
  -- Force advance regardless of legal-next set (auto-skip earlier steps)
  UPDATE public.profiles
    SET onboarding_step = 'first_song_created',
        onboarding_state = onboarding_state || patch || jsonb_build_object(
          'history', COALESCE(onboarding_state -> 'history','[]'::jsonb)
            || jsonb_build_array(jsonb_build_object('step','first_song_created','at',now(),'source','trigger:song_insert'))
        ),
        onboarding_updated_at = now(),
        first_song_id = COALESCE(first_song_id, NEW.id)
    WHERE user_id = NEW.owner_user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_onboarding_song_insert
  AFTER INSERT ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.on_song_insert_onboarding();

-- 8. Generic owner-event advancer
CREATE OR REPLACE FUNCTION public.advance_onboarding_for_song_owner(
  _song_id uuid, _to public.onboarding_step, _source text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner uuid;
  cur public.onboarding_step;
  target_first uuid;
BEGIN
  SELECT owner_user_id INTO owner FROM public.songs WHERE id = _song_id;
  IF owner IS NULL THEN RETURN; END IF;
  SELECT onboarding_step, first_song_id INTO cur, target_first
    FROM public.profiles WHERE user_id = owner FOR UPDATE;
  IF cur IS NULL OR cur IN ('completed','dismissed') THEN RETURN; END IF;
  -- Only advance for the user's first song
  IF target_first IS NOT NULL AND target_first <> _song_id THEN RETURN; END IF;
  IF public.onboarding_step_rank(cur) >= public.onboarding_step_rank(_to) THEN RETURN; END IF;
  UPDATE public.profiles
    SET onboarding_step = _to,
        onboarding_state = onboarding_state || jsonb_build_object(
          'history', COALESCE(onboarding_state -> 'history','[]'::jsonb)
            || jsonb_build_array(jsonb_build_object('step',_to,'at',now(),'source',_source))
        ),
        onboarding_updated_at = now()
    WHERE user_id = owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_voice_memo_insert_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.advance_onboarding_for_song_owner(NEW.song_id, 'first_voice_memo_added','trigger:voice_memo_insert');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_onboarding_voice_memo_insert
  AFTER INSERT ON public.voice_memos
  FOR EACH ROW EXECUTE FUNCTION public.on_voice_memo_insert_onboarding();

CREATE OR REPLACE FUNCTION public.on_song_lyric_insert_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT song_id INTO sid FROM public.song_sections WHERE id = NEW.section_id;
  IF sid IS NOT NULL THEN
    PERFORM public.advance_onboarding_for_song_owner(sid, 'first_lyrics_added','trigger:song_lyric_insert');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_onboarding_song_lyric_insert
  AFTER INSERT ON public.song_lyrics
  FOR EACH ROW EXECUTE FUNCTION public.on_song_lyric_insert_onboarding();

CREATE OR REPLACE FUNCTION public.on_song_note_insert_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.advance_onboarding_for_song_owner(NEW.song_id, 'first_idea_captured','trigger:song_note_insert');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_onboarding_song_note_insert
  AFTER INSERT ON public.song_notes
  FOR EACH ROW EXECUTE FUNCTION public.on_song_note_insert_onboarding();

CREATE OR REPLACE FUNCTION public.on_song_invite_insert_onboarding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.advance_onboarding_for_song_owner(NEW.song_id, 'first_collaborator_invited','trigger:song_invite_insert');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_onboarding_song_invite_insert
  AFTER INSERT ON public.song_invites
  FOR EACH ROW EXECUTE FUNCTION public.on_song_invite_insert_onboarding();

-- 9. handle_new_user — explicit defaults (defaults handle this but keep explicit for clarity)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ref_code text;
  referrer_uid uuid;
  raw_ref text;
BEGIN
  ref_code := public.generate_referral_code();
  raw_ref := NEW.raw_user_meta_data ->> 'referred_by_code';
  IF raw_ref IS NOT NULL THEN
    SELECT user_id INTO referrer_uid FROM public.profiles WHERE referral_code = raw_ref;
  END IF;

  INSERT INTO public.profiles (
    user_id, display_name, avatar_url, email, phone,
    referral_code, referred_by_user_id,
    onboarding_step, onboarding_state, onboarding_updated_at
  ) VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.email,
    NEW.phone,
    ref_code,
    referrer_uid,
    'not_started',
    jsonb_build_object('history','[]'::jsonb),
    now()
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 10. Backfill existing rows
DO $$
DECLARE r record; inferred public.onboarding_step; sid uuid;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles LOOP
    SELECT id INTO sid FROM public.songs WHERE owner_user_id = r.user_id ORDER BY created_at ASC LIMIT 1;
    IF sid IS NULL THEN CONTINUE; END IF;
    inferred := 'first_song_created';
    IF EXISTS (SELECT 1 FROM public.voice_memos WHERE song_id = sid) THEN inferred := 'first_voice_memo_added'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.song_lyrics l
      JOIN public.song_sections s ON s.id = l.section_id
      WHERE s.song_id = sid
    ) THEN inferred := 'first_lyrics_added'; END IF;
    IF EXISTS (SELECT 1 FROM public.song_invites WHERE song_id = sid) THEN inferred := 'first_collaborator_invited'; END IF;
    UPDATE public.profiles
      SET onboarding_step = inferred,
          first_song_id = sid,
          onboarding_state = onboarding_state || jsonb_build_object('first_song_id', sid, 'backfilled', true),
          onboarding_updated_at = now()
      WHERE user_id = r.user_id;
  END LOOP;
END $$;
