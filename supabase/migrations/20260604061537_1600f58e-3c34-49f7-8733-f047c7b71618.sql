
-- A. Trigger WHEN clause
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
    OR (OLD.phone_confirmed_at IS DISTINCT FROM NEW.phone_confirmed_at)
  )
  EXECUTE FUNCTION public.tg_on_auth_user_confirmed();

-- B. Indexes
CREATE INDEX IF NOT EXISTS profiles_onboarding_step_idx
  ON public.profiles (onboarding_step);
CREATE INDEX IF NOT EXISTS profiles_onboarding_updated_at_idx
  ON public.profiles (onboarding_updated_at DESC);
CREATE INDEX IF NOT EXISTS founder_redemptions_code_idx
  ON public.founder_redemptions (code);
CREATE INDEX IF NOT EXISTS founder_codes_active_expires_idx
  ON public.founder_codes (expires_at) WHERE active;

-- C. Fix advance_onboarding history trim (keep oldest->newest order)
CREATE OR REPLACE FUNCTION public.advance_onboarding(_user_id uuid, _to onboarding_step, _patch jsonb, _source text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF cur = _to THEN RETURN 'OK'; END IF;
  IF cur IN ('completed','dismissed') THEN RETURN 'TERMINAL'; END IF;

  legal := public.onboarding_legal_next(cur);
  IF NOT (_to = ANY(legal)) THEN RETURN 'INVALID_TRANSITION'; END IF;

  IF _patch IS NOT NULL AND jsonb_typeof(_patch) = 'object' THEN
    FOREACH k IN ARRAY allowed_keys LOOP
      IF _patch ? k THEN
        clean_patch := clean_patch || jsonb_build_object(k, _patch -> k);
      END IF;
    END LOOP;
  END IF;

  hist := COALESCE(cur_state -> 'history', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('step', _to, 'at', now(), 'source', COALESCE(_source,'user')));

  IF jsonb_array_length(hist) > 20 THEN
    hist := (
      SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT e, ord
        FROM jsonb_array_elements(hist) WITH ORDINALITY AS t(e, ord)
        ORDER BY ord DESC
        LIMIT 20
      ) sub
    );
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
$function$;

-- D. Lock-free fast-path for song-owner advances
CREATE OR REPLACE FUNCTION public.advance_onboarding_for_song_owner(_song_id uuid, _to onboarding_step, _source text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid;
  cur public.onboarding_step;
  target_first uuid;
  hist jsonb;
BEGIN
  SELECT owner_user_id INTO owner FROM public.songs WHERE id = _song_id;
  IF owner IS NULL THEN RETURN; END IF;

  -- Lock-free fast path
  SELECT onboarding_step, first_song_id INTO cur, target_first
    FROM public.profiles WHERE user_id = owner;
  IF cur IS NULL OR cur IN ('completed','dismissed') THEN RETURN; END IF;
  IF target_first IS NOT NULL AND target_first <> _song_id THEN RETURN; END IF;
  IF public.onboarding_step_rank(cur) >= public.onboarding_step_rank(_to) THEN RETURN; END IF;

  -- Re-check under lock
  SELECT onboarding_step, first_song_id INTO cur, target_first
    FROM public.profiles WHERE user_id = owner FOR UPDATE;
  IF cur IS NULL OR cur IN ('completed','dismissed') THEN RETURN; END IF;
  IF target_first IS NOT NULL AND target_first <> _song_id THEN RETURN; END IF;
  IF public.onboarding_step_rank(cur) >= public.onboarding_step_rank(_to) THEN RETURN; END IF;

  SELECT COALESCE(onboarding_state -> 'history', '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('step', _to, 'at', now(), 'source', _source))
    INTO hist
    FROM public.profiles WHERE user_id = owner;

  IF jsonb_array_length(hist) > 20 THEN
    hist := (
      SELECT COALESCE(jsonb_agg(e ORDER BY ord), '[]'::jsonb)
      FROM (
        SELECT e, ord
        FROM jsonb_array_elements(hist) WITH ORDINALITY AS t(e, ord)
        ORDER BY ord DESC
        LIMIT 20
      ) sub
    );
  END IF;

  UPDATE public.profiles
    SET onboarding_step = _to,
        onboarding_state = onboarding_state || jsonb_build_object('history', hist),
        onboarding_updated_at = now()
    WHERE user_id = owner;

  PERFORM public.write_audit(owner, 'onboarding_advance', 'profile', owner,
    jsonb_build_object('from', cur),
    jsonb_build_object('to', _to, 'source', _source, 'song_id', _song_id),
    NULL);
END;
$function$;

-- E. handle_new_user failure isolation
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
  norm_phone text;
BEGIN
  ref_code := public.generate_referral_code();

  -- Referral lookup is best-effort; a typo must never block signup
  BEGIN
    raw_ref := NEW.raw_user_meta_data ->> 'referred_by_code';
    IF raw_ref IS NOT NULL THEN
      SELECT user_id INTO referrer_uid FROM public.profiles WHERE referral_code = raw_ref;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    referrer_uid := NULL;
  END;

  norm_phone := CASE
    WHEN NEW.phone IS NULL OR NEW.phone = '' THEN NULL
    WHEN left(NEW.phone, 1) = '+' THEN NEW.phone
    ELSE '+' || NEW.phone
  END;

  INSERT INTO public.profiles (
    user_id, display_name, avatar_url, email, phone_e164,
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
    norm_phone,
    ref_code,
    referrer_uid,
    'not_started',
    jsonb_build_object('history','[]'::jsonb),
    now()
  );

  -- Role insert is best-effort; a duplicate or transient failure must never block signup
  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$function$;

-- F. founder_codes casing/format CHECK
ALTER TABLE public.founder_codes
  DROP CONSTRAINT IF EXISTS founder_codes_code_uppercase_chk;
ALTER TABLE public.founder_codes
  ADD CONSTRAINT founder_codes_code_uppercase_chk
  CHECK (code = upper(code) AND code ~ '^[A-Z0-9-]{4,32}$');

-- G. Funnel view (admin-only via service_role)
CREATE OR REPLACE VIEW public.onboarding_funnel_v1 AS
SELECT
  onboarding_step,
  date_trunc('day', onboarding_updated_at) AS day,
  count(*)::bigint AS users
FROM public.profiles
GROUP BY 1, 2;

REVOKE ALL ON public.onboarding_funnel_v1 FROM PUBLIC;
REVOKE ALL ON public.onboarding_funnel_v1 FROM anon, authenticated;
GRANT SELECT ON public.onboarding_funnel_v1 TO service_role;
