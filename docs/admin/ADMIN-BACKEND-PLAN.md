# Colors of Glory — Admin & Backend Systems Plan
### The architecture, hardening roadmap, and operating doctrine for the dev/admin half of the app
*Owner: Admin & Backend Systems Claude (`/cog-admin`, persona-cog-admin). Counterpart to the song-feature Claude. Co-owns schema with Lovable. Last updated: 2026-06-20.*

---

## 0. Scope & boundary

This document governs the **internal admin systems + the backend**: the admin dashboard, founder accounts + founder codes, referral attribution, the reward economy, payouts, Stripe billing + webhooks, the **auth/Twilio backend** (provider config, OTP fraud rails, account-merge, typed error codes), finance/revenue tracking, and the audit log.

**Out of scope — the onboarding Claude owns it (do NOT touch):** onboarding flow, the **login / sign-in / phone-OTP / auth screens**, and invite UX. **The feature Claude owns:** song canvas, lyrics/chords editor, voice capture UX, workspace panels, collaboration UI. That means hands-off `src/pages/onboarding/**`, `src/pages/auth/**`, and `src/components/{cog,canvas,invite}` / song `src/pages/*`. **Our only frontend is the admin dashboard** (`src/pages/admin/**`, `src/components/admin/**`); everything else we own is backend. We share `src/integrations/cog/*` (we author the money/identity wrappers incl. `auth.ts`; onboarding *calls* them) and the migration history (coordinate with Lovable). See the **Concurrent-Tree Git Protocol** in persona-cog-admin.

**Prime directives:**
1. Money is **append-only and reconcilable** — minted, matured, reversed, and paid through guarded state transitions; never hand-edited.
2. Identity and role changes are **provable from the audit log**.
3. The **backend fails safe and loud** (throw → Stripe retries); the **frontend fails soft and kind** (human error copy).

---

## 1. Current-state map (what already exists)

The backend is substantially built and well-architected. Source-of-truth files per subsystem:

| Subsystem | Status | Source of truth |
|---|---|---|
| Phone OTP / email / Google auth | Built (phone gateable) | `src/integrations/cog/auth.ts` (Supabase Auth → Twilio) |
| Admin access control | Built | `has_role(uid,'admin')` RPC; `src/integrations/cog/admin.ts`; `src/components/admin/RequireAdmin.tsx` |
| Founders + codes | Built | `admin_create_founder`, `admin_create_founder_code`, `admin_deactivate_code`; `founders.ts`; `validate-code`, `redeem-founder-code` |
| Referral attribution | Built | `referral_attributions` (locked); `referral-resolve`, `referral-attach`; webhook `ensureAttributionFromMetadata` |
| Reward lifecycle | Built | `reward_events` (pending→payable→paid + `hold_until`); `record_invoice_paid` / `record_invoice_refunded` / `record_chargeback`; `rewards-mature-worker` |
| Payouts | Built | `admin-payouts` (list_drafts/create_batch/approve/mark_paid/mark_failed); `me-set-payout-method` (manual/paypal/stripe_connect) |
| Stripe billing (dual env) | Built | `_shared/stripe.ts`, `payments-webhook`, `create-checkout`, `billing-customer-portal`, `billing-cancel-subscription` |
| Storage add-ons + quota | Built | `storage_addons`; `apply_song_lock_for_quota`, `unlock_songs_up_to_quota` |
| Finance/revenue tracking | Partial | `admin_monthly_payouts`, `billing_events`; no consolidated revenue/liability dashboard yet |
| Audit log + search | Built | `audit_log` (before/after/reason); `admin-audit-search` |

**Architecture highlights worth preserving:**
- Webhook is the source of truth, fully idempotent (`billing_events.external_event_id`, short-circuit on `processed_at`, 500-on-failure for retry).
- User is derived from the `subscriptions` row, never trusted from invoice metadata.
- Unknown Stripe `lookup_key` **throws** rather than silently downgrading.
- Storage add-ons are isolated from plan/quota and never mint rewards.
- Reward maturation enforces a clawback hold before money becomes payable.

---

## 2. Core data model (money & identity)

```
profiles(user_id, phone_e164, referral_code, …)
roles / has_role(uid,'admin')                      ← server-side privilege gate

founders(id, display_name, slug, tier, reward_profile{first6_cents,ongoing_cents,first6_months}, notes, status)
founder_codes(id, founder_id, code, label, max_redemptions, redemptions, expires_at, active)

referral_attributions(referred_user_id, referrer_type[user|founder],
                      referrer_user_id|referrer_founder_id, source, locked)

subscriptions(user_id, external_id, plan[free|starter|pro|founder_pro], unit_amount_cents,
              currency, status, current_period_*, cancelled_at)
storage_addons(user_id, external_id, lookup_key, bytes_granted, status, …)
billing_events(external_event_id PK, kind, user_id, amount_cents, currency, payload,
               processed_at, processing_error)                ← idempotency + ops

reward_events(id, referrer_user_id|referrer_founder_id, referred_user_id, invoice_external_id,
              amount_cents, reward_kind, status[pending|payable|paid|reversed], hold_until)
credit_ledger(user_id, …)                                    ← user-facing credits

payouts(id, founder_id|user_id, period_*, amount_cents, status[draft|approved|paid|failed],
        method, external_provider_id, approved_by, paid_at)
payout_methods / profile(kind[manual|paypal|stripe_connect], email, country)

audit_log(id, created_at, action, entity_type, entity_id, actor_user_id,
          referred_user_id, referrer_user_id, referrer_founder_id, invoice_id,
          reason, reversed_reason, before, after)
```

State machines: **Reward** `none→pending→payable→paid` (+`pending→reversed`); **Payout** `draft→approved→paid|failed`; **Subscription** mirrors Stripe; **Code** `active→deactivated`/`expired`/`exhausted`.

---

## 3. World-class mapping — what "great" means here

### Stripe (Billing · Connect · Radar)
- **Idempotency keys** on every mutating Stripe API call (checkout/portal/cancel) — add where missing.
- **Webhook source-of-truth + replay-safety** — already strong; keep handlers minimal, defer to RPCs.
- **Loud SKU mapping** — `planForLookupKey` throws on unknown keys; new SKUs require mapping + test.
- **Dunning / involuntary churn** — `invoice.payment_failed` should drive a grace period, not an instant lock.
- **Refund/chargeback symmetry** — every earn path has a clawback path in the same change.
- **Connect Express for payouts** — store connected-account id; gate `approve` on `payouts_enabled`; reconcile transfer ids.
- **Radar-style abuse defense** — self-referral detection (device/card/IP/phone), velocity caps per code + per referrer, review queue before maturation.

### Twilio (phone-first auth)
- **E.164 normalize + validate** before send; canonical `phone_e164`.
- **Toll-fraud / SMS-pumping defense** — geo allowlist, per-phone + per-IP caps, resend cooldown, daily spend ceiling alarm. (Top cause of phone-auth blowups.)
- **A2P 10DLC** brand/campaign registration as a US-launch gate.
- **Twilio Verify** preferred where Supabase allows; else Supabase OTP with strict limits.
- **Account linking** rules when phone + email identities collide — one human, one account.
- **Graceful degradation** to email OTP/magic-link when SMS unavailable.

---

## 4. Phone-first auth — BACKEND ONLY (the onboarding Claude builds the screens)

Target UX (Church Center simplicity): **phone number → 6-digit OTP → in**, email/Google as secondary fallbacks. **The onboarding Claude builds the login/OTP screens.** Our job is to make that auth *possible, safe, and cheap to operate* and to expose clean typed errors the screens can render kindly. We do not touch `src/pages/auth/**` or `src/pages/onboarding/**`.

Backend build/harden order (ours):
1. **Provider readiness** — confirm Supabase phone provider + Twilio credentials live; document A2P 10DLC status (`PHONE_PROVIDER_DISABLED` is a handled state). *(config/backend)*
2. **E.164 normalization** — validate + normalize at the SDK boundary in `auth.ts` before `sendPhoneOtp`. *(backend)*
3. **Rate-limit + fraud rails** — resend cooldown, per-phone/per-IP caps, geo allowlist, daily spend ceiling alarm (server-side); ensure `RATE_LIMITED` surfaces so the screen can render it kindly. *(backend)*
4. **Typed error contract** — keep `AuthError` codes (`RATE_LIMITED`, `PHONE_PROVIDER_DISABLED`, `INVALID_OTP`, …) stable so onboarding maps them to copy. *(SDK contract)*
5. **Account-merge story** — deterministic linking of phone + email identities; never fork a user's songs. *(backend)*
6. **Hand-off, don't build** — any login-screen change → write a handoff note for the onboarding Claude; do not implement it.

---

## 5. Prioritized hardening roadmap

**P0 — protect money & identity (do first)**
- Audit every reward earn-path for a matching reversal; confirm only `payable` enters payout batches.
- Confirm no raw-SQL/manual mutation path exists for `reward_events`/`payouts`/`subscriptions`.
- Verify `has_role` server gate on every admin RPC + edge function (no client-trusted privilege).
- Phone-auth toll-fraud rails (rate limits + geo + ceiling) — before any phone-auth marketing push.

**P1 — operability**
- **Revenue & liability dashboard**: MRR, active subs by plan, new/churned, refunds, chargebacks, **reward liability** (outstanding pending+payable), all source-traced and reconciled to Stripe.
- **Webhook ops view**: list `billing_events`, surface `processing_error`, re-drive stuck events.
- **Payout console polish**: KYC/method gate on `approve`; store + display `external_provider_id`; failed-payout retry.

**P2 — abuse & scale**
- Radar-style self-referral + velocity detection; anomalous-mint review queue before maturation.
- Idempotency keys on remaining Stripe mutations; indexes on hot lookup columns.
- Dunning/grace-period state for `invoice.payment_failed`.

**P3 — completeness**
- Stripe Connect Express onboarding for automated payouts.
- Founder self-serve referral dashboard parity with admin numbers.
- Audit-log coverage assertion test (every privileged mutation writes a row).

---

## 6. Verification gates (every change)

1. `npm run typecheck` (or `tsc -p tsconfig.app.json --noEmit`) — green.
2. `npm run build` — green.
3. Relevant tests (`npm test`) — green.
4. Backend: confirm happy path **and** top-2 failure paths in code (duplicate webhook, refund-after-payout, OTP rate-limit, downgrade quota lock).
5. State what cannot be verified locally (real Twilio SMS delivery, live Stripe events) and give the user an exact test script (Stripe CLI `trigger`, sandbox checkout, test phone).
6. Commit only admin/backend files under the Concurrent-Tree Git Protocol.

---

## 7. How to run a session

Invoke `/cog-admin`. It scans the repo, prints the **Admin/Backend Intelligence Report**, and proposes the single highest-leverage subsystem. Approve, and it runs the 7-Lens + 10-Layer audit → bite-sized plan → approval → execute (earn-path + clawback together) → verify with evidence → commit → next subsystem.

---

## 8. Runbook — Phone OTP toll-fraud rails

Shipped (backend): `otp_send_events` table + `check_and_record_otp_send()` RPC + `otp-guard` edge function + `sendPhoneOtp` gating in `src/integrations/cog/auth.ts`. Defense-in-depth, **fail-open** (a guard outage never blocks login).

**The programmable layer (this codebase)** enforces, per `app_settings`:
- `otp_geo_allowlist` (default `["+1"]`) — E.164 dial prefixes you serve. **Widen before launching outside North America** or legit users get `GEO_BLOCKED`.
- `otp_max_per_phone_15m` (3), `otp_max_per_phone_day` (6), `otp_max_per_ip_hour` (8) — velocity caps.
- `otp_daily_global_ceiling` (500) — hard 24h cap, the bill circuit breaker. Raise as real volume grows.

Tune live (admin):
```sql
update app_settings set value = '["+1","+44"]'::jsonb where key = 'otp_geo_allowlist';
update app_settings set value = '2000'::jsonb       where key = 'otp_daily_global_ceiling';
```

**The bypass-proof floor (Supabase DASHBOARD — required, not optional):** an attacker can call Supabase's `signInWithOtp` directly with the public anon key, bypassing our app's guard. Only dashboard controls stop that:
1. **Enable CAPTCHA** (hCaptcha/Turnstile) on Auth — the single most effective anti-pumping control. *(If enabled, the login screen must pass a `captchaToken`; coordinate with the onboarding Claude — `sendPhoneOtp` would gain a `captchaToken` param.)*
2. **Set Allowed Countries** on the SMS provider to match `otp_geo_allowlist`.
3. **Set the provider SMS rate limit** conservatively.
4. **A2P 10DLC**: register brand/campaign before any US SMS volume (deliverability gate).
5. Set a Twilio **billing alert** mirroring the global ceiling.

Deploy + verify:
```bash
supabase db push
supabase functions deploy otp-guard
supabase secrets set OTP_IP_SALT=$(openssl rand -hex 16)   # optional but recommended
# smoke test (use a real allowed number):
#   curl -X POST "$SUPABASE_URL/functions/v1/otp-guard" -H "apikey: $ANON" -H 'content-type: application/json' -d '{"phone":"+15555550123"}'
#   → {"ok":true}; >3x in 15m → {"ok":false,"code":"RATE_LIMITED"}; non-+1 → {"ok":false,"code":"GEO_BLOCKED"}
select count(*) from otp_send_events where created_at > now() - interval '24 hours';  -- monitoring
```

**Monitoring:** alert when 24h `otp_send_events` count approaches `otp_daily_global_ceiling` (you're either growing or being pumped — investigate which).
