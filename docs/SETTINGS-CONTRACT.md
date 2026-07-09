# SETTINGS CONTRACT (G2)

*Published 2026-07-08 · Owner: G2 Settings Agent*

The `/settings` surface: what exists, what it consumes, where every purchase
hands off, and the seams other agents/Lovable own.

---

## 1. Surface map

| Route | Screen | What it does |
|---|---|---|
| `/settings` | Hub (`SettingsPage`) | Real identity sublabel, rows to every settings surface, admin entry (admins only), tour re-arm, sign out, footer (Help/Terms/Privacy/version). **No dead links.** |
| `/settings/account` | `AccountPage` | Edit display name + avatar color (aurora palette + gold, hex in `profiles.avatar_color`); view email / phone / referral code (copy). |
| `/settings/notifications` | `NotificationsPage` | Per-song toggles — `notify_on_join`, `notify_on_contribution`, `push_enabled` — optimistic write, revert on failure. Defaults when no row: join ✓, contribution ✓, push ✗. |
| `/settings/privacy` | `PrivacyPage` (settings) | Change password; sign out everywhere (global session revoke); **delete account** behind a type-DELETE, focus-trapped confirm; links to `/terms` + `/privacy`. |
| `/settings/billing` | `BillingPage` | Plan + price + status + renewal; Stripe **billing portal** for cards/invoices; cancel **at period end** with calm confirm. Management only. |
| `/settings/storage` | `StoragePage` | Used / limit / percent meter. Informational only — never blocks. |
| `/settings/referral` | `ReferralPage` | **F3's screen** — G2 links to it, never edits it. |

All `/settings/*` routes are wrapped in `RequireAuth` (`src/routes/settingsRoutes.tsx`).

## 2. The G1 purchase handoff (hard boundary)

G2 never embeds checkout. Every buy CTA routes to G1:

- Hub "Upgrade to Pro" → `/upgrade`
- Billing "View plans" → `/upgrade?source=settings`
- Storage "Add storage / Upgrade for more space" → `/upgrade`

Cancel-at-period-end and the Stripe billing-portal redirect are *management*
of an existing subscription and stay in G2.

### Storage thresholds (for G1 to match)
- **Near-full = usage ≥ 80%** → coral accent, headline "You're almost out of
  storage", body "Your songs are safe, but new uploads may pause soon.",
  CTA "Add storage".
- Under 80% → gold accent, "Your storage" / "Upgrade for more space".
- Promise everywhere: *existing work is never deleted; only new uploads pause.*
- **Reconciled with G1 (2026-07-08):** G1's shipped `StorageWarningSheet` /
  `StorageWarningController` use the same ≥80% "approaching" threshold, never
  block existing work, and route purchases to G1 checkout — the meter and the
  warning tell one story. Keep both sides at 80% if either changes.

## 3. Data consumed (never rewritten)

| Source | Used for |
|---|---|
| `cog/auth.ts` — `useCurrentAccount` | Identity everywhere (name, email, phone, referral code, `isAdmin`), `signOut`, `refresh` |
| `cog/auth.ts` — `updatePassword` | Privacy → change password |
| `cog/songs.ts` — `listMySongs`, `getNotificationPrefs`, `upsertNotificationPrefs` | Notifications screen |
| `lib/pricing/pricingApi.ts` — `fetchBillingOverview`, `getBillingPortalUrl`, `cancelCurrentSubscription` | Billing screen |
| `hooks/useAppQueries.ts` — `useStorageUsage` | Storage meter |
| `lib/settings/settingsApi.ts` (G2 seam, see §5) | Profile patch, global sign-out, account deletion |

## 4. Account deletion path

1. Privacy → "Delete my account" → focus-trapped sheet, explicit copy
   ("permanently deletes your account and songs… no undo"), button disabled
   until the user types `DELETE`.
2. `requestAccountDeletion()` invokes the **`account-delete` edge function**
   (server side: delete auth user, owned songs, memberships, storage objects,
   revoke sessions).
3. On success: local sign-out + redirect to `/auth/login`. On failure: calm
   error, **nothing removed**, account untouched.

## 5. Seams filed with other owners

- **Lovable (blocking for deletion):** implement the `account-delete` edge
  function per §4. Until it exists the confirm flow fails safe with a calm
  "nothing was removed" error.
- **A3:** fold `src/lib/settings/settingsApi.ts` into the data layer —
  `updateMyProfile({display_name, avatar_color})`, `signOutEverywhere()`
  (global-scope `auth.signOut`). Same precedent as `lib/invite/inviteApi.ts`.
- **Lovable (later):** an avatars storage bucket for photo uploads. The account
  screen ships color avatars now; `profiles.avatar_url` is already read
  app-wide when it exists.
- **G1:** `StorageWarningSheet` shipped mid-run and already matches §2 (≥80%,
  non-blocking) — no action needed unless thresholds change.

## 6. A11y + calm guarantees

- Toggles are real `role="switch"` with `aria-checked`; rows/CTAs ≥ 44px.
- Confirm sheets trap focus, close on Escape, restore focus to the opener.
- Reduced motion honored (global rules + sheet entrance opt-out).
- 390px-first; no red badge counts, no alarm styling — the one true-red action
  is account deletion.
- Sign-out (hub) clears hook state and lands on `/auth/login` with `replace`;
  sign-out-everywhere revokes all sessions (lost/shared device path).
