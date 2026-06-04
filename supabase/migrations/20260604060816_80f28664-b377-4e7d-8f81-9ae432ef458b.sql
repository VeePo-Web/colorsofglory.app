
-- A. Auto-advance onboarding on email/phone confirmation
CREATE OR REPLACE FUNCTION public.on_auth_user_confirmed(_user_id uuid, _phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.onboarding_step;
BEGIN
  -- Re-sync phone_e164 defensively
  IF _phone IS NOT NULL AND _phone <> '' THEN
    UPDATE public.profiles
       SET phone_e164 = CASE WHEN left(_phone,1) = '+' THEN _phone ELSE '+' || _phone END
     WHERE user_id = _user_id
       AND (phone_e164 IS DISTINCT FROM CASE WHEN left(_phone,1) = '+' THEN _phone ELSE '+' || _phone END);
  END IF;

  SELECT onboarding_step INTO cur FROM public.profiles WHERE user_id = _user_id;
  IF cur IS NULL OR cur <> 'not_started' THEN RETURN; END IF;

  BEGIN
    PERFORM public.advance_onboarding(
      _user_id,
      'intent_selected'::public.onboarding_step,
      jsonb_build_object('confirmed_via','auth'),
      'trigger:auth_confirmed'
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow INVALID_TRANSITION / TERMINAL / anything else
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_on_auth_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
     OR (OLD.phone_confirmed_at IS NULL AND NEW.phone_confirmed_at IS NOT NULL) THEN
    PERFORM public.on_auth_user_confirmed(NEW.id, NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_on_auth_user_confirmed();

-- Backfill: advance any not_started profile whose auth user is already confirmed
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.user_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.onboarding_step = 'not_started'
      AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL)
  LOOP
    BEGIN
      PERFORM public.advance_onboarding(
        r.user_id,
        'intent_selected'::public.onboarding_step,
        jsonb_build_object('confirmed_via','auth','backfill',true),
        'trigger:auth_confirmed_backfill'
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- B. Seed founder codes
INSERT INTO public.founder_codes (code, label, max_uses, expires_at, perks, active)
VALUES
  ('FOUNDER-LAUNCH', 'Launch founders', 100, NULL,
    '{"plan_tier":"founder","storage_bonus_mb":500}'::jsonb, true),
  ('WORSHIP-2026', '2026 worship leaders', 250, '2026-12-31 23:59:59+00'::timestamptz,
    '{"plan_tier":"founder","storage_bonus_mb":250}'::jsonb, true),
  ('SEED-FOUNDER-1', 'QA / smoke test', 5, NULL,
    '{}'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

-- C. Collapse duplicate phone columns on profiles
-- Backfill phone_e164 from legacy phone where missing
UPDATE public.profiles
   SET phone_e164 = CASE WHEN left(phone,1) = '+' THEN phone ELSE '+' || phone END
 WHERE phone_e164 IS NULL
   AND phone IS NOT NULL
   AND phone <> '';

-- Update handle_new_user to write phone_e164 directly (drop legacy phone write)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  ref_code text;
  referrer_uid uuid;
  raw_ref text;
  norm_phone text;
BEGIN
  ref_code := public.generate_referral_code();
  raw_ref := NEW.raw_user_meta_data ->> 'referred_by_code';
  IF raw_ref IS NOT NULL THEN
    SELECT user_id INTO referrer_uid FROM public.profiles WHERE referral_code = raw_ref;
  END IF;

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

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Drop legacy phone column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
