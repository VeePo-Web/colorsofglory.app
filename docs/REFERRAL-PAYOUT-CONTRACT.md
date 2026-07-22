# The Referral + Payout Contract (the money system)
### The spec of record for how Colors of Glory earns, holds, and pays referral money
*Audited + hardened 2026-07-22. Companion to `REFERRAL-CONTRACT.md` (F3, the user-facing
growth loop) — this document covers the ledger, state machines, fraud rails, and payouts.
Every claim below is traced to a migration or edge function — nothing here is aspirational.*

---

## 1. The model (as implemented)

- **Single-level only.** One `referral_attributions` row per referred user, direct-only,
  first-valid-wins (`attribute_referral` returns the existing row unchanged). There is no
  chain, no matrix, no MLM shape anywhere in the schema.
- **Rewards mint from money, never from signups.** The ONLY mint path is
  `record_invoice_paid(jsonb)`, called by the verified Stripe `payments-webhook` on
  `invoice.paid`. It requires: a known subscription, `amount_cents > 0`, plan in
  (`pro`, `founder_pro`), status in (`active`,`trialing`,`past_due`), subscription user ==
  referred user, an attribution, no self-referral, and no open fraud flag on either party.
  Every skip writes a `reward_skipped` audit row with the reason.
- **THE RATE TABLE (decided 2026-07-22; every knob is an `app_settings` row, and the
  deal is LOCKED onto each attribution at creation — later tuning never rewrites history):**

  | Who | Rate | Knob | Notes |
  |---|---|---|---|
  | Regular referrer | **$5/mo flat** (5% of Pro) per active Pro referral | `user_referral_cash_cents` = 500 | Must themselves be an **active paid member** to accrue (`referrer_requires_active_paid` = true); unpaid months mint nothing (audited `referrer_not_active_paid`) and resume automatically |
  | Founder | **30% of the ACTUAL invoice amount** | `founder_commission_pct` = 30, overridable per-founder via `reward_profile.pct` (editRewardProfile) | Invite-only, exempt from the paid-member gate; legacy explicit fixed deals (first6/ongoing cents) are honored as promised |
  | Anyone, $5 Starter referral | **$0 — structurally impossible** | — | Triple guardrail: Starter's tier row disallows codes at checkout, the mint's plan gate excludes `starter`, and only pro/founder_pro invoices reach the reward branch |

- **The founder-code chain (CRAIG50):** each founder gets a unique vanity code — the
  admin default is literally `SLUG + '50'`. At checkout: code validated (active,
  unexpired, unexhausted, not the founder's own account) → a redemption slot is claimed
  **atomically** (`claim_founder_code_redemption`) *before* Stripe is touched → the
  session switches to the **$50 referral price** (`pro_monthly_referral_50` — a distinct
  Stripe price, not a coupon; functionally identical and simpler to reconcile) → the
  attribution + the founder's locked rate are stamped from session metadata on
  `checkout.session.completed`.
- **THE COMMISSION-ON-ACTUAL-PRICE RULE:** founder commission = pct × the cents Stripe
  actually invoiced. A CRAIG50 sub invoices $50 → **$15/mo**, never 30% of the $100
  list ($30). A full-price Pro referral → **$30/mo**. Discounts, prorations, and price
  changes are respected automatically because the math starts from the real invoice;
  a proration that rounds below 1¢ is skipped + audited (`rounds_to_zero`), never a
  constraint violation.
- **Rate lock mechanics:** a BEFORE INSERT trigger on `referral_attributions` stamps
  `locked_reward` (`founder_pct` / `founder_fixed` / `user_flat` + the numbers) on
  every insert path — the RPC, the webhook metadata insert, any future one. The mint
  reads the lock first; pre-lock attributions fall back to the founder's profile, then
  settings.
- **Scarcity:** founder codes are allocations — `max_redemptions` enforced atomically at
  checkout; admin creation defaults to `founder_code_default_max_redemptions` (100)
  when no explicit limit is given, so unlimited codes can't happen by accident.
- **Per-user tracking (exact by construction):** every `reward_events` row records the
  referrer (type + id + code via the attribution), referred user, subscription, invoice,
  **`invoice_amount_cents` (the actual price)**, **`applied_rate` (the locked math)**,
  the computed `amount_cents`, `paid_month_index`, and status — so "exactly how much
  each founder makes" is a straight sum. Surfaces: referrer's own dashboard
  (`me-referrals` → earnings + per-referral timeline), admin founder summary/detail
  (per-founder owed/paid/active referrals), admin referrer ledger + payout batches.
- **Storage add-on invoices never mint rewards** (`isStorageLookupKey` isolation in the
  webhook). An unknown Stripe `lookup_key` throws loudly — no silent plan mapping.

## 2. The reward state machine (append-only)

```
                record_invoice_paid (idempotency_key, ON CONFLICT DO NOTHING)
  [none] ─────────────────────────────────────────────► [pending]  (hold_until = +30d)
                                                            │
     refund/dispute (reverse_reward_for_invoice)            │  mature_holds() worker:
     or churn/refund found at maturity                      │  active/trialing → promote
                ▼                                           │  past_due → WAIT (stay pending)
           [reversed]                                       ▼  else → reverse
                                                       [payable]
                                                            │  create_(user_)payout_batch
                                                            │  (payout_id stamp, total>0 only)
                                                            ▼
                                              [paid]  (exactly once, see §3)
                                                            │  refund after payout
                                                            ▼
                                    compensating NEGATIVE payable entry
                                    'clawback:<original id>' — nets against the
                                    next batch; the paid row is never edited,
                                    only linked via reversed_by_event_id
```

**Idempotency at every hop:** mint key `reward:{founder|user}:<referrer>:<invoice>` (unique,
DO NOTHING); one reward per `(referrer_user, referred_user, paid_month_index)` via partial
unique index; batch stamping requires `payout_id IS NULL`; `mark_payout_paid` flips
`payable→paid` only inside `WHERE status IN ('approved','processing')` — a second call
raises. Webhook events are recorded in `billing_events` by `external_event_id` and
short-circuit when already processed. **Every function is safe to run twice.**

## 3. The payout state machine

```
[draft] ──approve_payout──► [approved] ──mark_payout_paid──► [paid]
   ▲                            │                               (provider ref REQUIRED
   │        mark_payout_failed  ▼                                by table CHECK)
   └────retry_payout──────── [failed]  (reason REQUIRED by table CHECK)
```

- Drafts are created **automatically** by pg_cron (`create_monthly_payout_drafts`,
  1st of each month 07:25 UTC) for every founder and user-referrer with a positive
  payable balance. Zero or net-negative balances create no draft and roll forward.
- `approve_payout` (admin-only, SECURITY DEFINER, audited) refuses: non-draft, open
  fraud flag on the recipient, missing payout method, and the global freeze.
- `mark_payout_paid` records the external provider id (constraint-enforced) and flips
  the batch's rewards `payable→paid` in the same statement set. `paid` can never be
  marked failed (20260708 guard) — the failed→draft→re-pay double-pay loop is closed.
- **Creation and approval are separate actions** (two-person-rule by default).

## 4. The global kill switch

`app_settings.payouts_frozen` — flipped only by `admin_set_payouts_frozen(frozen, reason)`
(admin-gated, reason required to freeze, audited as `payouts_frozen`/`payouts_unfrozen`).
While frozen: `approve_payout` and `mark_payout_paid` raise `payouts_frozen` server-side,
and the Payout batches console shows the banner + disables the buttons. Accrual, holds,
maturation, and monthly drafting **keep running** — freezing stops money leaving, not
the ledger. This is the "humans handle the 1%" brake for the 99% that is automated.

## 5. Fraud rails (as implemented)

| Rail | Mechanism |
|---|---|
| Self-referral (user) | Guarded 4× — redeem RPC raise, attribution table CHECK, mint skip, reward-row CHECK |
| Self-referral (founder) | Guarded 2× — `attribute_referral` founder branch raise + BEFORE INSERT trigger on `reward_events` (suppress + audit; closed this pass) |
| Seasoning | 30-day hold + `mature_holds` re-verifies the subscription is still genuinely paying (`past_due` waits, never promotes) — a reward only becomes payable after the referred user has survived into their second billing cycle |
| Refund/dispute | `charge.refunded` / `charge.dispute.created` reverse unpaid rewards and claw back paid ones as negative entries |
| Velocity | Per-code `max_redemptions` (atomic slot claim at checkout, allocation default 100) + exhaustion; open `fraud_flags` block both minting and approval |
| Skin-in-the-game | Regular referrers accrue only while they hold an active paid subscription themselves (`referrer_not_active_paid` skip, resumes automatically) |
| Review | Fraud console (admin) resolves flags; an unresolved flag freezes that person's money at both ends |
| Tier lock | Founder economics snapshot to the reward profile; month index from paid-invoice count — a later profile change never rewrites history |

## 6. Charity: "Give it forward" (model A)

A referrer may set their payout method to **`donate`** (Referral page → "Or give it
forward"). Nothing else changes: rewards accrue, mature, and batch identically; the
draft is approved normally; COG makes the donation on their behalf and `mark_payout_paid`
records the **donation receipt reference** as the provider id — so donated money is
exactly as reconcilable as collected money. No email or account is required for donate.

## 7. Reconciliation

- Every cent traces: Stripe event → `billing_events` row → `record_invoice_paid` →
  `reward_events` (idempotency key names the invoice) → `payout_id` → provider reference.
- `reconcile-billing-events` + `admin-redrive-billing-event` handle missed/stuck webhooks.
- Reward liability (pending + payable, minus clawbacks) is a first-class admin metric.
- Paid totals must tie to provider references; the table CHECK makes a paid payout
  without one impossible.

## 8. What is intentionally NOT built here (rented or filed)

- **Money movement, KYC, tax** — rented from the processor. The `stripe_connect`
  method + `stripe_connect_account_id` column exist, but the **transfer executor and
  Connect onboarding edge functions do not** — payouts are executed by an operator
  and reconciled via `mark_payout_paid` today. The Connect spec is filed with Lovable
  (see `docs/features/REFERRAL-PAYOUT-AUDIT-progress.md` §Filings) — until it ships,
  automation ends at "draft ready for approval," which is the correct safe boundary.
- **RLS proof** — policies exist deny-by-default with admin RPC elevation; a live-db
  RLS probe is filed for Lovable (cannot be proven from the repo alone).

## 9. Decisions for Parker

1. ~~User referrer rate~~ **DECIDED 2026-07-22: $5/mo cash** (`user_referral_cash_cents`
   = 500), only while the referrer is an active paid member. The legacy
   `user_credit_cents` credit path stays dormant.
2. ~~Founder rate~~ **DECIDED 2026-07-22: 30% of the ACTUAL invoice**
   (`founder_commission_pct` = 30, per-founder overridable). Existing founders with an
   explicitly promised fixed deal (first6/ongoing cents in their profile) keep it until
   Parker edits their profile — promises are honored, new attributions lock whatever
   the founder's deal is at that moment.
3. **Permanent vs bounded 50%-off (open):** `founder_discount_months` = 0 (permanent)
   today. Bounded (e.g. 6–12 months) protects long-term margin but needs Stripe
   subscription-schedule work — filed with Lovable if chosen. Permanent needs scarce
   codes (the allocation default covers this). Commission auto-adjusts either way
   because it's computed from the actual invoice ($15 while discounted, $30 after).
4. **Founder-code allocation default (open):** seeded at 100 redemptions per code
   (`founder_code_default_max_redemptions`). Tune to taste — it's the scarcity dial.
5. **Donate recipient + receipts:** who receives donated payouts (ministry partner?),
   and what reference goes into `mark_payout_paid` (donation receipt id). Policy call,
   not code.
6. **Clawback forgiveness:** a net-negative referrer balance rolls forward forever.
   If Parker prefers to forgive small negative balances (goodwill), that's an admin
   action to design — today the ledger simply stays honest.
