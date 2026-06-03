
-- Returns the effective plan for a user based on subscriptions table state.
-- 'pro'/'founder_pro' while status is active/trialing/past_due with future period_end,
-- or canceled-but-still-within-period_end. Otherwise 'free'.
CREATE OR REPLACE FUNCTION public.current_plan(_user_id uuid)
RETURNS public.sub_plan
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.plan
      FROM public.subscriptions s
      WHERE s.user_id = _user_id
        AND s.plan IN ('pro','founder_pro')
        AND (
          (s.status IN ('active','trialing','past_due')
            AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'canceled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
      ORDER BY s.current_period_end DESC NULLS LAST, s.updated_at DESC
      LIMIT 1
    ),
    'free'::public.sub_plan
  );
$$;

CREATE OR REPLACE FUNCTION public.is_pro_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_plan(_user_id) IN ('pro','founder_pro');
$$;

GRANT EXECUTE ON FUNCTION public.current_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_pro_user(uuid) TO authenticated, service_role;
