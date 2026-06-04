## Problem
The `/admin` dashboard pages (Founders, Codes, Home) were planned in a previous session but do **not exist** in the current codebase. The backend RPCs and SDK in `src/integrations/cog/admin.ts` are ready. This plan builds the missing admin pages with search and filtering as a first-class feature.

## What We Build

### 1. Admin Route Shell + Guard
- `src/components/admin/RequireAdmin.tsx` — checks `isCurrentUserAdmin()` RPC, shows loading state, redirects non-admins, adds `noindex,nofollow` meta
- `src/components/admin/AdminShell.tsx` — minimal chrome with nav links (Home / Founders / Codes / Payouts), cream bg, gold accent

### 2. Admin Pages (with search + filtering built in)
- **`/admin`** → `AdminHomePage.tsx` — high-level stats (active founders, total referrals, total payable), recent activity feed
- **`/admin/founders`** → `FoundersPage.tsx` — **searchable/filterable** table of all founders
  - Search by: display name, slug, code value, referred user email
  - Filter by: status (active/paused/revoked), tier
  - Sort by: name, referral count, earnings, created date
  - Actions: view detail, create new founder (dialog)
- **`/admin/codes`** → `CodesPage.tsx` — **searchable/filterable** table of all founder codes
  - Search by: code string, founder name, label
  - Filter by: status (active/disabled), expiration state
  - Sort by: created date, usage count, expiration
  - Actions: deactivate code
- **`/admin/founders/:id`** → `FounderDetailPage.tsx` — single founder view with their codes, attributions, reward events
- **`/admin/payouts`** → `PayoutsPage.tsx` — monthly grouped payouts with CSV export

### 3. Management Components
- `CreateFounderDialog.tsx` — form: display_name, slug, tier, reward_profile, notes. Validates slug uniqueness client-side via RPC
- `CreateCodeDialog.tsx` — form: founder picker (searchable dropdown), code string, max_redemptions, expires_at, label. Validates `^[A-Z0-9-]{4,32}$`
- `DeactivateCodeButton.tsx` — confirmation + RPC call + toast + cache invalidation

### 4. Search & Filtering Architecture
Both FoundersPage and CodesPage use the same pattern:
- **Client-side filtering** on the full dataset returned by `adminFounderSummary()` / `adminReferralsRecent()`
- Single search input that scans across multiple fields (name, slug, code, referral email)
- Dropdown filters for categorical fields (status, tier)
- Real-time filtering — no submit button needed
- Result count badge
- Clear-all filters button

### 5. Route Wiring
Add to `src/App.tsx` inside a lazy-loaded admin route group:
```
/admin → AdminHomePage
/admin/founders → FoundersPage
/admin/founders/:id → FounderDetailPage
/admin/codes → CodesPage
/admin/payouts → PayoutsPage
```
All wrapped in `<RequireAdmin>`.

### 6. Data Layer
- Uses existing `src/integrations/cog/admin.ts` RPC wrappers
- TanStack Query with 30s stale time
- Mutations invalidate relevant query keys

## Design Notes
- Desktop-first (admin is desktop-only)
- Utilitarian, cream background, monospace numbers for money/counts
- Reuses shadcn `Table`, `Dialog`, `Button`, `Input`, `Badge`, `Tabs`
- No gold glow, no serif headings — this is internal tooling

## Out of Scope
- No new migrations or edge functions (backend is done)
- No editing reward_profile after creation
- No Stripe Connect / automatic money movement
- No `/admin` link in public nav (secret URL only)