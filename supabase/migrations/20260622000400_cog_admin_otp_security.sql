-- ============================================================
-- Auth Security: admin visibility + tuning for the phone OTP toll-fraud rails.
-- admin_otp_stats() reads otp_send_events (service-role-only table) for admins;
-- admin_set_app_setting() lets admins tune the otp_* limits in-app (audited).
-- Both admin-gated + SECURITY DEFINER.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_otp_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'sends_24h',           (SELECT count(*) FROM otp_send_events WHERE created_at > now() - interval '24 hours'),
    'sends_1h',            (SELECT count(*) FROM otp_send_events WHERE created_at > now() - interval '1 hour'),
    'distinct_phones_24h', (SELECT count(DISTINCT phone_e164) FROM otp_send_events WHERE created_at > now() - interval '24 hours'),
    'distinct_ips_24h',    (SELECT count(DISTINCT ip_hash) FROM otp_send_events WHERE created_at > now() - interval '24 hours'),
    'top_phones', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT phone_e164, count(*) AS n
          FROM otp_send_events
         WHERE created_at > now() - interval '24 hours'
         GROUP BY phone_e164
         ORDER BY count(*) DESC
         LIMIT 10
      ) t), '[]'::jsonb),
    'settings', COALESCE((SELECT jsonb_object_agg(key, value) FROM app_settings WHERE key LIKE 'otp%'), '{}'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_otp_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_otp_stats() TO authenticated;

-- Tune an otp_* app setting from the admin UI (audited). Restricted to otp_ keys.
CREATE OR REPLACE FUNCTION public.admin_set_app_setting(_key text, _value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _key NOT LIKE 'otp%' THEN RAISE EXCEPTION 'key_not_allowed'; END IF;
  UPDATE public.app_settings SET value = _value, updated_at = now() WHERE key = _key;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_key'; END IF;
  PERFORM public.write_audit(auth.uid(), 'app_setting_changed', 'app_setting', NULL::uuid,
    NULL::jsonb, jsonb_build_object('key', _key, 'value', _value), NULL::text);
  RETURN _value;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_app_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_app_setting(text, jsonb) TO authenticated;
