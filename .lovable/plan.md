# Payments System Audit — Colors of Glory

## What's already shipped and verified working

**Stripe catalog (CAD, sandbox)** — `cog_starter_cad`, `cog_pro_cad`, `cog_pro_referral_cad` products with lookup keys `starter_monthly_cad` ($5), `pro_monthly_cad` ($100), `pro_monthly_referral_50_cad` ($49). Wired to `plan_tiers` rows. Tax code `txcd_10103001` (SaaS), full compliance handling.

**Checkout** — `create-checkout` is plan-key-driven. Validates plan, atomically claims founder code redemption (`claim_founder_code_redemption` RPC, releases on Stripe error → no overshoot of `max_redemptions`), routes Pro+founder to the $49 price and stamps `applied_code_kind=founder` + `attribution_founder_id` on the subscription, routes Pro+member-referral to full price and stamps `attribution_referrer_user_id`. Reads `profiles.pending_code` as fallback. Starter blocks codes. One attribution per buyer enforced by UNIQUE `referral_attributions.referred_user_id`.

**Webhook (`payments-webhook`)** — Handles `checkout.session.completed`, `subscription.*`, `invoice.paid` (with dahlia-correct `invoice.parent.subscription_details.subscription` resolution + legacy fallback), `charge.refunded`, `charge.dispute.created`. Idempotent via `billing_events.external_event_id`. Calls `apply_song_lock_for_quota` + `unlock_songs_up_to_quota` on every sub change. Writes attribution row from session metadata if not already present.

**Reward minting** — `record_invoice_paid` RPC mints rewards on every paid invoice:
- Founder code attribution → $25/mo for first 3 months, $10/mo for life of sub (driven by `founders.reward_profile` + `app_settings.founder_reward_*`)
- Member referral attribution → $5/mo for life of sub (`app_settings.user_referral_cash_cents=500`)
- Both held 30 days (`reward_hold_days=30`), then matured by `mature_holds()` (daily cron `cog-mature-holds-daily` at 07:17 UTC — active)
- Clawbacks: `record_invoice_refunded` and `record_chargeback` reverse pending rewards.

**Apply founder code post-purchase** — `apply-founder-code-to-active-sub` swaps existing Pro sub to the $49 referral price with proration, writes attribution, increments redemption count.

**Admin tooling** — `admin-payouts` (list_drafts / create_batch / approve / mark_paid / mark_failed / retry), `admin-founders`, `admin-attribution-override`, `admin-redrive-billing-event`, `admin-audit-search`.

**User-facing SDK** — `getMyBillingStatus`, `startCheckout`, `validateCode`, `openBillingPortal`, `cancelSubscription`, `applyFounderCodeToActiveSub`, `getMyReferrals` (code + link + earnings breakdown + recent referrals + payout method), `setMyPayoutMethod`.

## Gaps found and what to fix

### 1. Six migrations sit in `supabase/migrations/` but were never applied (`max(version)=20260619040155`)

This is the headline bug. The repo *thinks* these are live, but the DB does not have them:

| File | What it adds |
|---|---|
| `20260620000000_cog_monthly_payout_drafts_cron.sql` | **Monthly payout-draft auto-creation** (`create_monthly_payout_drafts` + pg_cron job `cog-create-payout-drafts-monthly` at `25 7 1 * *`). Without this, payable rewards mature to `payable` and sit there forever — no founder/referrer gets auto-drafted into a payout. |
| `20260621000000_cog_otp_fraud_rails.sql` | OTP fraud rails (separate but pending). |
| `20260621000100_cog_admin_finance_summary.sql` | `admin_finance_summary` RPC powering the admin finance dashboard. |
| `20260621000200_cog_admin_ops.sql` | Admin ops RPCs. |
| `20260622000000_cog_fraud_review.sql` | Fraud review queue. |
| `20260622000100_cog_admin_referrer_ledger.sql` | Per-referrer ledger view for admins. |

**Action:** Re-apply the six pending migrations in version order via `supabase--migration`. After they land, verify `cron.job` contains `cog-create-payout-drafts-monthly` and the finance/referrer-ledger RPCs are callable.

### 2. Live webhook + live Stripe key not provisioned yet

Sandbox secrets only (`STRIPE_SANDBOX_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`). `STRIPE_LIVE_API_KEY` / `PAYMENTS_LIVE_WEBHOOK_SECRET` arrive automatically when you finish Stripe go-live and install the Lovable app on the live account. No code change required — call this out so you know the user-driven step is pending.

**Action:** Surface a one-line reminder in chat + extend `docs/claude-handoffs/2026-06-22-payments.md` with the go-live status check.

### 3. No automated end-to-end test of the payout pipeline

`reward_events` minting is RPC-only; there's no integration smoke test that proves "$100 invoice → 1 payable founder reward + 1 payable user reward after 30 days → 1 payout draft on day 1 of next month."

**Action:** Add a SQL-level smoke-test migration helper (`debug_simulate_invoice_paid(user_uuid, amount, attribution_kind)`) that drives `record_invoice_paid` end-to-end against a synthetic subscription so the user can manually verify the chain in the admin UI without waiting for real Stripe traffic. SECURITY DEFINER, service-role only. No prod data risk.

### 4. `me-referrals` payload missing one field

Returns lifetime + recent refs, but no breakdown of how many of the user's referrals are still on Pro (active vs churned). Claude's Settings → Referrals page needs this for the "active 4 / lifetime 7" stat. Already collectable from the existing data, just not exposed.

**Action:** Add `active_subscriptions_count` to the `MyReferralsSummary` response and compute server-side by joining `referral_attributions` → `subscriptions` (status in active/trialing/past_due). Bump SDK type.

### 5. Founder dashboard equivalent of `me-referrals` does not exist

`getMyFounderProfile` / `getMyMonthlyEarnings` exist but there's no single endpoint that returns the founder-facing summary (code, redemption count, redemption cap, lifetime $ earned, pending $, payable $, next draft date, recent paid invoices) in one round-trip.

**Action:** Add `me-founder-stats` edge function returning the consolidated payload, plus `getMyFounderStats()` SDK wrapper. Mirrors the structure of `me-referrals`.

## Out of scope for this pass

- No frontend changes (Settings → Referrals and Settings → Founder pages are Claude's lane).
- No re-architecture of payouts — manual approval flow stays (admin clicks approve → mark_paid).
- No changes to reward amounts / hold days (those are `app_settings` rows the user can edit live).
- Stripe Connect / direct deposit payouts (still ledger-only; payouts are manually executed via PayPal / e-transfer by admin).

## Technical implementation

1. **Apply pending migrations**
   - Run each of the six pending migrations in order via the migration tool. Verify `cron.job` includes `cog-create-payout-drafts-monthly` and that `create_monthly_payout_drafts()` exists.

2. **Add reward pipeline smoke-test helper** (new migration)
   - `public.debug_seed_reward_chain(_user uuid, _amount_cents int, _kind text)` — creates a synthetic subscription + invoice and calls `record_invoice_paid`. SECURITY DEFINER, REVOKE FROM PUBLIC, GRANT to service_role. Tagged in `audit_logs`.

3. **Extend `me-referrals`**
   - Add `active_subscriptions_count` to the response by joining `referral_attributions` → `subscriptions` (status in `('active','trialing','past_due')`).
   - Update `MyReferralsSummary` type in `src/integrations/cog/referrals.ts`.

4. **New `me-founder-stats` edge function + SDK wrapper**
   - Returns: `{ code, share_link, redemptions_used, redemptions_cap, active_subscriptions_count, lifetime_paid_cents, pending_cents, payable_cents, next_draft_date, recent_paid_invoices: [...] }`.
   - SDK: `getMyFounderStats()` in `src/integrations/cog/founders.ts`.

5. **Doc updates**
   - Append audit findings + new endpoints to `docs/claude-handoffs/2026-06-22-payments.md`.
   - Note in chat: live webhook is provisioned automatically after Stripe go-live (no manual action needed in code).

## Files touched

- `supabase/migrations/20260622000200_cog_payments_audit_smoke_test.sql` (new)
- `supabase/functions/me-referrals/index.ts` (add `active_subscriptions_count`)
- `supabase/functions/me-founder-stats/index.ts` (new)
- `src/integrations/cog/referrals.ts` (bump type)
- `src/integrations/cog/founders.ts` (add `getMyFounderStats`)
- `docs/claude-handoffs/2026-06-22-payments.md` (audit notes + new endpoints)

Plus: re-apply the six pending migrations via the migration tool.
