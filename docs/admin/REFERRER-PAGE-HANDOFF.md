# Handoff — Referrer "refer & get paid" page (for the Onboarding Claude)

*From: Admin/Backend Claude. The backend for the referrer-facing earnings page is built and stable. This note specifies exactly what to wire so the referrer page is frictionless. Backend owner won't touch the onboarding/settings UI — that's your lane.*

## Goal
Make it dead-simple for a referrer (founder or user) to: share their link, see who they referred, see what they've earned, and set how they get paid. Church Center–simple.

## SDK (already shipped — just call these)
All in `src/integrations/cog/referrals.ts`:

- **`getMyReferrals(): Promise<MyReferralsSummary>`** — everything the page needs in one call:
  - `code`, `link` (share URL — `buildReferralShareUrl(code)` also available)
  - `attributed_count`, `paying_count`
  - `per_referral_cents`, `monthly_recurring_cents`
  - `earnings`: `{ pending_cents, payable_cents, paid_cents, lifetime_cents }`
  - `next_payout_estimate_cents`
  - `recent_referrals[]`: `{ referred_at, is_paying, has_paid_before, total_earned_cents }`
  - `payout_method`: `{ kind: 'manual'|'paypal'|'stripe_connect'|null, email, country }`
- **`setMyPayoutMethod({ method, email?, country? })`** — save how they get paid. `method` ∈ `manual|paypal|stripe_connect`. Email is required for `manual` and `paypal` (enforced server-side; surface the validation error).

## Suggested page shape (`/settings/referrals` or onboarding `EarnPage`)
1. **Share block** — big copy-able `link`, share button. This is the primary action.
2. **Earnings summary** — `payable_cents` (available), `pending_cents` (held, matures after the clawback hold), `paid_cents` (lifetime). Use the same money format as the app.
3. **Get-paid block** — if `payout_method.kind == null`, a prominent "Add payout method" CTA → `setMyPayoutMethod`. **This is the unlock**: until it's set, the admin side shows them as "owed but can't be paid" (see `/admin/referrals`). Nudge it.
4. **Recent referrals list** — from `recent_referrals`, show paying vs not.

## Important UX truths from the backend
- **Pending vs payable**: rewards are held for a clawback window before becoming payable (refund protection). Show "pending" as "on the way," not "available."
- **Payout method is the bottleneck to getting paid.** If they earned but never set a method, payouts can't be approved. Make step 3 unmissable.
- Money values are **cents**; divide by 100.
- Don't invent payout timing promises — `next_payout_estimate_cents` is an estimate; payouts are batched/approved monthly on the admin side.

## What NOT to do
- Don't write attribution or reward rows from the client — that's the payments webhook's job.
- Don't call admin RPCs from the referrer page — `me-*` functions only (they're scoped to the current user).
