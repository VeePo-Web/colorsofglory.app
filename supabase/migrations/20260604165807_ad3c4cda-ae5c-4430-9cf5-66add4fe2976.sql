
ALTER TYPE public.sub_plan ADD VALUE IF NOT EXISTS 'starter' BEFORE 'pro';
ALTER TYPE public.song_status ADD VALUE IF NOT EXISTS 'locked';

CREATE TABLE IF NOT EXISTS public.plan_tiers (
  key text PRIMARY KEY,
  display_name text NOT NULL,
  monthly_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  owned_song_limit integer NOT NULL,
  storage_bytes_included bigint NOT NULL,
  allows_founder_code boolean NOT NULL DEFAULT false,
  allows_member_referral boolean NOT NULL DEFAULT false,
  allows_storage_addons boolean NOT NULL DEFAULT false,
  stripe_price_id text,
  stripe_referral_price_id text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_tiers TO anon, authenticated;
GRANT ALL ON public.plan_tiers TO service_role;
ALTER TABLE public.plan_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_tiers_public_read" ON public.plan_tiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "plan_tiers_admin_manage" ON public.plan_tiers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_plan_tiers_updated_at
  BEFORE UPDATE ON public.plan_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_tiers (key, display_name, monthly_cents, currency, owned_song_limit, storage_bytes_included, allows_founder_code, allows_member_referral, allows_storage_addons, stripe_price_id, stripe_referral_price_id, sort_order)
VALUES
  ('free',    'Free',    0,     'USD', 1,  500::bigint * 1024 * 1024,         false, false, false, NULL,              NULL,                        1),
  ('starter', 'Starter', 500,   'USD', 4,  500::bigint * 1024 * 1024,         false, false, false, 'starter_monthly', NULL,                        2),
  ('pro',     'Pro',     10000, 'USD', 50, 100::bigint * 1024 * 1024 * 1024,  true,  true,  true,  'pro_monthly',     'pro_monthly_referral_50',   3)
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_cents = EXCLUDED.monthly_cents,
  owned_song_limit = EXCLUDED.owned_song_limit,
  storage_bytes_included = EXCLUDED.storage_bytes_included,
  allows_founder_code = EXCLUDED.allows_founder_code,
  allows_member_referral = EXCLUDED.allows_member_referral,
  allows_storage_addons = EXCLUDED.allows_storage_addons,
  stripe_price_id = EXCLUDED.stripe_price_id,
  stripe_referral_price_id = EXCLUDED.stripe_referral_price_id,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.pricing_copy (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pricing_copy TO anon, authenticated;
GRANT ALL ON public.pricing_copy TO service_role;
ALTER TABLE public.pricing_copy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_copy_public_read" ON public.pricing_copy FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pricing_copy_admin_manage" ON public.pricing_copy FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pricing_copy_updated_at
  BEFORE UPDATE ON public.pricing_copy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_copy (key, payload) VALUES
('page', jsonb_build_object(
  'h1', 'Pricing that respects the work.',
  'sub_h1', 'One song is free, forever. Everything else is priced for songwriters, not enterprises.',
  'comparison_caption', 'Every plan includes voice memos, chord charts, lyric editing, collaborators, version history, activity feed, and credits export. We don''t gate the craft — only the catalog size.',
  'founder_section_heading', 'Got a founder code?',
  'founder_section_body', 'Paste it at checkout on the Pro plan. You pay $49/month instead of $100 for as long as you stay subscribed. No promo expiry, no rate hike at month 13.',
  'referral_section_heading', 'Refer a fellow songwriter',
  'referral_section_body', 'When someone you refer subscribes to Pro, you earn $5/month in cash for every month they stay. Not a credit, not a coupon — a deposit. (Referral codes apply only to Pro; founder codes always take precedence at checkout.)'
)),
('card_free', jsonb_build_object(
  'plan_key', 'free',
  'eyebrow', 'Always free',
  'name', 'One Song, Fully Yours',
  'price_display', '$0',
  'price_suffix', 'forever free',
  'headline', 'Write your first song from start to finish — at no cost, ever.',
  'subhead', 'Every feature unlocked for one song. Lyrics, voice memos, chords, collaborators, version history. The whole sanctuary.',
  'bullets', jsonb_build_array(
    'One private song room — yours forever',
    'Invite as many co-writers as you want',
    'Voice memos, lyrics, chords, notes — all in one place',
    'Full version history so nothing is ever lost',
    'Export your credits anytime'
  ),
  'cta_label', 'Start your first song',
  'cta_kind', 'free',
  'trust_line', 'No credit card. No trial. No "upgrade to continue" wall.',
  'most_popular', false
)),
('card_starter', jsonb_build_object(
  'plan_key', 'starter',
  'eyebrow', 'For the songwriter testing the water',
  'name', 'Starter',
  'price_display', '$5',
  'price_suffix', '/month',
  'headline', 'Four songs in motion at the same time, for less than a coffee.',
  'subhead', 'When one song isn''t enough but you''re not ready to commit to a catalog.',
  'bullets', jsonb_build_array(
    '4 active song rooms',
    'Every feature from Free, unchanged',
    'Cancel any month — keep your songs in read-only',
    'All voice memos, all collaborators, all history'
  ),
  'cta_label', 'Choose Starter',
  'cta_kind', 'subscribe',
  'trust_line', 'Founder and referral codes don''t apply on this plan.',
  'most_popular', false
)),
('card_pro', jsonb_build_object(
  'plan_key', 'pro',
  'eyebrow', 'Built for catalogs, not single songs',
  'name', 'Pro',
  'price_display', '$100',
  'price_suffix', '/month',
  'discounted_price_display', '$49',
  'discount_badge', '50% off when you sign up through a founder''s code — that''s $49/month, for as long as you stay.',
  'headline', 'Run an entire songwriting catalog without it running you.',
  'subhead', 'Fifty songs, expandable storage, every collaborator, every memo, all under one roof — for less than the cost of one studio hour.',
  'bullets', jsonb_build_array(
    '50 active song rooms',
    'Add more storage whenever you fill up',
    'Priority support when you need a human',
    'First in line for new canvas + AI features',
    '50% off with a founder code — applied at checkout'
  ),
  'cta_label', 'Choose Pro',
  'cta_label_with_code', 'Claim 50% off — start for $49',
  'cta_kind', 'subscribe_with_code',
  'trust_line', 'Cancel any month. Your songs stay; only collaboration writes pause.',
  'most_popular', true
))
ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

INSERT INTO public.app_settings (key, value)
VALUES
  ('starter_owned_song_limit', to_jsonb(4)),
  ('starter_price_cents', to_jsonb(500)),
  ('pro_price_referral_cents', to_jsonb(4900))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
