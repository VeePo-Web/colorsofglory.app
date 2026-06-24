# CW2 — CLAUDE: Settings Real Data (no fake placeholders)
## Cluster 10 / polish · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Settings screens were static mockups showing **fake, misleading data** to every user.
> Wire them to the real seam with graceful states. Frontend only; tokens only; seam only;
> meet `MOBILE-UX-BENCHMARK.md`. **Status: StoragePage EXECUTED; Referral/Billing scoped.**

## THE PROBLEM
The Settings surface shipped with hardcoded placeholders that look real but aren't:
- `SettingsPage` — a personal email (`officallulas@gmail.com`) + "850MB of 1GB" (fixed: CW prior commit).
- `StoragePage` — `USED_MB = 850`, a fake 620/180/50 breakdown, and an **always-on**
  "You're almost out of storage" warning shown to *everyone* regardless of real usage.
- `ReferralPage` / `BillingPage` — likely similar placeholder debt (audit next).

Fake data in a faith-community product erodes trust the moment a user notices.

## OBJECTIVE
Every Settings screen reflects the user's **real** account/plan/storage via the seam,
with calm loading / unavailable / empty states — never invented numbers, never a false alarm.

## WHAT SHIPPED (StoragePage)
- Wired to **`getStorageUsage()`** (`cog/storage.ts` → `{ bytesUsed, bytesLimit }`).
- `formatBytes` for human MB/GB; real `percent`.
- The **"almost out" warning + coral styling is now conditional** (`percent >= 80`) —
  otherwise a calm gold "Your storage / Every idea lives safely here."
- States: `loading` ("Checking your space…") · `unavailable` (graceful, e.g. no session) ·
  `ready` (real numbers). Removed the fake per-category breakdown (no seam data for it yet).
- Tap targets ≥44/52px; tokens only; reassuring footer copy retained.

## NEXT (same pattern — audit + wire)
1. **ReferralPage** → `cog/referrals.ts` (real code/referrals/rewards; calm empty state).
2. **BillingPage** → `cog/billing.ts` (real plan/status/manage; no fake invoices).
3. Re-audit `SettingsPage` Storage row to show real `used/limit` from the same seam
   (currently "Manage your space").
4. When a per-category breakdown seam exists (voice / files / exports), restore it with real data.

## VERIFY
`tsc` + `build` green. Mobile re-drive at 390px: confirm calm (non-alarm) default state,
real-number formatting, ≥44px targets. (Auth bypass → `unavailable` state in test; real
session shows usage.)

## CONSTRAINTS
Frontend · tokens · seam only (never the raw Supabase client in pages) · iOS-first ·
no fabricated data · `claude/settings-real-data` → merge → delete.

## REFERENCES
- `src/pages/settings/{StoragePage,ReferralPage,BillingPage,SettingsPage}.tsx`
- `src/integrations/cog/{storage,referrals,billing,auth}.ts`
- `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`
