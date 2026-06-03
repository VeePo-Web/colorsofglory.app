-- Migration #8: Founder-Rate Pro support + Storage Add-ons
-- See .lovable/plan.md for design notes.

-- 1) storage_addons table -----------------------------------------------------
CREATE TABLE public.storage_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text NOT NULL UNIQUE,            -- Stripe subscription id
  lookup_key text NOT NULL,                    -- e.g. cog_storage_100gb_monthly
  bytes_granted bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',       -- active | past_due | canceled | unpaid | trialing | incomplete
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_storage_addons_user ON public.storage_addons(user_id);
CREATE INDEX idx_storage_addons_active ON public.storage_addons(user_id)
  WHERE status IN ('active','trialing','past_due');

GRANT SELECT ON public.storage_addons TO authenticated;
GRANT ALL ON public.storage_addons TO service_role;

ALTER TABLE public.storage_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own storage addons"
  ON public.storage_addons FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all storage addons"
  ON public.storage_addons FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_storage_addons_updated_at
  BEFORE UPDATE ON public.storage_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) App setting for Pro base storage (per Growth System doc: 100 GB) ---------
INSERT INTO public.app_settings(key, value, description)
VALUES
  ('pro_storage_gb', to_jsonb(100), 'Base storage in GB included with Pro / Founder Pro plans')
ON CONFLICT (key) DO NOTHING;

-- 3) Rewrite effective_storage_limit to account for plan + addons -------------
CREATE OR REPLACE FUNCTION public.effective_storage_limit(_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  free_mb int;
  pro_gb int;
  plan public.sub_plan;
  base_bytes bigint;
  addon_bytes bigint;
BEGIN
  SELECT COALESCE((value::text)::int, 200) INTO free_mb
    FROM public.app_settings WHERE key = 'free_storage_mb';
  SELECT COALESCE((value::text)::int, 100) INTO pro_gb
    FROM public.app_settings WHERE key = 'pro_storage_gb';

  plan := public.current_plan(_user_id);

  IF plan IN ('pro','founder_pro') THEN
    base_bytes := COALESCE(pro_gb,100)::bigint * 1024 * 1024 * 1024;
  ELSE
    base_bytes := COALESCE(free_mb,200)::bigint * 1024 * 1024;
  END IF;

  SELECT COALESCE(SUM(bytes_granted), 0) INTO addon_bytes
    FROM public.storage_addons
    WHERE user_id = _user_id
      AND status IN ('active','trialing','past_due')
      AND (current_period_end IS NULL OR current_period_end > now());

  RETURN base_bytes + COALESCE(addon_bytes, 0);
END;
$function$;