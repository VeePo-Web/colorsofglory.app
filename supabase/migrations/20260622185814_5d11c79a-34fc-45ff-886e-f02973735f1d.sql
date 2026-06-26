CREATE OR REPLACE FUNCTION public.debug_seed_reward_chain(
  _referred_user uuid,
  _amount_cents int DEFAULT 10000,
  _kind text DEFAULT 'founder'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attr     record;
  v_sub_id   uuid;
  v_invoice  text := 'debug_inv_' || gen_random_uuid()::text;
  v_external text := 'debug_sub_' || gen_random_uuid()::text;
BEGIN
  IF _kind NOT IN ('founder', 'member_referral') THEN
    RAISE EXCEPTION 'invalid_kind: use founder or member_referral';
  END IF;

  SELECT * INTO v_attr FROM public.referral_attributions WHERE referred_user_id = _referred_user;
  IF v_attr.id IS NULL THEN
    RAISE EXCEPTION 'no_attribution: seed referral_attributions first for user %', _referred_user;
  END IF;

  INSERT INTO public.subscriptions(
    user_id, external_id, plan, unit_amount_cents, currency, status,
    current_period_start, current_period_end, updated_at
  ) VALUES (
    _referred_user, v_external,
    CASE WHEN _kind = 'founder' THEN 'founder_pro'::sub_plan ELSE 'pro'::sub_plan END,
    _amount_cents, 'cad', 'active',
    now() - interval '1 day', now() + interval '29 days', now()
  ) RETURNING id INTO v_sub_id;

  PERFORM public.record_invoice_paid(jsonb_build_object(
    'user_id',              _referred_user,
    'invoice_external_id',  v_invoice,
    'subscription_id',      v_sub_id,
    'amount_cents',         _amount_cents,
    'currency',             'cad'
  ));

  PERFORM public.write_audit(auth.uid(), 'debug_seed_reward_chain', 'subscription', v_sub_id,
    NULL, jsonb_build_object('kind', _kind, 'amount', _amount_cents, 'invoice', v_invoice), NULL);

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id, 'invoice_external_id', v_invoice);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.debug_seed_reward_chain(uuid, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debug_seed_reward_chain(uuid, int, text) TO service_role;