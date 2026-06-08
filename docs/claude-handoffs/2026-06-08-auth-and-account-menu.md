# Claude Handoff — Auth UI + Account Menu

**Date:** 2026-06-08
**From:** Lovable (backend)
**To:** Claude Code (frontend)
**Status:** Backend ready. UI is yours.

---

## What Lovable already shipped (do not re-do)

- Owner/admin account seeded: `parker@veepo.ca` (email confirmed), phone `+14038308930` attached, `user_roles` row `admin`, profile row backfilled with `referral_code`.
- Auth config: email/password ON, email confirmation ON, HIBP ON, anonymous sign-ups OFF, Google OAuth enabled.
- Typed auth SDK at **`src/integrations/cog/auth.ts`** — this is the ONLY auth surface you may import. Do not import `@/integrations/supabase/client` from pages or components.
- Profile auto-creation via `handle_new_user` trigger on `auth.users` insert.

### SDK surface you'll use

```ts
import {
  signInWithPassword, signUpWithPassword,
  requestPasswordReset, updatePassword,
  signInWithGoogle,
  sendPhoneOtp, verifyPhoneOtp,
  signOut, getSessionUser,
  useCurrentAccount,        // { user, profile, isAdmin, loading, signOut, refresh }
  AuthError, AuthErrorCode, // typed error class + code union
} from "@/integrations/cog/auth";
```

Every call returns `{ data, error }` where `error` is an `AuthError` with a stable `code: AuthErrorCode`. Surface friendly copy per code (map below).

---

## What to build

### Routes (wire in `src/App.tsx`)

| Path | Component | Guard |
|---|---|---|
| `/auth/sign-in` | `SignIn` | public |
| `/auth/sign-up` | `SignUp` | public |
| `/auth/forgot-password` | `ForgotPassword` | public |
| `/auth/reset-password` | `ResetPassword` | public (handles `#type=recovery`) |
| `/settings` | `Settings` | `RequireAuth` |
| `/admin/*` | existing admin shell | `RequireAuth` + `RequireAdmin` |
| everything else | existing pages | `RequireAuth` |

Public routes also include `/invite/:token` (already exists).

### Files to create

1. `src/pages/auth/SignIn.tsx` — tabs: **Email** (default) | **Phone** | **Google**.
   - Email: email + password, "Forgot password?" link, gold CTA "Sign in".
   - Phone: E.164 input (default `+1`), "Send code" → 6-digit OTP → "Verify". If `AuthErrorCode.PROVIDER_NOT_CONFIGURED`, replace the CTA with a calm: *"Phone sign-in is coming soon — use email for now."* No throws, no red error toasts.
   - Google: single full-width "Continue with Google" → `signInWithGoogle()`.
   - Layout: serif H1 "Welcome back", cream background, bottom-centered `.cog-glow`. Mobile-first.
   - On success: navigate to `?next=` if present, else `/`.
2. `src/pages/auth/SignUp.tsx` — email + password + display name. Surface HIBP inline ("This password has appeared in a data breach — choose another."). Success: *"Check your inbox — we sent a confirmation link to {email}."*
3. `src/pages/auth/ForgotPassword.tsx` — email → `requestPasswordReset(email, { redirectTo: window.location.origin + '/auth/reset-password' })`. Always show same success state regardless of whether email exists (no user enumeration).
4. `src/pages/auth/ResetPassword.tsx` — **REQUIRED**. Reads recovery token from URL hash, shows new-password form, calls `updatePassword(newPassword)`. On success → `/`.
5. `src/components/cog/AccountMenu.tsx` — avatar dropdown (shadcn `DropdownMenu`):
   - Trigger: circular avatar (initials fallback), top-right of authenticated app shell.
   - Items: `{displayName}` + `{email}` (non-interactive header), divider, "Settings" → `/settings`, "Admin" → `/admin` (only when `isAdmin`), divider, "Sign out".
   - Calm. No red dots. No badges.
6. `src/pages/Settings.tsx` — four cards: **Profile** (display name, avatar — stub upload UI; storage wiring comes later), **Security** (change password, sign out everywhere), **Phone** (add/verify phone if missing), **Account** (email read-only, plan tier badge — read from `profile.plan_tier` if present, else "Free").
7. `src/components/cog/RequireAuth.tsx` — use `useCurrentAccount()`. While `loading`, render a cream skeleton (NO spinner flash). Unauthed → redirect to `/auth/sign-in?next={pathname}`.
8. `src/components/cog/RequireAdmin.tsx` — same shape, but redirects non-admin → `/`.

### AuthErrorCode → user-facing copy

| Code | Copy |
|---|---|
| `INVALID_CREDENTIALS` | "That email and password don't match." |
| `EMAIL_NOT_CONFIRMED` | "Check your inbox to confirm your email first." |
| `EMAIL_ALREADY_REGISTERED` | "An account with this email already exists. Try signing in." |
| `WEAK_PASSWORD` | "Choose a stronger password — this one has been seen in a breach." |
| `RATE_LIMITED` | "Too many attempts — try again in a minute." |
| `INVALID_OTP` | "That code didn't work. Request a new one." |
| `OTP_EXPIRED` | "The code expired. Send a new one." |
| `PROVIDER_NOT_CONFIGURED` | (silent, swap CTA per above) |
| `NETWORK_ERROR` | "We couldn't reach the server. Check your connection." |
| _default_ | "Something went wrong. Please try again." |

---

## Hard rules (non-negotiable)

1. **Only import `@/integrations/cog/auth`** for auth. Never `@/integrations/supabase/client` in pages/components.
2. **Design tokens only** — `bg-[var(--cog-cream)]`, `text-[var(--cog-charcoal)]`, `bg-[var(--cog-gold)]`, etc. No raw Tailwind colors (`bg-white`, `text-black`, `bg-blue-500`).
3. **Serif for H1** (Playfair Display), Inter for body.
4. **Mobile-first** (390px). Full-width gold CTAs on mobile, `max-w-md` card on desktop.
5. **Focus management**: email input focused on mount; refocus after a failed attempt.
6. **Calm**: no spinner flashes (use skeletons), no aggressive toasts, no red badges.
7. **No tech-startup polish**: this is a creative sanctuary. Warm, intentional.
8. **AccountMenu present on every authenticated screen** — add to the shared app shell, not per-page.

---

## Acceptance checklist (self-verify before handing back)

- [ ] Sign in with `parker@veepo.ca` + password `Merlingrape101!!Merlingrape101!!Merlingrape101!!Merlingrape101!!` lands on `/`.
- [ ] AccountMenu shows `parker@veepo.ca` and an "Admin" item.
- [ ] `/admin` loads (RequireAdmin passes for parker).
- [ ] `/settings` renders all four cards.
- [ ] Sign-out clears the session and redirects to `/auth/sign-in`.
- [ ] `/auth/reset-password` exists and handles a `#type=recovery` hash.
- [ ] `rg "from \"@/integrations/supabase/client\"" src/pages src/components` returns nothing.
- [ ] No raw Tailwind color utilities in new files: `rg "(bg|text|border)-(white|black|gray|blue|red|green|yellow|slate|zinc)-?\d*" src/pages/auth src/components/cog/AccountMenu.tsx src/components/cog/Require*.tsx` returns nothing.

---

## Out of scope this round (Lovable will pick up)

- Avatar storage upload wiring (bucket exists; SDK helper coming).
- Billing/plan tier UI beyond a read-only badge.
- Referral dashboard.
- Phone OTP provider (Twilio) provisioning.
- Onboarding flow (handled in Phase 2).

---

## Reference

- `CLAUDE.md` §2 (design tokens), §4 (routes), §11 (locked product decisions)
- `docs/claude-build-persona.md` (full persona, quality gates) — read first
- Reference mockups: `zip_extracted/20. SONGWRITING SPECIFIC PART/20. COG -- ONBOARDING/.../Colors_of_Glory_Screen_1_Phone_Login_UX_Handoff.pdf` and the alt-inspo variant