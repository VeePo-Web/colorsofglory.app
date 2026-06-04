## Goal

Guarantee that referral rewards (founder tiered + $5/mo user cash) ONLY fire when the referred user has actually paid real money on a Pro / Founder Pro subscription invoice. No leaks on: trial invoices, $0 invoices, one-time charges, storage add-ons, free plan, refunded invoices, or self-referrals.

## Audit findings

The current `record_invoice_paid` + `payments-webhook` flow already covers most cases but has **5 confirmed leaks** and **3 hardening gaps**.

### Confirmed leaks (must fix)

1. **$0 / trial invoices mint rewards.** Stripe sends `invoice.paid` with `amount_paid = 0` for trial-start, full-discount, and pure proration-credit invoices. `record_invoice_paid` reads `v_amount` but never checks it → a $5 reward is created for a non-paying user.
2. **One-time invoices (no subscription) bypass the plan gate.** The `IF v_sub_id IS NOT NULL THEN ... plan check` block is skipped when an invoice has no subscription, then the function continues and mints a reward if attribution exists.
3. **`invoice.paid` AND `invoice.payment_succeeded` both routed to `handleInvoicePaid`.** Stripe emits both for the same invoice. Idempotency key dedupes the reward row, but two billing_events / two function calls run. Should route only `invoice.paid`.
4. **Subscription status not checked.** A `pro` row whose `status` is `incomplete`, `incomplete_expired`, `unpaid`, or `canceled` (with a delayed retry) can still satisfy the current plan-only check. Require `status IN ('active','trialing','past_due')`.
5. **`me-referrals` `is_paying` per-row uses `earned > 0`.** A user who paid once and churned still shows `is_paying: true` forever. Wrong signal in the UI.

### Hardening gaps

6. **`next_paid_month_index` counts every reward_events row regardless of status.** A reversed (refunded) reward still consumes a "month slot" for tiered founder pricing. Should only count `status IN ('pending','payable','paid')`.
7. **No explicit guard that the invoice's subscription belongs to the referred user.** Today `handleInvoicePaid` trusts `invoice.metadata.userId` then falls back to the subscription row's `user_id`. Add a strict check: the resolved user MUST equal `subscriptions.user_id` for the matched subscription.
8. **No log row when a reward is intentionally skipped.** When a paid invoice arrives but is filtered out (free plan, $0, no attribution, etc.), nothing is recorded. Add a structured `audit_logs` entry so we can prove "we deliberately did not pay" for any invoice.

## Process flow — the locked tracking pipeline

```text
Stripe invoice.paid
        |
        v
payments-webhook (verify, dedupe via billing_events)
        |
        | only event.type === "invoice.paid"
        v
handleInvoicePaid
   * resolve subscription row by external_id
   * if it matches a storage_addon -> RETURN (no reward)
   * if it matches NO subscription row -> RETURN (one-time / unknown)
   * resolve user_id strictly from subscriptions.user_id
        |
        v
record_invoice_paid(_event)   --- SECURITY DEFINER, single source of truth ---
   GATE 1: v_invoice + v_user not null
   GATE 2: v_sub_id NOT NULL                 (no subscription -> no reward)
   GATE 3: v_amount > 0                       (kills trial / $0 / proration)
   GATE 4: subscription.plan IN ('pro','founder_pro')
   GATE 5: subscription.status IN ('active','trialing','past_due')
   GATE 6: referral_attribution exists for v_user
   GATE 7: attr.referrer_user_id != v_user    (self-referral kill)
   GATE 8: idempotency_key unique per invoice (per referrer)
        |
        v
INSERT reward_events (status='pending', hold_until = now()+30d)
        |
        v
rewards-mature-worker (cron)
   * pending -> payable when hold_until <= now()
        |
        v
create_user_payout_batch / create_founder_payout_batch
   * monthly draft -> admin approval -> paid

Refund / chargeback path:
Stripe charge.refunded / charge.dispute.created
   -> record_invoice_refunded / record_chargeback
   -> reward_events.status = 'reversed'
   -> credit_ledger / payouts adjusted
```

Every gate fails CLOSED. If any gate is uncertain, no reward is written.

## Changes to ship

### Migration A — tighten `record_invoice_paid`

```text
- Add: IF v_sub_id IS NULL THEN RETURN NULL; END IF;
- Add: IF v_amount <= 0 THEN RETURN NULL; END IF;
- Change plan check to also require status IN ('active','trialing','past_due')
- On every early RETURN NULL, call write_audit(v_user,'reward_skipped','invoice',
  NULL, NULL, jsonb_build_object('reason', <reason>, 'invoice', v_invoice), NULL)
- Update next_paid_month_index to count only status IN ('pending','payable','paid')
```

### Migration B — explicit guard view + constraint

```text
- Add CHECK on reward_events: amount_cents > 0
- Add partial unique index reinforcing idempotency_key (already unique; verify)
- Add comment columns documenting each gate
```

### Edge function — `payments-webhook`

```text
- Drop "invoice.payment_succeeded" from the switch (still log to billing_events
  as ignored_duplicate, mark processed).
- In handleInvoicePaid: if no subRowId AND no addon -> log + return (no RPC call).
- Pass invoice.status to the RPC; reject if status != 'paid'.
- Always derive userId from subscriptions.user_id, never trust invoice.metadata
  unless it matches.
```

### Edge function — `me-referrals`

```text
- Replace per-row is_paying = earned>0 with a real lookup:
  is_paying = subscriptions row exists for that user with
              plan in (pro,founder_pro) AND
              status in (active,trialing,past_due) AND
              (current_period_end is null OR > now()).
- Add: monthly_recurring_cents = paying_count * 500 (display the user's MRR).
```

### QA script (one-off, run after deploy)

```text
1. Backfill audit: for every invoice in billing_events with kind='invoice_paid'
   in the last 30d, assert that reward_events either has a row OR audit_logs
   has a 'reward_skipped' row with a reason. Output any orphans.
2. Sanity SQL:
   - Any reward_events with amount_cents=0?  expected 0
   - Any reward_events whose subscription is not pro/founder_pro? expected 0
   - Any reward_events where referrer_user_id = referred_user_id? expected 0
   - Any reward_events linked to a storage_addon external_id? expected 0
3. Stripe sandbox replay: trigger trial start ($0 invoice), free plan checkout,
   storage-addon purchase, full-discount coupon -> none should produce rewards.
   Trigger normal pro $9 invoice -> exactly one $5 cash reward (status=pending).
   Trigger refund -> reward flips to reversed.
```

## Out of scope

- Stripe Connect onboarding for user payouts (still manual / PayPal at launch).
- Retroactively reversing any rewards already minted under the old looser gates (none exist in prod yet).
- Multi-currency conversion in `me-referrals` MRR display.

## Build order

1. Migration A (tighten record_invoice_paid + audit logging).
2. Migration B (CHECK + comments).
3. Update payments-webhook (drop duplicate event, strict user check).
4. Update me-referrals (real is_paying + MRR).
5. Run QA script in sandbox, verify all assertions pass.
6. Hand UI changes (MRR pill on /referrals) to Claude.
