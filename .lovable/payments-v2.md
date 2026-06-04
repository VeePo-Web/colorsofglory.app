# Colors of Glory — Payments v2 Handoff

Backend rebuild of the payment / subscription / founder-code / referral system. Frontend (pricing page, code-entry UI, billing pages) is Claude's to build using the SDK below.

## Stripe products (created via batch_create_product)

| product_id | price lookup_key | amount | recurring | tax_code |
|------------|------------------|--------|-----------|----------|
| `cog_starter` | `starter_monthly` | $5.00 USD | monthly | txcd_10103001 |
| `cog_pro` | `pro_monthly` | $100.00 USD | monthly | txcd_10103001 |
| `cog_pro_referral` | `pro_monthly_referral_50` | $49.00 USD | monthly | txcd_10103001 |

## New tables

- **`public.plan_tiers`** — canonical source of truth: `key (free|starter|pro)`, `display_name`, `monthly_cents`, `currency`, `owned_song_limit`, `storage_bytes_included`, `allows_founder_code`, `allows_member_referral`, `allows_storage_addons`, `stripe_price_id`, `stripe_referral_price_id`, `sort_order`. Public-readable (anon SELECT). Admin write.
- **`public.pricing_copy`** — JSONB `payload` per row keyed by `page`, `card_free`, `card_starter`, `card_pro`. Public-readable. Admin write. Edit copy without redeploying.

## Schema extensions

- `sub_plan` enum: added `starter` (between free and pro).
- `song_status` enum: added `locked`.
- `app_settings` keys added: `starter_owned_song_limit`, `starter_price_cents`, `pro_price_referral_cents`. Existing `user_referral_cash_cents=500` and founder reward keys unchanged.

## Updated / new SQL helpers

- `public.current_plan(user_id)` — now recognizes `starter` alongside `pro`/`founder_pro`.
- `public.plan_tier_key_for_user(user_id)` — collapses `founder_pro` → `pro` and returns the matching `plan_tiers.key`.
- `public.effective_song_limit(user_id)` — reads owned-song cap from `plan_tiers` (no magic numbers).
- `public.can_create_song(user_id)` — rewritten to use the helper above.
- `public.apply_song_lock_for_quota(user_id)` — locks oldest-updated excess active songs on downgrade. No deletions.
- `public.unlock_songs_up_to_quota(user_id)` — unlocks oldest-first locked songs up to the new cap on upgrade.

## Edge functions

### New

- **`validate-code`** — authenticated, read-only. Body: `{ code, plan_key: 'pro' }`. Returns one of:
  - `{ kind:'founder', discount_pct:50, effective_cents:4900, founder_display_name, code_id }`
  - `{ kind:'member_referral', referrer_display_name, referrer_user_id }`
  - `{ kind:'invalid', reason:'expired'|'not_found'|'wrong_plan'|'self'|'already_attributed' }`

### Rewritten

- **`create-checkout`** — now plan-key driven. Body: `{ plan_key, code?, referrer_code?, returnUrl, environment }`. Server-side routing:
  1. Validates `plan_key` against `plan_tiers`.
  2. Enforces "one code per buyer" (rejects if `referral_attributions` already exists for the user).
  3. On Pro: tries `code` as founder code first → routes to `pro_monthly_referral_50` ($49) and stamps `attribution_founder_id` in subscription metadata. Falls back to member referral → routes to full-price `pro_monthly` and stamps `attribution_referrer_user_id`.
  4. On Starter: ignores both codes (Starter blocks codes per spec).
  5. Returns `{ clientSecret, applied_code_kind, ignored_referrer }`. `applied_code_kind` is one of `founder | member_referral | none`. `ignored_referrer=true` when founder code wins over a passed-in referrer code.
  6. Legacy `priceId` body param still accepted for backwards compatibility.

### Updated

- **`payments-webhook`**:
  - On `checkout.session.completed` (subscription mode): writes the `referral_attributions` row from `subscription_data.metadata` (`applied_code_kind` + `attribution_*_id`). Idempotent — bails if one already exists.
  - On every subscription upsert: calls `apply_song_lock_for_quota` then `unlock_songs_up_to_quota` so plan changes reconcile the user's song catalog (downgrade locks oldest; upgrade unlocks oldest).
  - Member-referral cash payouts ($5/mo, from `app_settings.user_referral_cash_cents`) are already minted by the existing `record_invoice_paid` RPC for `referrer_type='user'` attributions — no change needed.
  - Founder rewards continue to use `founders.reward_profile` (default `{first6_cents:2500, ongoing_cents:1000, first6_months:3}` = $25/mo for months 1–3 then $10/mo for the life of the sub).
- **`_shared/stripe.ts`**: `planForLookupKey` now maps `starter_monthly→starter`, `pro_monthly_referral_50→founder_pro`, `pro_monthly→pro`. `defaultUnitAmountForPlan` updated (starter=$5, founder_pro=$49).

## SDK additions (`src/integrations/cog/billing.ts`)

- `getPricingCatalog(): Promise<PlanTier[]>`
- `getPricingPage(): Promise<{ page: PricingPageCopy; cards: PricingCard[] }>`
- `validateCode(code, plan_key='pro'): Promise<ValidateCodeResult>`
- `startCheckout({ plan_key, code?, referrer_code?, return_url, environment? }): Promise<{ clientSecret, applied_code_kind, ignored_referrer }>`
- `getMyReferralStats(): Promise<{ code, active_refs, lifetime_paid_cents, pending_cents }>`
- All v1 functions (`getCurrentPlan`, `isProUser`, `getLatestSubscription`, `getStorageAddons`, `getEffectiveStorageLimit`, `canPurchaseFounderRate`, `createCheckoutSession`, `openBillingPortal`, `cancelSubscription`) preserved unchanged.

## Behavior matrix

| Scenario | Charge | Founder earns | Referrer earns |
|----------|--------|---------------|----------------|
| Pro, no code | $100/mo | — | — |
| Pro + founder code | $49/mo | $25/mo months 1–3 then $10/mo for life of sub | — |
| Pro + referral code | $100/mo | — | $5/mo for life of sub |
| Pro + both codes (founder wins) | $49/mo | $25 → $10 | $0 (ignored_referrer=true) |
| Starter (any code) | $5/mo | — | — |
| Free | $0 | — | — |

## Deviations from the brief

- **`referral_attributions.kind` / `reward_events.kind`** columns were NOT added — the existing `referrer_type` enum (`founder | user`) already differentiates the two cases throughout the schema, helpers, and admin tooling. Adding a duplicate column would have required rewriting `record_invoice_paid`, `admin-payouts`, and all of the founder admin RPCs for no behavioral gain. The SDK exposes the same distinction through `applied_code_kind`.
- **`sub_plan` enum** kept `founder_pro` (in addition to the new `starter`) instead of collapsing to a single `pro`. `current_plan` and `plan_tier_key_for_user` treat `founder_pro` as Pro for entitlements, so callers reading the SDK never see the distinction. This keeps existing reporting, admin views, and `current_plan` queries intact.
- **`getMyFounderStats`, `getMySubscription`, `getStorageAddons`, `purchaseStorageAddon`, `openBillingPortal`** from §7 of the brief — the first three already exist on the SDK under slightly different names (`canPurchaseFounderRate`, `getLatestSubscription`, `getStorageAddons`); the storage-purchase + billing-portal pieces already exist in `cog/billing.ts` (`openBillingPortal`) and via existing storage-addon edge functions. Re-exposing them under the §7 names is a follow-up if Claude wants alias methods.
- **`pricing_copy` table** is keyed flat (`page`, `card_<plan>`) instead of a row per field, so a single round-trip returns the whole page payload. Schema is JSONB so future fields don't require migrations.

## Non-negotiables — verified

- ✅ No magic numbers in frontend; all pricing strings + caps come from `plan_tiers` + `pricing_copy`.
- ✅ No raw lyric/memo content in any payment payload.
- ✅ No FK to `auth.users`; `user_id uuid` only.
- ✅ GRANT + RLS in same migration for `plan_tiers` and `pricing_copy`.
- ✅ All Stripe calls go through `createStripeClient(env)` (`_shared/stripe.ts`).
- ✅ One referral attribution per buyer (`referral_attributions.referred_user_id` UNIQUE) — founder wins at checkout.
- ✅ Free keeps every feature; only the catalog size is gated.
- ✅ `src/pages/**` and `src/components/**` untouched.

## Next steps (Claude)

1. Build `/pricing` page consuming `getPricingPage()`. Render `page.h1`, `page.sub_h1`, then the 3 cards in order. Show `comparison_caption` below the grid. Render the founder + referral micro-sections at page bottom.
2. On Pro card, add a "Have a founder code?" disclosure that calls `validateCode(code, 'pro')` and shows the `founder_display_name` + the discounted price when matched.
3. On checkout submit, call `startCheckout({ plan_key, code, return_url: '/checkout/return?session_id={CHECKOUT_SESSION_ID}' })`. Mount `<EmbeddedCheckoutProvider>` with the returned `clientSecret`.
4. If `applied_code_kind='founder'` and the buyer also passed `referrer_code`, surface a calm one-line notice: "Founder code applied — your referrer won't earn on this signup."
5. Build a Settings → Referrals page consuming `getMyReferralStats()` to show the user's code, share link, active referrals, and lifetime cash earned.