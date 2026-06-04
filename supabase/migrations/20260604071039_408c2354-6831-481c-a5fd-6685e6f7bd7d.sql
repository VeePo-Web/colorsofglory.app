
CREATE OR REPLACE FUNCTION public.record_invoice_paid(_event jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := (_event->>'user_id')::uuid;
  v_invoice text := _event->>'invoice_external_id';
  v_amount int := COALESCE((_event->>'amount_cents')::int, 0);
  v_sub_id uuid := NULLIF(_event->>'subscription_id','')::uuid;
  v_plan public.sub_plan;
  v_status text;
  v_sub_user uuid;
  attr public.referral_attributions;
  reward_cents int;
  hold_days int;
  idem text;
  reward_id uuid;
  month_idx int;
  first6_cents int;
  ongoing_cents int;
  first6_months int;
  profile jsonb;
  v_skip text;
BEGIN
  IF v_user IS NULL OR v_invoice IS NULL THEN RAISE EXCEPTION 'missing_required_fields'; END IF;

  v_skip := NULL;

  IF v_sub_id IS NULL THEN v_skip := 'no_subscription';
  ELSIF v_amount <= 0 THEN v_skip := 'zero_amount';
  ELSE
    SELECT plan, status, user_id INTO v_plan, v_status, v_sub_user
      FROM public.subscriptions WHERE id = v_sub_id;
    IF v_plan IS NULL THEN v_skip := 'subscription_not_found';
    ELSIF v_plan NOT IN ('pro','founder_pro') THEN v_skip := 'plan_not_eligible';
    ELSIF v_status NOT IN ('active','trialing','past_due') THEN v_skip := 'status_not_eligible';
    ELSIF v_sub_user IS DISTINCT FROM v_user THEN v_skip := 'user_mismatch';
    END IF;
  END IF;

  IF v_skip IS NULL THEN
    SELECT * INTO attr FROM public.referral_attributions WHERE referred_user_id = v_user;
    IF NOT FOUND THEN v_skip := 'no_attribution'; END IF;
  END IF;

  IF v_skip IS NULL AND attr.referrer_type = 'user' AND attr.referrer_user_id = v_user THEN
    v_skip := 'self_referral';
  END IF;

  IF v_skip IS NOT NULL THEN
    PERFORM public.write_audit(v_user, 'reward_skipped', 'invoice', NULL,
      NULL,
      jsonb_build_object('reason', v_skip, 'invoice', v_invoice,
        'amount_cents', v_amount, 'subscription_id', v_sub_id,
        'plan', v_plan, 'status', v_status),
      NULL);
    RETURN NULL;
  END IF;

  hold_days := public.reward_hold_days();

  IF attr.referrer_type = 'founder' THEN
    SELECT reward_profile INTO profile FROM public.founders WHERE id = attr.referrer_founder_id;
    first6_cents := COALESCE((profile->>'first6_cents')::int, 2500);
    ongoing_cents := COALESCE((profile->>'ongoing_cents')::int, 1000);
    first6_months := COALESCE((profile->>'first6_months')::int, 3);
    month_idx := public.next_paid_month_index(v_user, attr.referrer_founder_id);
    reward_cents := CASE WHEN month_idx <= first6_months THEN first6_cents ELSE ongoing_cents END;
    idem := 'reward:founder:' || attr.referrer_founder_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_founder_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      paid_month_index, idempotency_key
    ) VALUES (
      v_user, 'founder', attr.referrer_founder_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      month_idx, idem
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;

  ELSIF attr.referrer_type = 'user' THEN
    SELECT COALESCE((value::text)::int, 500) INTO reward_cents
      FROM public.app_settings WHERE key = 'user_referral_cash_cents';
    idem := 'reward:user:' || attr.referrer_user_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_user_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      idempotency_key
    ) VALUES (
      v_user, 'user', attr.referrer_user_id, v_sub_id,
      v_invoice, reward_cents, 'cash', now() + make_interval(days => hold_days), 'pending',
      idem
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;
  END IF;

  RETURN reward_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_paid_month_index(_referred_user uuid, _referrer_founder uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::int + 1
  FROM public.reward_events
  WHERE referred_user_id = _referred_user
    AND referrer_founder_id = _referrer_founder
    AND status IN ('pending','payable','paid');
$$;

ALTER TABLE public.reward_events
  DROP CONSTRAINT IF EXISTS reward_events_amount_positive;
ALTER TABLE public.reward_events
  ADD CONSTRAINT reward_events_amount_positive
  CHECK (amount_cents > 0);

COMMENT ON FUNCTION public.record_invoice_paid(jsonb) IS
'Single source of truth for minting referral rewards. Fires only when: subscription exists, amount_cents > 0, plan in (pro,founder_pro), status in (active,trialing,past_due), subscription.user_id matches referred user, attribution exists, and not self-referral. All skips logged to audit_logs as reward_skipped.';
