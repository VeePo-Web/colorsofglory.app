## Referral Tracking Accuracy Audit — Pay-Only Enforcement Plan

### Goal
Guarantee a referrer earns $5/mo **only** when their referred user has actually paid a real, non-zero, plan-qualifying Stripe invoice for an active subscription. Zero tolerance for trial/discount/refund/test/self-referral leakage.

---

### Tracking Flow (single source of truth)

```text
Stripe invoice.paid
   │
   ▼
[1] payments-webhook
   ├─ verify signature
   ├─ accept ONLY event type "invoice.paid" (drop invoice.payment_succeeded)
   ├─ require invoice.status == "paid"
   ├─ require invoice.amount_paid > 0
   ├─ require subscription_id present (skip one-off / storage addon)
   ├─ derive userId from public.subscriptions.user_id (NOT invoice.metadata)
   └─ call rpc: record_invoice_paid(invoice_id, sub_id, user_id, amount_cents, plan_code)
        │
        ▼
[2] record_invoice_paid()  — fail-closed gates, audit every skip
   ├─ G1  subscription row exists & belongs to user_id   → else audit:user_mismatch, RETURN
   ├─ G2  subscription.status IN (active, trialing, past_due) → else audit:bad_status, RETURN
   ├─ G3  plan_code IN (pro, founder_pro)                → else audit:non_paid_plan, RETURN
   ├─ G4  amount_cents > 0                                → else audit:zero_amount, RETURN
   ├─ G5  not a storage_addon invoice                    → else audit:addon_invoice, RETURN
   ├─ G6  referral_attribution exists for user_id        → else audit:no_referrer, RETURN
   ├─ G7  referrer_id != user_id                          → else audit:self_referral, RETURN
   ├─ G8  idempotency: unique(invoice_id) in reward_events → else audit:duplicate, RETURN
   └─ INSERT reward_events (status=pending, amount=500, kind=cash, month_index=next_paid_month_index)
        │
        ▼
[3] rewards-mature-worker (cron, daily)
   ├─ select reward_events where status=pending AND mature_at <= now()
   ├─ re-verify subscription STILL active/trialing/past_due (else mark reversed:churned)
   ├─ re-verify invoice not refunded (else mark reversed:refunded)
   └─ status → payable, batch into monthly payout draft
        │
        ▼
[4] invoice.refunded / charge.refunded webhook
   └─ reverse matching reward_event (status=reversed, reason=refund)
        │
        ▼
[5] customer.subscription.deleted / status→canceled,unpaid,incomplete_expired
   └─ STOP future rewards (no new events created on next billing cycle)
   └─ existing pending events re-checked at maturity → reversed if churn
        │
        ▼
[6] me-referrals (dashboard read)
   ├─ paying_count = subscriptions where user_id IN (referred) AND status IN (active,trialing,past_due) AND current_period_end > now()
   ├─ monthly_recurring_cents = paying_count * 500
   ├─ lifetime_earned = sum(reward_events.amount where status IN (payable, paid))
   └─ per-row is_paying = real-time subscription lookup (NOT earned>0)
```

---

### What's already locked (from previous turn)
- Gates G1–G7 implemented in `record_invoice_paid` with `write_audit` on every early return
- Webhook routes only `invoice.paid`, derives user from `subscriptions` table
- `me-referrals` uses real-time paying status + MRR
- `next_paid_month_index` counts only pending/payable/paid (skips reversed)
- CHECK `reward_events.amount_cents > 0`

### What this plan adds (the remaining gaps)

**Migration C — refund + churn reversal**
1. Add trigger / handler on `invoice.refunded` and `charge.refunded` → `reverse_reward_for_invoice(invoice_id, 'refund')` sets matching pending/payable event to `reversed`.
2. `rewards-mature-worker` re-verifies at maturity:
   - subscription status still in (active, trialing, past_due)
   - invoice not refunded
   - else: status → `reversed`, reason → `churned` | `refunded`, audit logged
3. Add `reward_events.reversed_reason text` + `reversed_at timestamptz`.

**Migration D — anti-fraud guards**
1. Unique partial index `(referred_user_id, month_index) WHERE status IN ('pending','payable','paid')` — prevents double-credit per month even if Stripe replays.
2. `referrer_id != referred_user_id` enforced as CHECK on `reward_events`.
3. Block rewards when `fraud_flags` has open flag on either user (audit:fraud_hold).
4. Reject invoices where `subscription.created_at > invoice.created` (clock-skew sanity).

**Webhook hardening**
1. Reject events older than 7 days (replay protection beyond signature freshness).
2. Persist every received Stripe event_id in `billing_events` with unique constraint — second-level idempotency above record-level.
3. Log every accepted/rejected event with the gate that rejected it.

**Dashboard truth (`me-referrals`)**
1. Split counts: `signed_up`, `started_trial`, `paying_now`, `churned`.
2. `monthly_recurring_cents` = paying_now × 500 (already done, confirm).
3. Show `next_payout_date` and `pending_cents` separately from `lifetime_earned`.

**QA / verification script (`scripts/qa-referral-tracking.ts`)**
Replays against Stripe sandbox:
- $0 trial invoice → expect no reward, audit:zero_amount
- one-off invoice (no sub) → expect skip
- self-referral → expect skip
- pro paid invoice → expect 1 pending reward
- refund same invoice → expect reversal
- subscription canceled before maturity → expect reversal at worker run
- duplicate webhook delivery → expect single reward
- 13th month → expect month_index=13 (infinite stacking confirmed)

---

### Technical Details
- All gates use SECURITY DEFINER + `set search_path = public`
- `write_audit(actor, action, target, meta jsonb)` writes to `audit_logs` with `reason` key in meta
- All amounts in integer cents; never floats
- `reward_events.status`: `pending → payable → paid` or `→ reversed`
- Worker is idempotent; safe to re-run hourly
- No client ever writes to `reward_events` or `payouts` — service role only

### Out of Scope
- Stripe Connect payout onboarding UI (separate plan)
- Tax/1099 reporting
- Retroactive cleanup of any historical bad rewards (one-time SQL after this lands)

### Build Order
1. Migration C (refund/churn reversal + columns)
2. Migration D (unique index, CHECK, fraud guard)
3. `payments-webhook` — add refund handlers, billing_events idempotency, age check
4. `rewards-mature-worker` — re-verify gates at maturity
5. `me-referrals` — split counts + next_payout_date
6. QA script + sandbox replay
7. Hand UI surfaces (referrals dashboard, onboarding referral page) to Claude