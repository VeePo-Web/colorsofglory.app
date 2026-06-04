## Goal

When a user signs up using a founder's code and pays for Pro, the founder earns:
- **$25/month for the first 3 months** of that subscriber
- **$10/month** every month after that, for as long as the subscriber stays on Pro

## How it fits the existing system

The reward engine already supports a per-founder reward profile with three knobs: `first6_cents`, `first6_months`, `ongoing_cents`. The `record_invoice_paid` function reads these from `founders.reward_profile` on every paid invoice and writes the correct cash reward into `reward_events` (which the admin Payouts page already aggregates). So this change is just updating the numbers — no new tables, no edge function changes, no UI changes.

Current defaults: $20 × 6 months, then $10. We are changing them to: **$25 × 3 months, then $10**.

## Single migration

1. **Update app-wide defaults** in `app_settings`:
   - `founder_reward_first6_cents` → 2500
   - add `founder_reward_first6_months` → 3
   - `founder_reward_ongoing_cents` stays 1000
2. **Update the column default** on `public.founders.reward_profile` to `{"first6_cents": 2500, "first6_months": 3, "ongoing_cents": 1000}` so new founders inherit the new rule.
3. **Backfill every existing founder** by setting their `reward_profile` to the new values (since current founders are pre-launch and should all use the new rule).
4. **Leave `record_invoice_paid` untouched** — it already reads `first6_cents`, `first6_months`, `ongoing_cents` from each founder's profile, so the new values take effect on the very next paid invoice. Already-recorded `reward_events` are not retroactively changed (correct behaviour — past invoices keep their historical amounts).

## What stays the same

- 30-day hold before a reward becomes payable (`reward_hold_days`).
- Refunds/chargebacks still reverse the matching reward.
- Per-user referral credits ($10 service credit) are unchanged.
- Admin dashboard, payouts CSV, and the "By code" drilldown all keep working — they just start showing $25 amounts for new subscribers' first three invoices.

## Out of scope

- No change to the admin UI (the existing payable / pending / paid totals already reflect whatever amounts the engine writes).
- No per-founder override UI yet. If you later want a specific founder on a different rate, we can edit `reward_profile` directly or add a small admin form.
- No retroactive recalculation of historical rewards.
