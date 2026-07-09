# G2 · Settings Agent — Progress

## Step 1 — Baseline audit (2026-07-08)

### What was already real (kept, not rebuilt)
- **Hub** — `src/pages/settings/SettingsPage.tsx`: real identity via `useCurrentAccount`
  (never hardcoded), working sign-out → `/auth/login`, rows for Upgrade (→ `/upgrade`, G1),
  Billing, Storage, Refer & Earn (→ F3), tour re-arm.
- **Billing management** — `BillingPage.tsx`: current plan + price + status + renewal date
  from `fetchBillingOverview()`, Stripe billing portal for cards/invoices
  (`getBillingPortalUrl`), cancel-at-period-end with a calm confirm
  (`cancelCurrentSubscription(true)`), upgrades hand off to `/upgrade?source=settings` (G1).
  No checkout embedded. Already meets the Step 5 done-check.
- **Storage meter** — `StoragePage.tsx`: `useStorageUsage()` → used/limit bytes, percent bar,
  near-full state at **≥ 80%**, "Add storage / Upgrade for more space" → `/upgrade` (G1).
  Informational only — never blocks.
- **Guards** — the charter flagged `/settings/*` as unguarded; that was **stale**.
  `src/routes/settingsRoutes.tsx` already wraps all four settings routes in `RequireAuth`.

### The real gaps (this run's work)
1. **Account row was a dead `#` link** — no screen to edit display name / avatar or view
   phone/email/referral code, despite `useCurrentAccount` exposing all of it.
2. **Notifications row was a dead `#` link** — prefs exist per-song
   (`song_notification_prefs`: `notify_on_join`, `notify_on_contribution`, `push_enabled`)
   with `getNotificationPrefs`/`upsertNotificationPrefs` in `cog/songs.ts`.
3. **Privacy & Security row was a dead `#` link** — `updatePassword` exists in `cog/auth.ts`;
   no sign-out-everywhere; no account deletion path.
4. Hub footer lacked Help/Terms/Privacy links; no admin entry for admins.
5. StoragePage used a raw `navigate(-1)` back (dead-ends on cold load).

### Boundaries reconciled
- **G1 owns every purchase.** G2 *manages* the existing subscription (cancel, portal) and
  *shows* the meter; every buy CTA routes to `/upgrade`. No Stripe checkout embedded here.
- **G3 owns admin.** G2 shows an entry link only when `isAdmin` — never the console.
- **F3 owns `/settings/referral`** — G2 links to it, never edits it.
- **A3/Lovable own the data layer.** G2 consumes `cog/auth.ts` (`useCurrentAccount`,
  `updatePassword`, `signOut`), `cog/songs.ts` (notification prefs), `pricingApi`
  (billing), `useStorageUsage`. Two thin seams G2 needed that A3 doesn't expose yet live in
  `src/lib/settings/settingsApi.ts` (same precedent as `lib/invite/inviteApi.ts`):
  profile patch (`display_name` / `avatar_color`), global sign-out, and the
  `account-delete` edge-function call. Filed in `docs/SETTINGS-CONTRACT.md` for A3/Lovable
  to fold in / implement server-side.

## Steps 2–10 — shipped in this run
- **Step 2** — `AccountPage.tsx` (+ `AvatarColorPicker`): edit display name + avatar color,
  view email/phone/referral code (copy). Optimistic calm save; identity refreshes app-wide
  via `useCurrentAccount.refresh()`.
- **Step 3** — `NotificationsPage.tsx`: per-song toggles for joins / contributions / push,
  wired to the real prefs; optimistic with revert-on-error; calm empty state.
- **Step 4** — `PrivacyPage.tsx`: change password (`updatePassword`), sign out everywhere
  (global scope), delete account behind a type-DELETE focus-trapped confirm
  (`account-delete` edge function — server side filed with Lovable), links to /terms + /privacy.
- **Step 5** — Billing verified against the done-check; no churn needed (see baseline).
- **Step 6** — StoragePage: `BackHeader` (no dead-end back), thresholds documented for G1
  (near-full = 80%, copy in SETTINGS-CONTRACT.md). No StorageWarningSheet exists yet on
  G1's side — the contract is the coordination point.
- **Step 7** — sign-out clears hook state + routes `replace` to `/auth/login`;
  sign-out-everywhere revokes all sessions (shared/lost device path).
- **Step 8** — hub: all rows real (no `#`), admin entry gated on `isAdmin`, footer with
  Help & Support / Terms / Privacy / version.
- **Step 9** — routes guarded (verified pre-existing), switches are `role="switch"` with
  `aria-checked`, confirm sheet traps focus + Escape closes, reduced-motion honored
  (global rules + no new always-on animation), 390px-first layout.
- **Step 10** — typecheck + build + tests green; `docs/SETTINGS-CONTRACT.md` published.

## Asks filed (see SETTINGS-CONTRACT.md §5)
- **Lovable:** `account-delete` edge function (auth user + owned data + storage cleanup).
- **A3:** fold `settingsApi.updateMyProfile` / global sign-out into `cog/auth.ts`.
- **Lovable (later):** avatar image upload bucket — the account screen ships color avatars
  now; `avatar_url` render support is already in place when a bucket exists.
