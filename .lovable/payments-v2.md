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

---

## v2 audit fixes (2026-06-04 follow-up)

Issues found while auditing the v2 build against Stripe API `2026-03-25.dahlia` and the original brief, and what was fixed:

- **Stripe products now exist.** `payments--batch_create_product` was executed for `cog_starter` (`starter_monthly` @ $5/mo), `cog_pro` (`pro_monthly` @ $100/mo) and `cog_pro_referral` (`pro_monthly_referral_50` @ $49/mo), all tax_code `txcd_10103001`, qty 1/1. Previously these only existed in `plan_tiers` rows — checkout would have failed with `price_not_found`.
- **`invoice.subscription` deprecation fixed.** `payments-webhook` now resolves the subscription via `invoice.parent.subscription_details.subscription` first, falling back to `invoice.subscription` and `invoice.lines.data[0].subscription`. Without this fix, every renewal silently no-op'd and referral/founder payouts stopped after month 1.
- **`profiles.pending_code` column added** + helpers `stash_pending_code`, `clear_pending_code`, `increment_founder_code_redemption` (all SECURITY DEFINER, scoped GRANTs). Lets onboarding/invite flows stash a code on the profile without writing a permanent `referral_attributions` row before checkout.
- **`referral-attach` retired in v2 shape.** It no longer calls `attribute_referral` / `redeem_code`. It validates the code lightly (founder or member referral) and stashes it on `profiles.pending_code`. Authoritative attribution is still written by `payments-webhook` after Stripe confirms. SDK signature unchanged (`attachReferral(code, source?)`); the `source` arg is now ignored.
- **`create-checkout` reads `profiles.pending_code`** as a fallback when the client didn't pass `code` or `referrer_code`. After a successful Stripe session create with founder routing, it calls `increment_founder_code_redemption(code_id)` and `clear_pending_code(user_id)`. Both calls are best-effort and logged on failure.
- **Storage add-on gate.** `create-checkout` now 403s `storage_addons_require_pro` when a `cog_storage*` price is requested by a non-Pro user (checked via `plan_tier_key_for_user(user_id)` RPC).
- **Dead legacy gate removed.** The `priceId === 'cog_founder_pro_monthly'` block in `create-checkout` was v1 dead code; it never matched v2 lookup keys. Replaced by the storage-addon gate above.
- **`planForLookupKey` loud-fails on unknown keys.** Previously it silently returned `'free'` for any unrecognized lookup_key — a typo or new SKU would silently downgrade a paying user. Now it throws `unknown_lookup_key:<key>`, which the webhook surfaces as a retryable handler error.
- **New edge function `apply-founder-code-to-active-sub`** (spec §6). Validates a founder code for an already-Pro user, swaps the Stripe subscription item to `pro_monthly_referral_50` with `proration_behavior: 'create_prorations'`, writes the attribution row, increments redemption count, and clears `pending_code`. The next `invoice.paid` pays the founder via the normal webhook path. Errors: `already_attributed`, `no_active_pro_subscription`, `already_on_founder_rate`, `expired`, `exhausted`, `self`, `referral_price_missing`.
- **SDK additions.** `applyFounderCodeToActiveSub(code, environment?)` in `src/integrations/cog/referrals.ts`. `PRICE_IDS` map updated to v2 lookup keys (`starter_monthly`, `pro_monthly`, `pro_monthly_referral_50`) plus the existing storage keys.
- **`config.toml` left at defaults.** Lovable's edge-function default is already `verify_jwt = false`, so per-function blocks are only added when overriding. `payments-webhook` and `referral-resolve` keep their explicit blocks; `create-checkout`, `validate-code`, `redeem-founder-code`, and `apply-founder-code-to-active-sub` rely on the default.

### Remaining out-of-scope (Claude / future passes)

- Frontend `/pricing` page rendering `getPricingPage()` payload.
- Optional `pricing_copy.faq` rows if a FAQ section is added to the page.
- Currency expansion beyond USD (`plan_tiers.currency` already encodes for future).
---

## CAD switch (2026-06-04)

All pricing switched from USD to CAD.

### New Stripe products / prices (CAD)
- `cog_starter_cad` → `starter_monthly_cad` @ $5.00 CAD/mo
- `cog_pro_cad` → `pro_monthly_cad` @ $100.00 CAD/mo
- `cog_pro_cad` → `pro_monthly_referral_50_cad` @ $49.00 CAD/mo

All tax_code `txcd_10103001`, qty 1/1. Old USD products (`cog_starter`, `cog_pro`, `cog_pro_referral`) left in place but unreferenced by `plan_tiers` — they are stranded test-mode artifacts and can be archived from the Stripe dashboard at any time.

### Data updates
- `plan_tiers.currency` flipped to `CAD` for all rows.
- `plan_tiers.stripe_price_id` / `stripe_referral_price_id` repointed to the `_cad` lookup keys.
- `pricing_copy` card payloads now display `$5 CAD`, `$49 CAD`, `$100 CAD`. Page payload carries `currency_note: "All prices in Canadian dollars."`
- New `pricing_copy.faq` row with 6 Q&A items consumed by `getPricingPage()`.

### Code changes
- `_shared/stripe.ts` `planForLookupKey` now accepts both the USD and CAD lookup keys for each plan (no breakage for in-flight USD subs).
- `src/integrations/cog/billing.ts` `PRICE_IDS` constants point at the CAD lookup keys.
- `getPricingPage()` now returns `{ page, cards, faq }` (was `{ page, cards }`).
- New §7 SDK aliases: `getMySubscription`, `getMyFounderStats`, `purchaseStorageAddon` (thin re-exports / wrappers).

### Verified
- `validate-code` already returns `reason: 'wrong_plan'` when `plan_key !== 'pro'`.
- `payments-webhook` already defaults `currency` to `cad` and reads `invoice.currency` through to `billing_events`.
- `create-checkout` uses lookup-key resolution only (no `price_data` fallback), so CAD currency is enforced by the price object itself.

---

## v2 audit fixes 2 (2026-06-04)

Second-pass audit against Stripe Dahlia + the v2 brief. Fixes shipped:

- **`create-checkout` `ui_mode`** changed from the invalid `embedded_page` to the correct `embedded`. Also now requires `returnUrl` to contain `{CHECKOUT_SESSION_ID}` (Stripe embedded requirement) and rejects with `return_url_missing_session_template` otherwise.
- **Atomic founder-code redemption claim.** New SECURITY DEFINER RPCs `claim_founder_code_redemption(_code_id)` / `release_founder_code_redemption(_code_id)`. `create-checkout` now claims a slot *before* calling Stripe; if Stripe errors out we release the slot. Eliminates the prior TOCTOU race that could overshoot `max_redemptions` under concurrent buyers. New error: `code_exhausted` (409).
- **`pending_code` always cleared** on successful session create, including Starter and no-code paths. Previously stale codes lingered on the profile.
- **`ignored_code` flag** added to `create-checkout` response when a tier (e.g. Starter) blocks both code kinds but the buyer supplied one — gives the UI an explicit reason to warn instead of silently swallowing.
- **`apply-founder-code-to-active-sub` lookup key** sourced from `plan_tiers.stripe_referral_price_id` (was hard-coded to the archived USD `pro_monthly_referral_50`, which 500'd post-CAD switch). `effective_cents` now read from the live Stripe price. Code regex relaxed from `{4,32}` to `{1,64}` so short codes aren't rejected before the DB lookup.
- **`validate-code` `effective_cents`** computed from `plan_tiers.monthly_cents * 0.5` instead of hard-coded `4900`, so future price changes flow through automatically.
- **`payments-webhook` idempotency.** `billing_events` insert switched to `upsert(..., { onConflict: 'external_event_id', ignoreDuplicates: true })` so concurrent Stripe retries no longer 500 on the unique-constraint collision.
- **Storage add-on hardening.** Webhook now refuses to write a `storage_addons` row when the lookup key resolves to 0 bytes (previously silently inserted `lookup_key=''`, `bytes_granted=0`).
- **Currency casing normalized to lowercase** everywhere: `plan_tiers.currency` updated to `cad`, and webhook helpers `.toLowerCase()` the value before persisting to `billing_events` / `subscriptions`. Matches Stripe convention.
- **New subscription events handled.** `customer.subscription.paused` and `customer.subscription.resumed` now route through `upsertSubscription`, so paused subs reflect correctly in the local table.

### Not fixed (deferred)

- `charge.dispute.created` invoice lookup still reads `charge.invoice` directly. Acceptable; widen later if disputes start landing without it.
- USD lookup-key aliases in `_shared/stripe.ts` (`starter_monthly`, `pro_monthly`, `pro_monthly_referral_50`) kept as a safety net for any in-flight USD subscription. Remove once Stripe shows zero active USD subs.
