
# Migration #6 — Founder Codes, Referral Credit Ledger & Payouts (backend only)

Implements the data model + event-driven backend from the Founder/Referral PDF. No frontend, no page changes. Pure schema, RLS, SECURITY DEFINER helpers, edge functions, and SDK glue under `src/integrations/cog/*`.

**STATUS: SHIPPED.** All schema, RLS, SECURITY DEFINER helpers, edge functions, and SDK glue are in place. Stripe is **not** enabled yet — `billing-webhook` returns 503 until `STRIPE_WEBHOOK_SECRET` is set and Stripe signature verification is uncommented. `pg_cron` schedule for `rewards-mature-worker` deferred until the project owner wants it live (one `cron.schedule` insert).

---

## 1. New enums

- `founder_status`: `active | paused | revoked | internal`
- `founder_tier`: `standard | strategic | internal` (drives reward profile)
- `code_kind`: `founder | user_referral | internal`
- `code_status`: `active | paused | revoked | expired | exhausted`
- `attribution_source`: `founder_code | user_referral_code | invite_link | admin_override`
- `reward_kind`: `cash | service_credit`
- `reward_status`: `pending | payable | paid | reversed | void`
- `credit_status`: `pending | available | applied | reversed | expired`
- `payout_status`: `draft | approved | processing | paid | failed | cancelled`
- `billing_event_kind`: `invoice_paid | invoice_refunded | chargeback_created | subscription_created | subscription_cancelled | hold_elapsed | manual_adjustment`

## 2. New tables (all in `public`, with GRANTs + RLS)

**`founders`** — one row per founder partner. Fields: `user_id` (nullable until claimed), `display_name`, `slug` (unique, URL-safe), `status`, `tier`, `reward_profile jsonb` (defaults `{first6: 2000, ongoing: 1000}` cents), `payout_method_status`, `notes`, `created_by_user_id`, `paused_at`, `revoked_at`.

**`codes`** — `value` (citext unique), `kind`, `owner_founder_id`, `owner_user_id`, `status`, `max_redemptions` (null = unlimited), `redemption_count`, `expires_at`, `stripe_promotion_code_id` (nullable, for later), `discount_cents` (default 5000 for founder codes = $50 off $100). One of owner_* must be set.

**`referral_attributions`** — `referred_user_id` (unique), `referrer_type` (`founder|user`), `referrer_founder_id`, `referrer_user_id`, `source attribution_source`, `code_id`, `attributed_at`, `locked` (bool, default true), `override_by_user_id`. First-valid-wins enforced by unique constraint on `referred_user_id`.

**`subscriptions`** — internal mirror: `user_id`, `external_id` (stripe sub id), `plan` (`free|pro|founder_pro`), `unit_amount_cents`, `currency`, `status`, `current_period_start/end`, `code_id`, `started_at`, `cancelled_at`.

**`billing_events`** — append-only raw provider events. Fields: `kind billing_event_kind`, `external_event_id` (unique, idempotency), `subscription_id`, `user_id`, `invoice_external_id`, `amount_cents`, `currency`, `occurred_at`, `payload jsonb`, `processed_at`, `processing_error`.

**`reward_events`** — append-only ledger: `event_type` (mirrors `reward_status`), `referred_user_id`, `referrer_type`, `referrer_founder_id`, `referrer_user_id`, `subscription_id`, `invoice_external_id`, `amount_cents`, `reward_kind`, `period_start`, `period_end`, `hold_until` (default `now() + 30d`), `status`, `paid_month_index` (int, used for $20→$10 founder step), `idempotency_key` (unique), `reversed_by_event_id`, `payout_id`.

**`credit_ledger`** — normal-user service credits: `user_id`, `source_reward_event_id`, `amount_cents`, `status`, `available_at`, `applied_to_invoice_external_id`, `applied_at`, `reversed_at`, `idempotency_key` (unique).

**`payouts`** — founder payout batches: `founder_id`, `period_start`, `period_end`, `amount_cents`, `currency`, `status`, `provider`, `provider_payout_id`, `approved_by_user_id`, `approved_at`, `paid_at`, `failure_reason`.

**`audit_logs`** — `actor_user_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `created_at`. Generic — used by all admin mutations.

**`fraud_flags`** — `subject_type` (`user|founder|code`), `subject_id`, `reason`, `severity`, `created_by_user_id`, `resolved_at`, `resolution_note`.

**App settings keys** added: `pro_price_cents=10000`, `founder_price_cents=5000`, `founder_reward_first6_cents=2000`, `founder_reward_ongoing_cents=1000`, `user_credit_cents=1000`, `reward_hold_days=30`.

## 3. GRANTs + RLS summary

- All financial tables (`reward_events`, `credit_ledger`, `payouts`, `billing_events`, `audit_logs`, `fraud_flags`): **no anon, no authenticated writes**. `service_role` ALL. Authenticated SELECT only on their own rows via helper (`reward_events` visible to the referrer; `credit_ledger` visible to the credit owner; `payouts` visible to the founder’s linked user).
- `founders` / `codes` / `referral_attributions` / `subscriptions`: SELECT for the linked user; admin (`has_role(uid,'admin')`) full access; service_role ALL.
- All inserts/updates to financial tables go through SECURITY DEFINER functions or edge functions running under service role — never directly via PostgREST.

## 4. SECURITY DEFINER functions (`public`)

- `is_admin(uid)` thin wrapper on `has_role`.
- `resolve_code(_value text) returns codes` — case-insensitive, status check, expiry, redemption cap.
- `attribute_referral(_referred_user uuid, _code_value text, _source attribution_source) returns referral_attributions` — first-valid-wins, no self-referral, no chain (direct only).
- `redeem_code(_user uuid, _code_value text)` — increments `redemption_count`, sets status `exhausted` when cap hit, writes audit log.
- `next_paid_month_index(_referred_user uuid, _referrer_founder_id uuid) returns int` — counts prior `reward_events` with `status in ('payable','paid')` for that pair; used to pick $20 vs $10.
- `record_invoice_paid(_event jsonb)` — idempotent on `external_event_id`. Loads attribution, computes reward (founder cash tier OR $10 user credit), inserts `reward_events` row `status='pending'` with `hold_until = now() + hold_days`, and (for user credits) a matching `credit_ledger` `status='pending'`.
- `record_invoice_refunded(_event jsonb)` / `record_chargeback(_event jsonb)` — reverses the matching reward + credit rows, writes reversal events.
- `mature_holds()` — moves `pending → payable` (cash) / `pending → available` (credit) when `hold_until <= now()` and no reversal exists. Run by cron.
- `apply_credit_to_invoice(_user uuid, _invoice_external_id text, _invoice_amount_cents int) returns int` — picks oldest `available` credits up to invoice amount, marks them `applied`, returns total applied (consumed by edge function before charging).
- `create_payout_batch(_founder uuid, _period_start, _period_end)` — sums `payable` cash rewards in window, inserts `payouts` row `status='draft'`, links rewards.
- `approve_payout(_payout uuid)` / `mark_payout_paid(_payout uuid, _provider_id text)` / `mark_payout_failed(_payout uuid, _reason text)` — admin-only.
- `admin_override_attribution(_referred_user uuid, _new_referrer_type, _new_referrer_id uuid, _reason text)` — writes audit log.

All write helpers append to `audit_logs`.

## 5. Edge functions (`supabase/functions/*`)

All require service-role context or admin JWT; CORS via `npm:@supabase/supabase-js@2/cors`.

- `referral-resolve` — public POST `{ slug | code }` → returns `{ kind, owner_display_name, discount_cents }`. Used by future invite landing; safe to expose (no PII beyond display name).
- `referral-attach` — authenticated POST `{ code }` for a logged-in user: calls `attribute_referral` + `redeem_code`.
- `billing-webhook` — POST receiver for Stripe events. Verifies signature using `STRIPE_WEBHOOK_SECRET` if present, otherwise short-circuits with 503 ("payments not enabled"). Maps Stripe event → `billing_events` insert (idempotent on `external_event_id`) then dispatches to `record_invoice_paid` / `record_invoice_refunded` / `record_chargeback` / subscription lifecycle handlers.
- `rewards-mature-worker` — cron, runs hourly: calls `mature_holds()`, then auto-generates monthly `payouts` drafts on the 1st of each month for each active founder.
- `admin-founders` — admin-only CRUD: create founder (also creates `codes` row with chosen value or auto-generates `<NAME50>`), pause/resume, revoke, edit reward profile. All paths write audit logs.
- `admin-payouts` — admin-only: list drafts, approve, mark paid/failed.
- `admin-attribution-override` — admin-only wrapper around `admin_override_attribution`.

`pg_cron` job: `select cron.schedule('rewards-mature', '0 * * * *', $$select net.http_post(... rewards-mature-worker ...)$$);` — added via `supabase--insert` after migration approves.

## 6. SDK glue (`src/integrations/cog/`)

Backend-only typed wrappers, no React:

- `referrals.ts` — `resolveCode`, `attachReferral`, `getMyAttribution`, `getMyCredits`, `getMyRewardSummary`.
- `founders.ts` — `getMyFounderProfile`, `listMyReferredUsers`, `getMyMonthlyEarnings`.
- `admin.ts` — `createFounder`, `pauseFounder`, `revokeFounder`, `overrideAttribution`, `listDraftPayouts`, `approvePayout`, `markPayoutPaid`.
- `ledger.ts` — typed `RewardEvent`, `CreditLedgerRow`, `Payout` re-exports.

No `src/pages/**` or `src/components/**` changes. Claude will build dashboards against this SDK in a later pass.

## 7. What this plan deliberately defers

- Actual Stripe enablement, products, and webhook secret — done separately via `payments--enable_stripe_payments` when ready. The `billing-webhook` shell is in place so wiring it later is one secret + Stripe dashboard config.
- Founder/User referral dashboard UI (Claude).
- Admin dashboard UI (Claude).
- Payout provider integration (Stripe Connect / manual ACH) — `payouts.provider` is a free text field for now.
- Tax handling decision (deferred until Stripe enable step).

## 8. Build sequence

1. `supabase--migration` for enums + tables + GRANTs + RLS + SECURITY DEFINER helpers (one migration).
2. `supabase--migration` for app_settings rows + pg_cron schedule (separate, after types regenerate).
3. Deploy edge functions: `referral-resolve`, `referral-attach`, `billing-webhook`, `rewards-mature-worker`, `admin-founders`, `admin-payouts`, `admin-attribution-override`.
4. Write `src/integrations/cog/{referrals,founders,admin,ledger}.ts`.
5. Update `.lovable/plan.md` with Migration #6 status and the Stripe-enable handoff note.

## Technical notes

- All money in **integer cents** to avoid float drift.
- Idempotency: every webhook handler keyed on `external_event_id`; every reward/credit row keyed on `(invoice_external_id, referrer_type, referrer_id)`; unique indexes enforce it.
- First-valid-wins attribution via `UNIQUE (referred_user_id)` on `referral_attributions`.
- Direct-only: schema has no `parent_referrer` chain field — by construction.
- Storage add-ons excluded by filtering on `subscriptions.plan IN ('pro','founder_pro')` inside `record_invoice_paid`.
- Reversals never `DELETE` — always insert a reversing event and flip status, preserving the append-only audit trail.
- All admin mutations wrapped to write `audit_logs` rows with `before`/`after` jsonb snapshots.

