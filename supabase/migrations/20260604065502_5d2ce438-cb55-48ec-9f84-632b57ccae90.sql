
-- Update app-wide founder reward defaults: $25/mo for first 3 months, then $10/mo
UPDATE public.app_settings SET value = to_jsonb(2500) WHERE key = 'founder_reward_first6_cents';
INSERT INTO public.app_settings(key, value) VALUES ('founder_reward_first6_months', to_jsonb(3))
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- New per-founder default
ALTER TABLE public.founders
  ALTER COLUMN reward_profile
  SET DEFAULT '{"first6_cents": 2500, "first6_months": 3, "ongoing_cents": 1000}'::jsonb;

-- Backfill all existing founders to the new rule
UPDATE public.founders
SET reward_profile = '{"first6_cents": 2500, "first6_months": 3, "ongoing_cents": 1000}'::jsonb;
