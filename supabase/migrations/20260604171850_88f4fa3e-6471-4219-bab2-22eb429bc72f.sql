
CREATE OR REPLACE FUNCTION public.current_plan(_user_id uuid)
RETURNS sub_plan
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT s.plan
      FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.plan IN ('starter','pro','founder_pro')
        AND (
          (s.status IN ('active','trialing','past_due')
            AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
      ORDER BY
        CASE s.plan WHEN 'pro' THEN 1 WHEN 'founder_pro' THEN 1 WHEN 'starter' THEN 2 ELSE 3 END,
        s.current_period_end DESC NULLS LAST,
        s.updated_at DESC
      LIMIT 1
    ),
    'free'::public.sub_plan
  );
$function$;

CREATE OR REPLACE FUNCTION public.plan_tier_key_for_user(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE public.current_plan(_user_id)
    WHEN 'pro' THEN 'pro'
    WHEN 'founder_pro' THEN 'pro'
    WHEN 'starter' THEN 'starter'
    ELSE 'free'
  END;
$$;

CREATE OR REPLACE FUNCTION public.effective_song_limit(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.owned_song_limit
  FROM public.plan_tiers t
  WHERE t.key = public.plan_tier_key_for_user(_user_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_create_song(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cap int;
  cur int;
BEGIN
  cap := public.effective_song_limit(_user_id);
  IF cap IS NULL THEN
    cap := 1;
  END IF;
  cur := public.owned_active_song_count(_user_id);
  RETURN cur < cap;
END;
$function$;

REVOKE ALL ON FUNCTION public.plan_tier_key_for_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effective_song_limit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plan_tier_key_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_song_limit(uuid) TO authenticated, service_role;
