# Internal Admin Dashboard

A private, noindex admin area for you only. Server-verified via `is_admin(auth.uid())` — never linked from public nav.

## Routes (added to `src/App.tsx`)

```
/admin                  → AdminHome (summary cards + recent activity)
/admin/founders         → Founders list (create founder, view summary table)
/admin/founders/:id     → Founder detail (codes, attributed users, reward events)
/admin/codes            → All codes table (create code, deactivate/reactivate)
/admin/payouts          → Monthly payout view (per founder, per month, cash owed)
```

All wrapped in `<RequireAdmin>` — calls `supabase.auth.getUser()` + `isCurrentUserAdmin()` RPC. Non-admin → redirect to `/`. Loading state during check. Every admin page sets `<meta name="robots" content="noindex,nofollow">` via a small `<NoIndex/>` helper.

## Components (new, under `src/components/admin/`)

- `RequireAdmin.tsx` — gate wrapper
- `AdminShell.tsx` — minimal chrome: top bar with "Admin" label + sub-nav (Home / Founders / Codes / Payouts), back to app link
- `CreateFounderDialog.tsx` — form: display_name, slug, tier, optional initial code + discount_cents + reward_profile (first6_cents, ongoing_cents). Calls `adminCreateFounder`
- `CreateCodeDialog.tsx` — form: founder picker, code (uppercased, regex-validated), discount_cents, expires_at. Calls `adminCreateFounderCode`
- `DeactivateCodeButton.tsx` — confirm + `adminDeactivateCode`
- `FounderSummaryTable.tsx`, `FounderDetailPanel.tsx`, `CodesTable.tsx`, `MonthlyPayoutsTable.tsx`, `ActivityFeed.tsx`

## Pages (new, under `src/pages/admin/`)

- `AdminHomePage.tsx` — totals (active founders, total payable this month, attributed users count) + recent referrals feed (`adminReferralsRecent`)
- `FoundersPage.tsx` — table from `adminFounderSummary()` + "New founder" button
- `FounderDetailPage.tsx` — `adminFounderDetail(id)` with tabs: Codes / Attributed users / Reward events / Payouts
- `CodesPage.tsx` — flat list of all codes across founders, filterable by active/disabled, with create + deactivate
- `PayoutsPage.tsx` — `adminMonthlyPayouts()` grouped by month, showing payable cents per founder + CSV export button (client-side)

## Data layer

All RPC wrappers already exist in `src/integrations/cog/admin.ts` (from the previous backend migration). No new backend work needed for v1. UI uses TanStack Query with 30s stale time; mutations invalidate the relevant queries.

## Design

Utilitarian, not branded. Reuse shadcn `Table`, `Dialog`, `Button`, `Input`, `Switch`, `Badge`. Cream background + small monospace numbers for cents/IDs. Mobile-friendly but desktop-first (this is for you on a laptop). No gold-glow, no serif headings — this is the back office.

## What this plan does NOT include

- No new migrations or edge functions (backend already shipped)
- No editing reward_profile after creation (out of v1 scope, can add later)
- No Stripe Connect / actual money movement (you mark paid manually in `/admin/payouts` later — that mutation can be added in v2)
- No `/admin` link in public nav anywhere

## Verification

1. Sign in as non-admin → `/admin` redirects to `/`
2. Grant yourself admin role in `user_roles` → `/admin` loads
3. Create founder "Test" with code "TESTCODE" → appears in Founders + Codes tables
4. Sign up a second user with `?ref=TESTCODE` → appears under Founder detail → Attributed users
5. Deactivate code → status flips to "disabled", new redemptions blocked

Ready to build?
