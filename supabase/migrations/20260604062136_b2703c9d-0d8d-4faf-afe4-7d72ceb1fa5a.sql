
-- Indexes
CREATE INDEX IF NOT EXISTS idx_codes_owner_founder ON public.codes(owner_founder_id) WHERE kind = 'founder';
CREATE INDEX IF NOT EXISTS idx_reward_events_founder_status ON public.reward_events(referrer_founder_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_founder ON public.referral_attributions(referrer_founder_id);

-- Helper: ensure caller is admin
CREATE OR REPLACE FUNCTION public._assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Create founder
CREATE OR REPLACE FUNCTION public.admin_create_founder(
  _display_name text,
  _slug text,
  _reward_profile jsonb DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS public.founders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.founders;
  profile jsonb;
BEGIN
  PERFORM public._assert_admin();
  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'display_name_required';
  END IF;
  IF _slug IS NULL OR _slug !~ '^[a-z0-9-]{2,40}$' THEN
    RAISE EXCEPTION 'invalid_slug';
  END IF;
  profile := COALESCE(_reward_profile, jsonb_build_object(
    'first6_cents', 2000,
    'ongoing_cents', 1000,
    'first6_months', 6
  ));

  INSERT INTO public.founders(display_name, slug, reward_profile, notes, created_by_user_id)
  VALUES (trim(_display_name), _slug::citext, profile, _notes, auth.uid())
  RETURNING * INTO f;

  PERFORM public.write_audit(auth.uid(), 'admin_create_founder', 'founder', f.id, NULL, to_jsonb(f), NULL);
  RETURN f;
END;
$$;

-- Create founder code
CREATE OR REPLACE FUNCTION public.admin_create_founder_code(
  _founder_id uuid,
  _code text,
  _max_redemptions int DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL,
  _label text DEFAULT NULL
) RETURNS public.codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.codes;
  upper_code text;
BEGIN
  PERFORM public._assert_admin();
  IF _founder_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.founders WHERE id = _founder_id) THEN
    RAISE EXCEPTION 'founder_not_found';
  END IF;
  upper_code := upper(coalesce(_code,''));
  IF upper_code !~ '^[A-Z0-9-]{4,32}$' THEN
    RAISE EXCEPTION 'invalid_code_format';
  END IF;
  IF EXISTS (SELECT 1 FROM public.codes WHERE value = upper_code::citext) THEN
    RAISE EXCEPTION 'code_already_exists';
  END IF;

  INSERT INTO public.codes(
    value, kind, owner_founder_id, status, max_redemptions, expires_at, created_by_user_id
  ) VALUES (
    upper_code::citext, 'founder', _founder_id, 'active', _max_redemptions, _expires_at, auth.uid()
  ) RETURNING * INTO c;

  INSERT INTO public.founder_codes(code, label, max_uses, expires_at, perks, active, created_by)
  VALUES (
    upper_code,
    _label,
    COALESCE(_max_redemptions, 1000000),
    _expires_at,
    '{}'::jsonb,
    true,
    auth.uid()
  )
  ON CONFLICT (code) DO NOTHING;

  PERFORM public.write_audit(auth.uid(), 'admin_create_founder_code', 'code', c.id, NULL, to_jsonb(c), NULL);
  RETURN c;
END;
$$;

-- Deactivate code
CREATE OR REPLACE FUNCTION public.admin_deactivate_code(_code_id uuid)
RETURNS public.codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c public.codes; before jsonb;
BEGIN
  PERFORM public._assert_admin();
  SELECT to_jsonb(x) INTO before FROM public.codes x WHERE id = _code_id;
  UPDATE public.codes SET status = 'disabled', updated_at = now() WHERE id = _code_id RETURNING * INTO c;
  IF c.id IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  UPDATE public.founder_codes SET active = false, updated_at = now() WHERE code = c.value::text;
  PERFORM public.write_audit(auth.uid(), 'admin_deactivate_code', 'code', c.id, before, to_jsonb(c), NULL);
  RETURN c;
END;
$$;

-- Founder summary
CREATE OR REPLACE FUNCTION public.admin_founder_summary()
RETURNS TABLE(
  founder_id uuid,
  display_name text,
  slug text,
  status text,
  code_count int,
  active_codes int,
  total_redemptions int,
  attributed_users int,
  pending_cents bigint,
  payable_cents bigint,
  paid_cents bigint,
  last_payout_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN QUERY
  SELECT
    f.id,
    f.display_name,
    f.slug::text,
    f.status::text,
    COALESCE(cc.code_count, 0)::int,
    COALESCE(cc.active_codes, 0)::int,
    COALESCE(cc.total_redemptions, 0)::int,
    COALESCE(ra.attributed_users, 0)::int,
    COALESCE(re.pending_cents, 0)::bigint,
    COALESCE(re.payable_cents, 0)::bigint,
    COALESCE(re.paid_cents, 0)::bigint,
    po.last_paid_at
  FROM public.founders f
  LEFT JOIN (
    SELECT owner_founder_id,
      count(*) AS code_count,
      count(*) FILTER (WHERE status = 'active') AS active_codes,
      COALESCE(sum(redemption_count),0) AS total_redemptions
    FROM public.codes WHERE kind = 'founder'
    GROUP BY owner_founder_id
  ) cc ON cc.owner_founder_id = f.id
  LEFT JOIN (
    SELECT referrer_founder_id, count(DISTINCT referred_user_id) AS attributed_users
    FROM public.referral_attributions
    WHERE referrer_type = 'founder'
    GROUP BY referrer_founder_id
  ) ra ON ra.referrer_founder_id = f.id
  LEFT JOIN (
    SELECT referrer_founder_id,
      sum(amount_cents) FILTER (WHERE status = 'pending') AS pending_cents,
      sum(amount_cents) FILTER (WHERE status = 'payable') AS payable_cents,
      sum(amount_cents) FILTER (WHERE status = 'paid') AS paid_cents
    FROM public.reward_events
    WHERE reward_kind = 'cash'
    GROUP BY referrer_founder_id
  ) re ON re.referrer_founder_id = f.id
  LEFT JOIN (
    SELECT founder_id, max(paid_at) AS last_paid_at FROM public.payouts WHERE status = 'paid' GROUP BY founder_id
  ) po ON po.founder_id = f.id
  ORDER BY f.created_at DESC;
END;
$$;

-- Founder detail
CREATE OR REPLACE FUNCTION public.admin_founder_detail(_founder_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public._assert_admin();
  SELECT jsonb_build_object(
    'founder', to_jsonb(f),
    'codes', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC)
      FROM public.codes c WHERE c.owner_founder_id = _founder_id AND c.kind = 'founder'
    ), '[]'::jsonb),
    'attributed_users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', ra.referred_user_id,
        'attributed_at', ra.created_at,
        'code_id', ra.code_id
      ) ORDER BY ra.created_at DESC)
      FROM public.referral_attributions ra
      WHERE ra.referrer_founder_id = _founder_id
    ), '[]'::jsonb),
    'reward_events', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.reward_events WHERE referrer_founder_id = _founder_id ORDER BY created_at DESC LIMIT 200) r
    ), '[]'::jsonb),
    'payouts', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM public.payouts p WHERE p.founder_id = _founder_id
    ), '[]'::jsonb),
    'totals', (
      SELECT jsonb_build_object(
        'pending_cents', COALESCE(sum(amount_cents) FILTER (WHERE status='pending'),0),
        'payable_cents', COALESCE(sum(amount_cents) FILTER (WHERE status='payable'),0),
        'paid_cents',    COALESCE(sum(amount_cents) FILTER (WHERE status='paid'),0)
      ) FROM public.reward_events WHERE referrer_founder_id = _founder_id AND reward_kind='cash'
    )
  ) INTO result
  FROM public.founders f WHERE f.id = _founder_id;
  IF result IS NULL THEN RAISE EXCEPTION 'founder_not_found'; END IF;
  RETURN result;
END;
$$;

-- Recent referrals
CREATE OR REPLACE FUNCTION public.admin_referrals_recent(_limit int DEFAULT 50)
RETURNS TABLE(
  referred_user_id uuid,
  referrer_type text,
  referrer_founder_id uuid,
  founder_name text,
  code_value text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN QUERY
  SELECT ra.referred_user_id, ra.referrer_type::text, ra.referrer_founder_id,
         f.display_name, c.value::text, ra.created_at
  FROM public.referral_attributions ra
  LEFT JOIN public.founders f ON f.id = ra.referrer_founder_id
  LEFT JOIN public.codes c ON c.id = ra.code_id
  ORDER BY ra.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 500);
END;
$$;

-- Monthly payout view (admin RPC, not a view to keep auth simple)
CREATE OR REPLACE FUNCTION public.admin_monthly_payouts(_month_start date DEFAULT date_trunc('month', now())::date)
RETURNS TABLE(
  founder_id uuid,
  display_name text,
  payable_cents bigint,
  pending_cents bigint,
  invoice_count int,
  reward_event_ids uuid[]
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_admin();
  RETURN QUERY
  SELECT
    f.id,
    f.display_name,
    COALESCE(sum(r.amount_cents) FILTER (WHERE r.status = 'payable' AND r.payout_id IS NULL), 0)::bigint,
    COALESCE(sum(r.amount_cents) FILTER (WHERE r.status = 'pending'), 0)::bigint,
    count(DISTINCT r.invoice_external_id)::int,
    COALESCE(array_agg(r.id) FILTER (WHERE r.status = 'payable' AND r.payout_id IS NULL), ARRAY[]::uuid[])
  FROM public.founders f
  LEFT JOIN public.reward_events r
    ON r.referrer_founder_id = f.id
   AND r.reward_kind = 'cash'
   AND r.created_at >= _month_start::timestamptz
   AND r.created_at <  (_month_start + interval '1 month')::timestamptz
  GROUP BY f.id, f.display_name
  ORDER BY 3 DESC, f.display_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_founder(text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_founder_code(uuid,text,int,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_founder_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_founder_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referrals_recent(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_monthly_payouts(date) TO authenticated;
