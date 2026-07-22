# Referral Rates + Founder Codes · Progress

## 2026-07-22 — The verify-&-wire pass (decided economics locked in)

Follow-up to the audit pass (`REFERRAL-PAYOUT-AUDIT-progress.md`). Every number below
was verified against the real code before anything was wired.

### The verified numbers

| Scenario | Invoice | Rate | Accrues |
|---|---|---|---|
| Founder-code Pro sub (CRAIG50 → $50 referral price) | $50.00 | 30% of ACTUAL | **$15.00/mo** |
| Full-price Pro referral (founder attribution) | $100.00 | 30% of ACTUAL | **$30.00/mo** |
| Regular member referral (Pro) | $100.00 | $5 flat | **$5.00/mo** — only while the referrer is an active paid member |
| Any referral on the $5 Starter plan | $5.00 | — | **$0 — structurally impossible** (3 layers, below) |

### What was already true (verified, no change)

- `plan_tiers` seeds exactly the decided plans: free / **Starter $5** / **Pro $100**,
  with Pro's referral price `pro_monthly_referral_50` ($50) and Starter's
  `allows_founder_code = allows_member_referral = false` — codes can't even be applied
  to a $5 checkout. The mint's `plan NOT IN ('pro','founder_pro')` gate excludes
  `starter` as the third layer. **No commission path exists for the $5 plan.**
- `user_referral_cash_cents` = 500 seeded — the decided $5 regular rate was already live.
- The CRAIG50 pattern is the shipped admin default (`slug.toUpperCase() + '50'`).
- Checkout founder-code chain: validation (active/unexpired/unexhausted/not-own-account)
  → **atomic redemption-slot claim before Stripe** → $50 referral price → attribution
  metadata → idempotent attach on `checkout.session.completed`.
- Scarcity primitives: `codes.max_redemptions` + `claim_founder_code_redemption` +
  the `admin_create_founder_code(uuid,text,int,…)` RPC already accepts a limit.
- Tracking surfaces: `me-referrals` (referrer dashboard), `admin_founder_summary` /
  `admin_founder_detail` / referrer ledger / payout batches (Parker's view).

### What was wired this pass (`20260722234500_referral_rates_lock.sql` + edge/docs)

1. **Founder commission switched to pct-of-ACTUAL** — `founder_commission_pct` = 30
   (global knob), `reward_profile.pct` (per-founder override via editRewardProfile).
   `reward_cents = round(invoice_cents × pct / 100)` — the trap is dead by construction:
   any discount/proration/price change flows through because the math starts from the
   invoice Stripe actually charged. Founders with an explicitly promised legacy fixed
   deal (first6/ongoing cents) keep it until Parker edits their profile.
2. **Rate lock at attribution** — `referral_attributions.locked_reward`, stamped by a
   BEFORE INSERT trigger (one choke point covering the RPC, the webhook's direct
   insert, and any future path). The mint reads the lock first; a later settings or
   profile change never rewrites an existing referral. Pre-existing attributions keep
   NULL locks deliberately (stamping history would itself rewrite the past) and follow
   profile → settings.
3. **The regular-referrer eligibility gate** — accrual requires the referrer to hold an
   active paid subscription (status active/past_due, plan ≠ free; trials don't count —
   skin-in-the-game means money down). Unpaid months skip with audited
   `referrer_not_active_paid` and accrual resumes automatically. Knob:
   `referrer_requires_active_paid`.
4. **Exact per-row tracking** — `reward_events.invoice_amount_cents` + `applied_rate`
   (the locked math, e.g. `{"kind":"founder_pct","pct":30}`) on every mint, so each
   founder's earnings are auditable to the cent from the ledger alone.
5. **Rounds-to-zero guard** — a tiny proration × 30% that rounds below 1¢ is skipped +
   audited instead of violating the amount CHECK and looping the webhook.
6. **Scarcity default** — `admin-founders` create now allocates
   `founder_code_default_max_redemptions` (seeded 100) when no explicit limit is given;
   unlimited-by-accident is closed.

### Proof runs (filed — Stripe test mode isn't reachable from this repo)

The sandbox script (extends audit filing #3): full-price Pro sub via founder attribution
→ pending $30.00 reward with `invoice_amount_cents = 10000`, `applied_rate.pct = 30`;
CRAIG50 sub → $50 invoice → pending **$15.00** with `invoice_amount_cents = 5000`;
Starter sub with any code → checkout rejects the code AND the mint skips
`plan_not_eligible`; flip `founder_commission_pct` to 25 → existing referrals still
mint at their locked 30 while a NEW attribution locks 25; regular referral accrues $5
only while the referrer's own sub is active, skips `referrer_not_active_paid` after
they cancel, resumes after they resubscribe; replay the same `invoice.paid` event →
exactly one reward row (idempotency); redeem a code past its allocation → checkout
`code_exhausted`.

### Open (Parker)

Permanent vs bounded 50%-off (`founder_discount_months`, bounded needs Lovable's Stripe
schedule work) · the allocation default (100) · donate recipient/receipts · clawback
forgiveness. All listed in the contract §9.
