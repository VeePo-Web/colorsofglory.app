-- ============================================================
-- Phone OTP toll-fraud / SMS-pumping rails (BACKEND)
--
-- WHY: SMS pumping (toll fraud) is the #1 way phone-auth bankrupts a startup —
-- bots hammer the "send code" path to pump premium-rate numbers. Supabase's
-- built-in per-phone limit is not enough on its own.
--
-- DEFENSE-IN-DEPTH:
--   * Bypass-proof floor (Supabase DASHBOARD config — see runbook in
--     docs/admin/ADMIN-BACKEND-PLAN.md): enable CAPTCHA, set Allowed Countries,
--     and the provider SMS rate limit. Those stop bots before any send.
--   * Programmable layer (THIS migration): velocity caps + geo allowlist +
--     a hard global daily ceiling (bill circuit breaker) + an audit trail of
--     allowed sends for monitoring — logic Supabase does not offer.
--
-- FLOW: client -> edge fn `otp-guard` (derives + hashes IP, anon-invokable)
--       -> check_and_record_otp_send() [SECURITY DEFINER, service-role only]
--       -> if allowed, client proceeds to supabase.auth.signInWithOtp (Twilio).
--
-- FAIL-OPEN: the SDK proceeds to send if this guard errors/unreachable, so an
-- internal bug never locks users out; the dashboard floor still protects spend.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_send_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text NOT NULL,
  ip_hash      text,
  country_code text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_send_phone_time ON public.otp_send_events (phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_send_ip_time    ON public.otp_send_events (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_send_time       ON public.otp_send_events (created_at DESC);

ALTER TABLE public.otp_send_events ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (RLS-exempt) reads/writes. anon/authenticated locked out.
REVOKE ALL ON public.otp_send_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.otp_send_events TO service_role;

-- Tunable defaults (admins adjust via app_settings; allowlist = E.164 dial
-- prefixes you actually serve — opt-in, the safe default for toll fraud).
INSERT INTO public.app_settings(key, value, description) VALUES
  ('otp_geo_allowlist',        '["+1"]'::jsonb, 'Allowed E.164 dial prefixes for SMS OTP (toll-fraud geo gate). Add prefixes you serve, e.g. "+44".'),
  ('otp_max_per_phone_15m',    '3'::jsonb,      'Max OTP sends per phone per 15 minutes.'),
  ('otp_max_per_phone_day',    '6'::jsonb,      'Max OTP sends per phone per rolling 24h.'),
  ('otp_max_per_ip_hour',      '8'::jsonb,      'Max OTP sends per IP per rolling hour.'),
  ('otp_daily_global_ceiling', '500'::jsonb,    'Hard global cap on OTP sends per rolling 24h (bill circuit breaker).')
ON CONFLICT (key) DO NOTHING;

-- Atomic-ish check + record. Returns {ok:true} or {ok:false, code}.
-- Codes: INVALID_PHONE | GEO_BLOCKED | CEILING | RATE_LIMITED
CREATE OR REPLACE FUNCTION public.check_and_record_otp_send(
  _phone text, _ip_hash text, _country text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowlist      jsonb;
  max_phone_15m  int;
  max_phone_day  int;
  max_ip_hour    int;
  global_ceiling int;
  n              int;
BEGIN
  -- E.164 shape guard (defence in depth; SDK also validates)
  IF _phone IS NULL OR _phone !~ '^\+[1-9][0-9]{6,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE');
  END IF;

  SELECT value                INTO allowlist      FROM app_settings WHERE key = 'otp_geo_allowlist';
  SELECT (value::text)::int   INTO max_phone_15m  FROM app_settings WHERE key = 'otp_max_per_phone_15m';
  SELECT (value::text)::int   INTO max_phone_day  FROM app_settings WHERE key = 'otp_max_per_phone_day';
  SELECT (value::text)::int   INTO max_ip_hour    FROM app_settings WHERE key = 'otp_max_per_ip_hour';
  SELECT (value::text)::int   INTO global_ceiling FROM app_settings WHERE key = 'otp_daily_global_ceiling';

  allowlist      := COALESCE(allowlist, '["+1"]'::jsonb);
  max_phone_15m  := COALESCE(max_phone_15m, 3);
  max_phone_day  := COALESCE(max_phone_day, 6);
  max_ip_hour    := COALESCE(max_ip_hour, 8);
  global_ceiling := COALESCE(global_ceiling, 500);

  -- Geo allowlist (prefix match against E.164)
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(allowlist) p WHERE _phone LIKE p || '%'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'GEO_BLOCKED');
  END IF;

  -- Global daily ceiling (bill circuit breaker)
  SELECT count(*) INTO n FROM otp_send_events WHERE created_at > now() - interval '24 hours';
  IF n >= global_ceiling THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CEILING');
  END IF;

  -- Per-phone, last 15 minutes
  SELECT count(*) INTO n FROM otp_send_events
   WHERE phone_e164 = _phone AND created_at > now() - interval '15 minutes';
  IF n >= max_phone_15m THEN RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED'); END IF;

  -- Per-phone, last 24h
  SELECT count(*) INTO n FROM otp_send_events
   WHERE phone_e164 = _phone AND created_at > now() - interval '24 hours';
  IF n >= max_phone_day THEN RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED'); END IF;

  -- Per-IP, last hour
  IF _ip_hash IS NOT NULL THEN
    SELECT count(*) INTO n FROM otp_send_events
     WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
    IF n >= max_ip_hour THEN RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED'); END IF;
  END IF;

  INSERT INTO otp_send_events(phone_e164, ip_hash, country_code)
  VALUES (_phone, _ip_hash, _country);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_record_otp_send(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_otp_send(text, text, text) TO service_role;
