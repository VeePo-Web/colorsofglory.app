## Goal
On the Founder Detail page (`/admin/founders/:id`), let you select one of the founder's codes and drill into exactly which users that code referred and what payouts each of them has generated.

## Where it lives
Add a fourth tab to the existing `Tabs` in `src/pages/admin/FounderDetailPage.tsx`:

`Codes | Users | Rewards | By code` ← new

Keeping it inside FounderDetailPage means we reuse the data already loaded by `adminFounderDetail(id)` — no new RPC, no extra fetches.

## Data wiring (all client-side, from the existing payload)
`adminFounderDetail` already returns:
- `codes[]` — `{ id, value, status, redemption_count, ... }`
- `attributed_users[]` — `{ user_id, attributed_at, code_id }`
- `reward_events[]` — `{ referred_user_id, amount_cents, status, reward_kind, created_at, invoice_external_id, ... }`

We build two lookup maps:
- `usersByCode: Map<code_id, attributed_users[]>`
- `rewardsByUser: Map<referred_user_id, reward_events[]>`

## The "By code" tab UI
- Top: a `Select` listing the founder's codes (label: `CODE · N users · $payable`). Defaults to the code with most referrals.
- Summary strip for the selected code: total referred users, total pending / payable / paid (sum of cash reward_events from those users).
- Table of referred users for that code:
  - User id (truncated, monospace, copy-on-click)
  - Attributed at
  - Reward events count
  - Pending / Payable / Paid totals (money, monospace)
  - Last invoice id (monospace, muted)
- Empty state when a code has no referrals: "No users have signed up with this code yet."

## Quick entry point from the Codes tab
In the existing Codes tab, add a small "View referrals →" link in each row that switches the tab to "By code" and pre-selects that code (via local state lifted to the page).

## Out of scope
- No new RPC, migration, or edge function — purely UI on existing data.
- No per-user expand/sub-rows yet (can come later if needed).
- No CSV export from this panel (Payouts page already exports monthly).