
# Colors of Glory — Payment System v2

End-to-end audit + rebuild of payments, subscriptions, founder codes, and referrals. Backend-only work (Lovable scope); Claude Code builds the pricing page UI from the SDK + copy this plan exposes.

## Three plans (single source of truth)

| Plan | Price | Owned active songs | Storage | Founder code | Member referral |
|------|-------|-------------------|---------|--------------|-----------------|
| Free | $0 | 1 | base quota | — | — |
| Starter | $5/mo | 4 | base quota | blocked | blocked |
| Pro | $100/mo ($49 w/ founder code) | 50 | base + paid add-ons | yes, 50% off | $5/mo cash to referrer |

Free includes every product feature. Only catalog size and storage are gated. Invited memberships never count toward owner quota.

## What I'll build (in this exact order — one migration per step)

1. **`plan_tiers` + `pricing_copy` tables** (new). Seed data. GRANT SELECT to anon (pricing page is public). RLS read-anyone / write-service-role.
2. **Stripe products** via `payments--batch_create_product`:
   - `cog_starter` → `starter_monthly` @ 500 USD/mo, tax_code `txcd_10103001`
   - `cog_pro` → `pro_monthly` @ 10000 USD/mo
   - `cog_pro_referral` → `pro_monthly_referral_50` @ 4900 USD/mo (founder-code-only)
3. **Schema extensions**:
   - `songs.status` adds `'locked'` (alongside active/archived)
   - `referral_attributions.kind` enum: `founder | member_referral`
   - `reward_events.kind` mirror
   - `profiles.plan_tier` recomputed by webhook
4. **`create-song` edge fn**: enforce `plan_tiers.owned_song_limit` (reads from table, no magic numbers).
5. **`validate-code` edge fn** (new, read-only): returns founder vs member_referral vs invalid + reason.
6. **Rewrite `create-checkout`**: server-side code resolution order — Starter ignores codes → Pro tries founder first (routes to $49 price) → falls back to member referral → else invalid. Sets `subscription_data.metadata` with `{ userId, plan_key, attribution_kind, attribution_source_id }`.
7. **Update `payments-webhook`**:
   - Founder default reward profile `{ first6_cents: 2500, ongoing_cents: 1000, first6_months: 3 }` ($25/mo months 1–3, $10/mo thereafter, for life of the sub)
   - Member referral: flat $5/mo per `invoice.paid` while referred sub is `active`; pauses on `past_due`, stops on `canceled`
   - Lock-on-downgrade: when owned-active-song count exceeds new quota, mark excess `status='locked'` ordered by oldest `updated_at` first. No deletion.
   - Idempotency via existing `billing_events` table.
8. **Update `admin-payouts`** views to discriminate founder vs member_referral payouts.
9. **Update `src/integrations/cog/billing.ts` SDK**:
   ```
   getPricingCatalog, getPricingPage, validateCode, startCheckout,
   getMySubscription, getMyReferralStats, getMyFounderStats,
   getStorageAddons, purchaseStorageAddon, openBillingPortal
   ```
   All return typed error codes (not free-text).
10. **Regenerate `src/integrations/supabase/types.ts`**.
11. **Run `supabase--linter`**; fix every warning introduced by these migrations.
12. **Smoke test** each new/changed edge function via `supabase--curl_edge_functions`.
13. **Write `.lovable/payments-v2.md`** handoff doc: every price ID, every new table/column, every new edge function, every SDK function, and any deviations.

## Pricing copy contract (seeded into `pricing_copy`)

Ogilvy-grade voice, concrete and generous. Cards expose: `eyebrow, name, price_display, price_suffix, discounted_price_display?, discount_badge?, headline, subhead, bullets[], cta_label, cta_kind, trust_line?, most_popular?`. Full strings from your brief seeded verbatim:

- **Free** — "Write your first song from start to finish — at no cost, ever." Trust: "No credit card. No trial. No 'upgrade to continue' wall."
- **Starter** — "Four songs in motion at the same time, for less than a coffee." Trust: "Founder and referral codes don't apply on this plan."
- **Pro** (most_popular) — "Run an entire songwriting catalog without it running you." Discount badge: "50% off when you sign up through a founder's code — that's $49/month, for as long as you stay."

Page H1, sub-H1, comparison caption, founder-code micro-section, and referral micro-section all stored in `pricing_copy` so non-engineers can edit later without redeploys.

## Edge cases handled

- **Downgrade with too many songs** → `status='locked'` (no deletion), oldest-first; RLS blocks edits on locked songs; `getReturningHomeFeed` returns a `songs_locked` banner. Re-upgrade unlocks oldest-first up to new quota.
- **Founder code on already-Pro user** → applies on next renewal via Stripe sub update; founder earns from next `invoice.paid` onward. No retro credit.
- **Founder + member referral on same checkout** → founder wins; response sets `applied_code_kind: 'founder', ignored_referrer: true` so UI explains it to the buyer.
- **Free user with extra songs after Starter downgrade** → same lock mechanic, keeps 1 active.
- **Idempotency** → `billing_events.stripe_event_id` dedupe on every webhook handler.
- **Currency** → `plan_tiers.currency='USD'` for future-proofing.
- **HIBP + email verification** stay ON.

## Non-negotiables (re-confirmed)

- No magic numbers in frontend — everything via `plan_tiers` + `pricing_copy`.
- No raw lyric/memo content in any payment payload, webhook, or analytics event.
- No FK to `auth.users`. `user_id uuid` + profiles only.
- GRANT + RLS in same migration as every new public-schema table.
- Built-in Stripe connector + `_shared/stripe.ts` `createStripeClient(env)`. Never `new Stripe(...)` direct.
- One referral code per buyer; founder always wins.
- Free keeps every feature. Only catalog size gated.
- Lovable does NOT touch `src/pages/**` or `src/components/**` — Claude builds the pricing page from `getPricingPage()`.

## What I will NOT do

- Build any UI / pages / React components
- Edit `supabase/config.toml` project-level settings
- Touch existing admin RPCs, song-membership helpers (`is_song_member`, `song_role`, `has_role`), or invite flow
- Weaken auth (HIBP, email verification, Google OAuth)
- Modify `src/integrations/supabase/client.ts` or `types.ts` by hand (regenerated post-migration)

Approve and I'll execute steps 1→13 and end with the `.lovable/payments-v2.md` handoff.
