# Referral + Payout System · Audit-to-Completion · Progress

## 2026-07-22 — The deep audit + hardening pass

Adversarial audit of the whole money path (mint → hold → mature → batch → approve →
pay → reverse/claw back), every finding traced to a real migration/edge-function line
before being called a finding. Spec of record: `docs/REFERRAL-PAYOUT-CONTRACT.md`.

### Findings (ranked) and what was done

| # | Sev | Finding | Resolution |
|---|-----|---------|------------|
| 1 | **P0** | `approve_payout` (20260708) read the enum `profiles.payout_method` into a **jsonb** variable and checked `->>'method'`. Casting `'paypal'` to jsonb raises `invalid input syntax for type json` — **no payout with a method on file could ever be approved.** | FIXED — enum-safe `::text` read, every 20260708 guard kept (`20260722224500`) |
| 2 | **P1** | **Founder self-referral unguarded at every layer.** `attribute_referral` only self-checked user codes; both self-referral CHECKs pass founder rows (referrer_user_id is NULL there). A founder subscribing with their own code earned $20/mo on themselves, invisibly. | FIXED — raise at the attribution gate + BEFORE INSERT suppress-and-audit trigger on `reward_events` for pre-existing attributions |
| 3 | **P1** | **No global kill switch.** No way to stop money leaving during a fraud investigation without touching each batch. | FIXED — `app_settings.payouts_frozen` + `admin_set_payouts_frozen(frozen, reason)` (audited) + gates in `approve_payout`/`mark_payout_paid` + console banner/toggle |
| 4 | **P2** | `mature_holds` promoted `past_due` rewards to payable — a sub in dunning at hold expiry could get PAID for a month the customer never covered. | FIXED — past_due neither promotes nor reverses; the row stays pending and re-checks next run |
| 5 | **P2** | **Refund-after-paid had no ledger answer** — `reverse_reward_for_invoice` only touched pending/payable; a refund after payout left paid totals overstated forever. | FIXED — compensating NEGATIVE payable entry (`clawback:<id>`, linked via `reversed_by_event_id`, idempotent) nets against the next batch; amount CHECK now admits clawback rows only |
| 6 | **P3** | Both batch builders skipped `total = 0` but would create a **negative payout** once clawbacks exist. | FIXED — `total <= 0` returns NULL; rows roll forward |
| 7 | **P2** | **Donate-your-payout absent** (explicit product ask). | BUILT — `payout_method_kind` + `'donate'` (`20260722224000`), `me-set-payout-method` accepts it (no email), Referral page "Or give it forward," approval passes naturally |
| 8 | **P1** | **Stripe Connect execution is a stub** — `stripe_connect` enum value + account-id column exist; no onboarding or transfer edge functions. Payouts execute manually today. | FILED with Lovable (below) — the safe boundary until then is auto-draft → human approve/pay |

### CONFIRMED strong (no change needed — verified line-by-line)

- Mint idempotency (`reward:{kind}:{referrer}:{invoice}` unique + DO NOTHING) and the
  monthly `(referrer, referred, month)` partial unique index.
- Webhook idempotency (`billing_events.external_event_id`, processed short-circuit,
  500-on-error → Stripe retry), user resolved from the subscriptions row, storage
  add-ons isolated, unknown lookup_key throws.
- Plan/status/attribution/user-mismatch/fraud-flag mint gates, all audited as
  `reward_skipped`.
- Tier lock: founder profile snapshot + `next_paid_month_index` from paid-invoice count.
- Payout guards: paid-needs-provider + failed-needs-reason table CHECKs; paid can't be
  marked failed; approve refuses flagged recipients; payable→paid exactly once.
- Automation: pg_cron monthly draft creation for founders AND user-referrers;
  `rewards-mature-worker` maturation; `reconcile-billing-events` + redrive.

### Filings for Lovable (backend-owned; precise specs, not vibes)

1. **Stripe Connect executor** — two edge functions:
   `connect-onboard` (create Express account, persist `stripe_connect_account_id`,
   return an account-link URL; gate on `charges_enabled`/`payouts_enabled` before
   allowing method selection) and `payouts-execute` (service-role; for each APPROVED
   payout whose recipient method is `stripe_connect`: `stripe.transfers.create` with
   `idempotencyKey = payout id`, then `mark_payout_paid(payout, transfer.id)`; on
   Stripe error → `mark_payout_failed(payout, error)`). Must honor `payouts_frozen()`
   before every transfer. Until this ships, operators pay manually — never bypass
   `mark_payout_paid`.
2. **RLS probe** — prove from a non-admin JWT that `reward_events`, `payouts`,
   `fraud_flags`, `audit_logs`, and `app_settings` reads/writes are denied except the
   intended own-rows views.
3. **Stripe test-mode proof run** — sandbox: subscribe with a founder code → invoice.paid
   → reward pending → fast-forward hold → payable → monthly draft → approve → mark paid
   → refund → clawback row appears. (Not runnable from this repo alone.)
4. **Types regen** — `supabase gen types` so the `payout_method` union +
   `admin_set_payouts_frozen`/`payouts_frozen` RPCs appear in `types.ts` and the
   `readStacking`-style casts can retire.

### Decisions for Parker

Listed in the contract §9: user rate ($5 cash vs $10 credit settings both exist),
founder ongoing rate ($10 vs flat $20 — one settings row), donate recipient +
receipt policy, clawback forgiveness policy.

### What could not be verified here

No local Postgres/Stripe: migration SQL is reviewed + esbuild/tsc/build-verified at the
TypeScript layer, but the SQL executes first on deploy. The Stripe test-mode run (filing
#3) is the end-to-end proof. UI verified by build + code-trace, not by a live admin
session.
