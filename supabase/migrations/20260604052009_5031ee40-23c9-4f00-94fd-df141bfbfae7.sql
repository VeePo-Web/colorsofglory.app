
-- 1) phone_e164 on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_e164 text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_e164_key ON public.profiles(phone_e164) WHERE phone_e164 IS NOT NULL;

-- Sync phone from auth.users → profiles on insert/update
CREATE OR REPLACE FUNCTION public.sync_profile_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone OR (TG_OP = 'INSERT' AND NEW.phone IS NOT NULL) THEN
    UPDATE public.profiles
       SET phone_e164 = CASE WHEN NEW.phone IS NULL OR NEW.phone = '' THEN NULL
                             WHEN left(NEW.phone, 1) = '+' THEN NEW.phone
                             ELSE '+' || NEW.phone END
     WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_phone_sync ON auth.users;
CREATE TRIGGER on_auth_user_phone_sync
AFTER INSERT OR UPDATE OF phone ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone();

-- Backfill phone for existing users
UPDATE public.profiles p
   SET phone_e164 = CASE WHEN left(u.phone, 1) = '+' THEN u.phone ELSE '+' || u.phone END
  FROM auth.users u
 WHERE u.id = p.user_id
   AND u.phone IS NOT NULL AND u.phone <> ''
   AND p.phone_e164 IS NULL;

-- 2) founder_codes
CREATE TABLE IF NOT EXISTS public.founder_codes (
  code         text PRIMARY KEY,
  label        text,
  max_uses     int  NOT NULL CHECK (max_uses > 0),
  uses         int  NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at   timestamptz,
  perks        jsonb NOT NULL DEFAULT '{}'::jsonb,
  active       boolean NOT NULL DEFAULT true,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (code = upper(code) AND code ~ '^[A-Z0-9-]{4,32}$')
);

GRANT ALL ON public.founder_codes TO service_role;
ALTER TABLE public.founder_codes ENABLE ROW LEVEL SECURITY;
-- No policies: locked. Admins/edge functions go through service_role.

CREATE TRIGGER founder_codes_set_updated_at
BEFORE UPDATE ON public.founder_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) founder_redemptions
CREATE TABLE IF NOT EXISTS public.founder_redemptions (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  code            text NOT NULL REFERENCES public.founder_codes(code) ON DELETE RESTRICT,
  perks_snapshot  jsonb NOT NULL,
  redeemed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS founder_redemptions_code_idx ON public.founder_redemptions(code);

GRANT ALL ON public.founder_redemptions TO service_role;
ALTER TABLE public.founder_redemptions ENABLE ROW LEVEL SECURITY;
-- No policies: locked.

-- 4) redeem_founder_code(_user_id, _code) → jsonb envelope
CREATE OR REPLACE FUNCTION public.redeem_founder_code(_user_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code    public.founder_codes%ROWTYPE;
  v_norm    text := upper(trim(_code));
  v_result  jsonb;
  v_adv     jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF v_norm IS NULL OR v_norm !~ '^[A-Z0-9-]{4,32}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  SELECT * INTO v_code FROM public.founder_codes WHERE code = v_norm FOR UPDATE;
  IF NOT FOUND OR NOT v_code.active THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_CODE');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CODE_EXPIRED');
  END IF;

  IF v_code.uses >= v_code.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CODE_EXHAUSTED');
  END IF;

  BEGIN
    INSERT INTO public.founder_redemptions(user_id, code, perks_snapshot)
    VALUES (_user_id, v_code.code, v_code.perks);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REDEEMED');
  END;

  UPDATE public.founder_codes SET uses = uses + 1, updated_at = now() WHERE code = v_code.code;

  -- Advance onboarding (swallow non-OK; idempotent)
  BEGIN
    v_adv := public.advance_onboarding(
      _user_id,
      'founder_code_seen'::public.onboarding_step,
      jsonb_build_object('founder_code_redeemed', true, 'code', v_code.code),
      'user:redeem-founder-code'
    );
  EXCEPTION WHEN OTHERS THEN
    v_adv := jsonb_build_object('ok', false, 'code', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'OK',
    'perks', v_code.perks,
    'onboarding', v_adv
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_founder_code(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_founder_code(uuid, text) TO service_role;
