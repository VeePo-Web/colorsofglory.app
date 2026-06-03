
-- ============================================================================
-- Migration #6: Founder codes, referral attribution, credit/payout ledger
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- ENUMS ----------
CREATE TYPE public.founder_status AS ENUM ('active','paused','revoked','internal');
CREATE TYPE public.founder_tier AS ENUM ('standard','strategic','internal');
CREATE TYPE public.code_kind AS ENUM ('founder','user_referral','internal');
CREATE TYPE public.code_status AS ENUM ('active','paused','revoked','expired','exhausted');
CREATE TYPE public.attribution_source AS ENUM ('founder_code','user_referral_code','invite_link','admin_override');
CREATE TYPE public.referrer_type AS ENUM ('founder','user');
CREATE TYPE public.reward_kind AS ENUM ('cash','service_credit');
CREATE TYPE public.reward_status AS ENUM ('pending','payable','paid','reversed','void');
CREATE TYPE public.credit_status AS ENUM ('pending','available','applied','reversed','expired');
CREATE TYPE public.payout_status AS ENUM ('draft','approved','processing','paid','failed','cancelled');
CREATE TYPE public.billing_event_kind AS ENUM (
  'invoice_paid','invoice_refunded','chargeback_created',
  'subscription_created','subscription_cancelled','hold_elapsed','manual_adjustment'
);
CREATE TYPE public.sub_plan AS ENUM ('free','pro','founder_pro');

-- ---------- FOUNDERS ----------
CREATE TABLE public.founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  display_name text NOT NULL,
  slug citext NOT NULL UNIQUE,
  status public.founder_status NOT NULL DEFAULT 'active',
  tier public.founder_tier NOT NULL DEFAULT 'standard',
  reward_profile jsonb NOT NULL DEFAULT '{"first6_cents":2000,"ongoing_cents":1000,"first6_months":6}'::jsonb,
  payout_method_status text NOT NULL DEFAULT 'unset',
  notes text,
  created_by_user_id uuid NOT NULL,
  paused_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_founders_user_id ON public.founders(user_id);
CREATE INDEX idx_founders_status ON public.founders(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.founders TO authenticated;
GRANT ALL ON public.founders TO service_role;
ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Linked user can view own founder profile" ON public.founders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all founders" ON public.founders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can manage founders" ON public.founders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER founders_touch BEFORE UPDATE ON public.founders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- CODES ----------
CREATE TABLE public.codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value citext NOT NULL UNIQUE,
  kind public.code_kind NOT NULL,
  owner_founder_id uuid REFERENCES public.founders(id) ON DELETE CASCADE,
  owner_user_id uuid,
  status public.code_status NOT NULL DEFAULT 'active',
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  stripe_promotion_code_id text,
  discount_cents integer NOT NULL DEFAULT 0,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT codes_one_owner CHECK (
    (owner_founder_id IS NOT NULL)::int + (owner_user_id IS NOT NULL)::int = 1
  )
);
CREATE INDEX idx_codes_owner_founder ON public.codes(owner_founder_id);
CREATE INDEX idx_codes_owner_user ON public.codes(owner_user_id);
CREATE INDEX idx_codes_status ON public.codes(status);

GRANT SELECT ON public.codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.codes TO authenticated;
GRANT ALL ON public.codes TO service_role;
ALTER TABLE public.codes ENABLE ROW LEVEL SECURITY;

-- Public read-only on active codes lets the resolve endpoint work without auth.
CREATE POLICY "Anyone can read active codes" ON public.codes
  FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Owner user can view own codes" ON public.codes
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owner founder can view own codes" ON public.codes
  FOR SELECT TO authenticated USING (
    owner_founder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.founders f WHERE f.id = owner_founder_id AND f.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can manage codes" ON public.codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER codes_touch BEFORE UPDATE ON public.codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- REFERRAL_ATTRIBUTIONS ----------
CREATE TABLE public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id uuid NOT NULL UNIQUE,
  referrer_type public.referrer_type NOT NULL,
  referrer_founder_id uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  referrer_user_id uuid,
  source public.attribution_source NOT NULL,
  code_id uuid REFERENCES public.codes(id) ON DELETE SET NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  locked boolean NOT NULL DEFAULT true,
  override_by_user_id uuid,
  override_reason text,
  CONSTRAINT attribution_referrer_match CHECK (
    (referrer_type = 'founder' AND referrer_founder_id IS NOT NULL AND referrer_user_id IS NULL) OR
    (referrer_type = 'user'    AND referrer_user_id   IS NOT NULL AND referrer_founder_id IS NULL)
  ),
  CONSTRAINT attribution_no_self CHECK (referrer_user_id IS NULL OR referrer_user_id <> referred_user_id)
);
CREATE INDEX idx_attr_referrer_founder ON public.referral_attributions(referrer_founder_id);
CREATE INDEX idx_attr_referrer_user ON public.referral_attributions(referrer_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referred user views own attribution" ON public.referral_attributions
  FOR SELECT TO authenticated USING (referred_user_id = auth.uid());
CREATE POLICY "Referrer user views their referrals" ON public.referral_attributions
  FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE POLICY "Referrer founder views their referrals" ON public.referral_attributions
  FOR SELECT TO authenticated USING (
    referrer_founder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.founders f WHERE f.id = referrer_founder_id AND f.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage attributions" ON public.referral_attributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- SUBSCRIPTIONS ----------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text UNIQUE,
  plan public.sub_plan NOT NULL DEFAULT 'free',
  unit_amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  code_id uuid REFERENCES public.codes(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_user ON public.subscriptions(user_id);
CREATE INDEX idx_subs_status ON public.subscriptions(status);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER subs_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- BILLING_EVENTS ----------
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.billing_event_kind NOT NULL,
  external_event_id text NOT NULL UNIQUE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid,
  invoice_external_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_events_invoice ON public.billing_events(invoice_external_id);
CREATE INDEX idx_billing_events_user ON public.billing_events(user_id);

GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_events TO service_role;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view billing events" ON public.billing_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ---------- REWARD_EVENTS ----------
CREATE TABLE public.reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id uuid NOT NULL,
  referrer_type public.referrer_type NOT NULL,
  referrer_founder_id uuid REFERENCES public.founders(id) ON DELETE SET NULL,
  referrer_user_id uuid,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_external_id text NOT NULL,
  amount_cents integer NOT NULL,
  reward_kind public.reward_kind NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  hold_until timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status public.reward_status NOT NULL DEFAULT 'pending',
  paid_month_index integer,
  idempotency_key text NOT NULL UNIQUE,
  reversed_by_event_id uuid REFERENCES public.reward_events(id) ON DELETE SET NULL,
  payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reward_referrer_founder ON public.reward_events(referrer_founder_id);
CREATE INDEX idx_reward_referrer_user ON public.reward_events(referrer_user_id);
CREATE INDEX idx_reward_status ON public.reward_events(status);
CREATE INDEX idx_reward_hold_until ON public.reward_events(hold_until) WHERE status = 'pending';

GRANT SELECT ON public.reward_events TO authenticated;
GRANT ALL ON public.reward_events TO service_role;
ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer user views own rewards" ON public.reward_events
  FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE POLICY "Referrer founder views own rewards" ON public.reward_events
  FOR SELECT TO authenticated USING (
    referrer_founder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.founders f WHERE f.id = referrer_founder_id AND f.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins view all rewards" ON public.reward_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ---------- CREDIT_LEDGER ----------
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_reward_event_id uuid REFERENCES public.reward_events(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  status public.credit_status NOT NULL DEFAULT 'pending',
  available_at timestamptz,
  applied_to_invoice_external_id text,
  applied_at timestamptz,
  reversed_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_user ON public.credit_ledger(user_id);
CREATE INDEX idx_credit_status ON public.credit_ledger(status);

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own credits" ON public.credit_ledger
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins view all credits" ON public.credit_ledger
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ---------- PAYOUTS ----------
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES public.founders(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  status public.payout_status NOT NULL DEFAULT 'draft',
  provider text,
  provider_payout_id text,
  approved_by_user_id uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_founder ON public.payouts(founder_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);

ALTER TABLE public.reward_events
  ADD CONSTRAINT reward_events_payout_fk FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;

GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder views own payouts" ON public.payouts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.founders f WHERE f.id = founder_id AND f.user_id = auth.uid())
  );
CREATE POLICY "Admins view all payouts" ON public.payouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payouts_touch BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- AUDIT_LOGS ----------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_user_id);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ---------- FRAUD_FLAGS ----------
CREATE TABLE public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  created_by_user_id uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_subject ON public.fraud_flags(subject_type, subject_id);

GRANT SELECT ON public.fraud_flags TO authenticated;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fraud flags" ON public.fraud_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================================
-- SECURITY DEFINER HELPERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin');
$$;

CREATE OR REPLACE FUNCTION public.write_audit(
  _actor uuid, _action text, _entity_type text, _entity_id uuid,
  _before jsonb, _after jsonb, _reason text
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(actor_user_id, action, entity_type, entity_id, before, after, reason)
  VALUES (_actor, _action, _entity_type, _entity_id, _before, _after, _reason);
$$;

CREATE OR REPLACE FUNCTION public.resolve_code(_value text)
RETURNS public.codes LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.codes;
BEGIN
  SELECT * INTO c FROM public.codes
    WHERE value = _value::citext
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    LIMIT 1;
  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.reward_hold_days()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((value::text)::int, 30) FROM public.app_settings WHERE key = 'reward_hold_days';
$$;

CREATE OR REPLACE FUNCTION public.attribute_referral(
  _referred_user uuid, _code_value text, _source public.attribution_source
) RETURNS public.referral_attributions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.codes;
  a public.referral_attributions;
  r_type public.referrer_type;
  r_founder uuid;
  r_user uuid;
BEGIN
  -- Direct-only: if attribution exists, return it unchanged (first-valid wins)
  SELECT * INTO a FROM public.referral_attributions WHERE referred_user_id = _referred_user;
  IF FOUND THEN RETURN a; END IF;

  c := public.resolve_code(_code_value);
  IF c.id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF c.kind = 'founder' THEN
    r_type := 'founder';
    r_founder := c.owner_founder_id;
    r_user := NULL;
  ELSIF c.kind = 'user_referral' THEN
    r_type := 'user';
    r_founder := NULL;
    r_user := c.owner_user_id;
    IF r_user = _referred_user THEN RAISE EXCEPTION 'self_referral_not_allowed'; END IF;
  ELSE
    RAISE EXCEPTION 'code_kind_not_attributable';
  END IF;

  INSERT INTO public.referral_attributions(
    referred_user_id, referrer_type, referrer_founder_id, referrer_user_id, source, code_id
  ) VALUES (
    _referred_user, r_type, r_founder, r_user, _source, c.id
  ) RETURNING * INTO a;

  PERFORM public.write_audit(_referred_user, 'attribute_referral', 'referral_attribution', a.id,
    NULL, to_jsonb(a), NULL);
  RETURN a;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_code(_user uuid, _code_value text)
RETURNS public.codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.codes;
BEGIN
  UPDATE public.codes
    SET redemption_count = redemption_count + 1,
        status = CASE
          WHEN max_redemptions IS NOT NULL AND redemption_count + 1 >= max_redemptions THEN 'exhausted'::code_status
          ELSE status
        END,
        updated_at = now()
    WHERE value = _code_value::citext
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    RETURNING * INTO c;
  IF c.id IS NULL THEN RAISE EXCEPTION 'code_unavailable'; END IF;
  PERFORM public.write_audit(_user, 'redeem_code', 'code', c.id, NULL, to_jsonb(c), NULL);
  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_paid_month_index(_referred_user uuid, _referrer_founder uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(COUNT(*), 0)::int + 1
  FROM public.reward_events
  WHERE referred_user_id = _referred_user
    AND referrer_founder_id = _referrer_founder
    AND status IN ('payable','paid');
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_paid(_event jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := (_event->>'user_id')::uuid;
  v_invoice text := _event->>'invoice_external_id';
  v_amount int := COALESCE((_event->>'amount_cents')::int, 0);
  v_sub_id uuid := NULLIF(_event->>'subscription_id','')::uuid;
  v_plan public.sub_plan;
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
BEGIN
  IF v_user IS NULL OR v_invoice IS NULL THEN RAISE EXCEPTION 'missing_required_fields'; END IF;

  -- Only Pro / Founder Pro subscriptions generate rewards
  IF v_sub_id IS NOT NULL THEN
    SELECT plan INTO v_plan FROM public.subscriptions WHERE id = v_sub_id;
    IF v_plan IS NULL OR v_plan NOT IN ('pro','founder_pro') THEN RETURN NULL; END IF;
  END IF;

  SELECT * INTO attr FROM public.referral_attributions WHERE referred_user_id = v_user;
  IF NOT FOUND THEN RETURN NULL; END IF;

  hold_days := public.reward_hold_days();

  IF attr.referrer_type = 'founder' THEN
    SELECT reward_profile INTO profile FROM public.founders WHERE id = attr.referrer_founder_id;
    first6_cents := COALESCE((profile->>'first6_cents')::int, 2000);
    ongoing_cents := COALESCE((profile->>'ongoing_cents')::int, 1000);
    first6_months := COALESCE((profile->>'first6_months')::int, 6);
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
    SELECT COALESCE((value::text)::int, 1000) INTO reward_cents
      FROM public.app_settings WHERE key = 'user_credit_cents';
    idem := 'reward:user:' || attr.referrer_user_id::text || ':' || v_invoice;

    INSERT INTO public.reward_events(
      referred_user_id, referrer_type, referrer_user_id, subscription_id,
      invoice_external_id, amount_cents, reward_kind, hold_until, status,
      idempotency_key
    ) VALUES (
      v_user, 'user', attr.referrer_user_id, v_sub_id,
      v_invoice, reward_cents, 'service_credit', now() + make_interval(days => hold_days), 'pending',
      idem
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO reward_id;

    IF reward_id IS NOT NULL THEN
      INSERT INTO public.credit_ledger(
        user_id, source_reward_event_id, amount_cents, status,
        available_at, idempotency_key
      ) VALUES (
        attr.referrer_user_id, reward_id, reward_cents, 'pending',
        now() + make_interval(days => hold_days),
        'credit:' || reward_id::text
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  RETURN reward_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_refunded(_event jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice text := _event->>'invoice_external_id';
  n int := 0;
BEGIN
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'missing_invoice'; END IF;
  UPDATE public.reward_events
    SET status = 'reversed'
    WHERE invoice_external_id = v_invoice
      AND status IN ('pending','payable','paid');
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.credit_ledger c
    SET status = 'reversed', reversed_at = now()
    FROM public.reward_events r
    WHERE c.source_reward_event_id = r.id
      AND r.invoice_external_id = v_invoice
      AND c.status IN ('pending','available','applied');
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_chargeback(_event jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int;
  v_user uuid := NULLIF(_event->>'user_id','')::uuid;
BEGIN
  n := public.record_invoice_refunded(_event);
  IF v_user IS NOT NULL THEN
    INSERT INTO public.fraud_flags(subject_type, subject_id, reason, severity)
    VALUES ('user', v_user, 'chargeback_created', 'high');
  END IF;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.mature_holds()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n int := 0;
BEGIN
  UPDATE public.reward_events
    SET status = CASE WHEN reward_kind = 'cash' THEN 'payable'::reward_status ELSE 'payable'::reward_status END
    WHERE status = 'pending' AND hold_until <= now();
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.credit_ledger
    SET status = 'available'
    WHERE status = 'pending' AND available_at IS NOT NULL AND available_at <= now();

  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_credit_to_invoice(
  _user uuid, _invoice_external_id text, _invoice_amount_cents int
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining int := _invoice_amount_cents;
  applied_total int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT id, amount_cents FROM public.credit_ledger
      WHERE user_id = _user AND status = 'available'
      ORDER BY created_at ASC
      FOR UPDATE
  LOOP
    EXIT WHEN remaining <= 0;
    IF r.amount_cents <= remaining THEN
      UPDATE public.credit_ledger
        SET status='applied',
            applied_to_invoice_external_id=_invoice_external_id,
            applied_at=now()
        WHERE id = r.id;
      remaining := remaining - r.amount_cents;
      applied_total := applied_total + r.amount_cents;
    ELSE
      -- Partial: split the credit row
      UPDATE public.credit_ledger
        SET amount_cents = r.amount_cents - remaining
        WHERE id = r.id;
      INSERT INTO public.credit_ledger(
        user_id, source_reward_event_id, amount_cents, status,
        applied_to_invoice_external_id, applied_at, idempotency_key
      )
      SELECT user_id, source_reward_event_id, remaining, 'applied',
             _invoice_external_id, now(),
             'credit:split:' || r.id::text || ':' || _invoice_external_id
      FROM public.credit_ledger WHERE id = r.id;
      applied_total := applied_total + remaining;
      remaining := 0;
    END IF;
  END LOOP;
  RETURN applied_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_payout_batch(
  _founder uuid, _period_start timestamptz, _period_end timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total int;
  p_id uuid;
BEGIN
  SELECT COALESCE(SUM(amount_cents),0) INTO total
    FROM public.reward_events
    WHERE referrer_founder_id = _founder
      AND status = 'payable'
      AND payout_id IS NULL
      AND reward_kind = 'cash'
      AND created_at >= _period_start
      AND created_at <  _period_end;

  IF total = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.payouts(founder_id, period_start, period_end, amount_cents, status)
  VALUES (_founder, _period_start, _period_end, total, 'draft')
  RETURNING id INTO p_id;

  UPDATE public.reward_events
    SET payout_id = p_id
    WHERE referrer_founder_id = _founder
      AND status = 'payable'
      AND payout_id IS NULL
      AND reward_kind = 'cash'
      AND created_at >= _period_start
      AND created_at <  _period_end;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payout(_payout uuid)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payouts
    SET status='approved', approved_at=now(), approved_by_user_id=auth.uid(), updated_at=now()
    WHERE id=_payout AND status='draft'
    RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_draft'; END IF;
  PERFORM public.write_audit(auth.uid(),'approve_payout','payout',p.id,NULL,to_jsonb(p),NULL);
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_paid(_payout uuid, _provider_id text)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payouts
    SET status='paid', paid_at=now(), provider_payout_id=_provider_id, updated_at=now()
    WHERE id=_payout AND status IN ('approved','processing')
    RETURNING * INTO p;
  IF p.id IS NULL THEN RAISE EXCEPTION 'payout_not_approved'; END IF;
  UPDATE public.reward_events SET status='paid' WHERE payout_id=_payout AND status='payable';
  PERFORM public.write_audit(auth.uid(),'mark_payout_paid','payout',p.id,NULL,to_jsonb(p),NULL);
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_failed(_payout uuid, _reason text)
RETURNS public.payouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payouts;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payouts
    SET status='failed', failure_reason=_reason, updated_at=now()
    WHERE id=_payout
    RETURNING * INTO p;
  PERFORM public.write_audit(auth.uid(),'mark_payout_failed','payout',p.id,NULL,to_jsonb(p),_reason);
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_attribution(
  _referred_user uuid, _new_referrer_type public.referrer_type,
  _new_referrer_id uuid, _reason text
) RETURNS public.referral_attributions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  before_row public.referral_attributions;
  after_row public.referral_attributions;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO before_row FROM public.referral_attributions WHERE referred_user_id = _referred_user;

  INSERT INTO public.referral_attributions(
    referred_user_id, referrer_type, referrer_founder_id, referrer_user_id,
    source, override_by_user_id, override_reason
  ) VALUES (
    _referred_user, _new_referrer_type,
    CASE WHEN _new_referrer_type='founder' THEN _new_referrer_id ELSE NULL END,
    CASE WHEN _new_referrer_type='user'    THEN _new_referrer_id ELSE NULL END,
    'admin_override', auth.uid(), _reason
  )
  ON CONFLICT (referred_user_id) DO UPDATE SET
    referrer_type = EXCLUDED.referrer_type,
    referrer_founder_id = EXCLUDED.referrer_founder_id,
    referrer_user_id = EXCLUDED.referrer_user_id,
    source = 'admin_override',
    override_by_user_id = auth.uid(),
    override_reason = _reason
  RETURNING * INTO after_row;

  PERFORM public.write_audit(auth.uid(),'override_attribution','referral_attribution',
    after_row.id, to_jsonb(before_row), to_jsonb(after_row), _reason);
  RETURN after_row;
END;
$$;
