
-- 1) Backfill profiles.phone_e164 from auth.users.phone (no trigger change needed; trigger already does this for new users)
UPDATE public.profiles p
SET phone_e164 = CASE WHEN left(u.phone,1)='+' THEN u.phone ELSE '+'||u.phone END
FROM auth.users u
WHERE p.user_id = u.id
  AND p.phone_e164 IS NULL
  AND u.phone IS NOT NULL
  AND u.phone <> '';

-- 2) Rewrite the OTP guard with: correct country prefix, 30s cooldown, retry_after_seconds
CREATE OR REPLACE FUNCTION public.check_and_record_otp_send(_phone text, _ip_hash text, _country text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowlist        jsonb;
  max_phone_15m    int;
  max_phone_day    int;
  max_ip_hour      int;
  global_ceiling   int;
  cooldown_seconds int;
  n                int;
  last_at          timestamptz;
  retry_after      int;
  norm_country     text;
BEGIN
  IF _phone IS NULL OR _phone !~ '^\+[1-9][0-9]{6,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE');
  END IF;

  SELECT value              INTO allowlist        FROM app_settings WHERE key = 'otp_geo_allowlist';
  SELECT (value::text)::int INTO max_phone_15m    FROM app_settings WHERE key = 'otp_max_per_phone_15m';
  SELECT (value::text)::int INTO max_phone_day    FROM app_settings WHERE key = 'otp_max_per_phone_day';
  SELECT (value::text)::int INTO max_ip_hour      FROM app_settings WHERE key = 'otp_max_per_ip_hour';
  SELECT (value::text)::int INTO global_ceiling   FROM app_settings WHERE key = 'otp_daily_global_ceiling';
  SELECT (value::text)::int INTO cooldown_seconds FROM app_settings WHERE key = 'otp_cooldown_seconds';

  allowlist        := COALESCE(allowlist, '["+1"]'::jsonb);
  max_phone_15m    := COALESCE(max_phone_15m, 5);
  max_phone_day    := COALESCE(max_phone_day, 15);
  max_ip_hour      := COALESCE(max_ip_hour, 20);
  global_ceiling   := COALESCE(global_ceiling, 5000);
  cooldown_seconds := COALESCE(cooldown_seconds, 30);

  -- Use the longest allowlist prefix that matches (so `+1` matching `+14...` is fine,
  -- but the recorded country is the configured prefix, not a greedy regex capture).
  SELECT p INTO norm_country
  FROM jsonb_array_elements_text(allowlist) p
  WHERE _phone LIKE p || '%'
  ORDER BY length(p) DESC
  LIMIT 1;

  IF norm_country IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'GEO_BLOCKED');
  END IF;

  -- Per-phone cooldown: kills double-tap duplicates without ever blocking a real retry.
  SELECT max(created_at) INTO last_at
  FROM otp_send_events
  WHERE phone_e164 = _phone;
  IF last_at IS NOT NULL THEN
    retry_after := cooldown_seconds - EXTRACT(EPOCH FROM (now() - last_at))::int;
    IF retry_after > 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'COOLDOWN', 'retry_after_seconds', retry_after);
    END IF;
  END IF;

  -- Global daily ceiling (distinct code so UI can show "SMS briefly unavailable").
  SELECT count(*) INTO n FROM otp_send_events WHERE created_at > now() - interval '24 hours';
  IF n >= global_ceiling THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CEILING', 'retry_after_seconds', 3600);
  END IF;

  -- Per-phone 15m window.
  SELECT count(*) INTO n FROM otp_send_events
   WHERE phone_e164 = _phone AND created_at > now() - interval '15 minutes';
  IF n >= max_phone_15m THEN
    SELECT EXTRACT(EPOCH FROM ((min(created_at) + interval '15 minutes') - now()))::int INTO retry_after
    FROM otp_send_events
    WHERE phone_e164 = _phone AND created_at > now() - interval '15 minutes';
    RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', GREATEST(retry_after, 30));
  END IF;

  -- Per-phone 24h window.
  SELECT count(*) INTO n FROM otp_send_events
   WHERE phone_e164 = _phone AND created_at > now() - interval '24 hours';
  IF n >= max_phone_day THEN
    SELECT EXTRACT(EPOCH FROM ((min(created_at) + interval '24 hours') - now()))::int INTO retry_after
    FROM otp_send_events
    WHERE phone_e164 = _phone AND created_at > now() - interval '24 hours';
    RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', GREATEST(retry_after, 60));
  END IF;

  -- Per-IP 1h window.
  IF _ip_hash IS NOT NULL THEN
    SELECT count(*) INTO n FROM otp_send_events
     WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
    IF n >= max_ip_hour THEN
      SELECT EXTRACT(EPOCH FROM ((min(created_at) + interval '1 hour') - now()))::int INTO retry_after
      FROM otp_send_events
      WHERE ip_hash = _ip_hash AND created_at > now() - interval '1 hour';
      RETURN jsonb_build_object('ok', false, 'code', 'RATE_LIMITED', 'retry_after_seconds', GREATEST(retry_after, 60));
    END IF;
  END IF;

  INSERT INTO otp_send_events(phone_e164, ip_hash, country_code)
  VALUES (_phone, _ip_hash, norm_country);

  RETURN jsonb_build_object('ok', true);
END;
$function$;
