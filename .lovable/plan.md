# Account Feature — Verification + Claude Handoff

Backend for the owner/admin account is already in place (admin seeded, `user_roles` row created, `src/integrations/cog/auth.ts` SDK ready, `configure_auth` applied). Two things left in Lovable's lane, then hand the UI to Claude.

## 1. Backend verification (Lovable does this)

Quick sanity checks before declaring the account feature "works":

1. `supabase--read_query` — confirm:
   - `auth.users` row for `parker@veepo.ca` exists, `email_confirmed_at` is set, phone `+14038308930` attached.
   - `profiles` row auto-created by `handle_new_user` trigger (display name, referral_code present).
   - `user_roles` has `(user_id = parker, role = 'admin')`.
2. `supabase--curl_edge_functions` — re-invoke `admin-seed-parker` (idempotent) to make sure it still upserts cleanly.
3. `supabase--linter` — scan for any new RLS warnings introduced by recent migrations.
4. Write a tiny `scripts/codex/verify-admin-account.md` checklist Codex can run later (login → `isCurrentUserAdmin()` → `/admin` reachable → sign out clears session).

No schema changes. No new edge functions. No new secrets.

## 2. Claude handoff prompt (Lovable writes this file)

Create `docs/claude-handoffs/2026-06-08-auth-and-account-menu.md` containing the full in-depth prompt below. Claude will read this and build the UI in its lane (`src/pages/**`, `src/components/**`) — Lovable will not touch those files.

### Prompt contents

**Title:** Build `/auth/sign-in`, `/auth/reset-password`, and the global Account menu

**Context Claude must load first:**
- `CLAUDE.md` §2 (design tokens), §4 (routes), §11 (locked product decisions)
- `docs/claude-build-persona.md` (full persona, quality gates)
- `src/integrations/cog/auth.ts` (the only auth API Claude may call — do NOT import `@/integrations/supabase/client` directly)
- Reference image: `zip_extracted/.../reference images/` (phone login mockups: `Colors_of_Glory_Screen_1_Phone_Login_UX_Handoff.pdf` + alt-inspo PDF)

**Scope — exactly these screens/components:**

1. `src/pages/auth/SignIn.tsx` at route `/auth/sign-in`
   - Tabbed: **Email** (default) | **Phone** | **Google**
   - Email tab: email + password, "Forgot password?" link → `/auth/forgot-password`, primary gold CTA "Sign in".
   - Phone tab: phone input (E.164, default +1), "Send code" → OTP 6-digit input → "Verify". Use `sendPhoneOtp` / `verifyPhoneOtp`. If backend returns `AuthErrorCode.PROVIDER_NOT_CONFIGURED`, swap CTA for a calm "Phone sign-in coming soon — use email for now" message; do not throw.
   - Google tab: single full-width "Continue with Google" button → `signInWithGoogle`.
   - Cream background + bottom-centered `cog-glow`. Serif H1 "Welcome back". No tech-startup polish.
2. `src/pages/auth/SignUp.tsx` at `/auth/sign-up` — email + password + display name, HIBP errors surfaced inline ("This password has appeared in a data breach — choose another"). Email-confirmation success screen ("Check your inbox — we sent a link to {email}").
3. `src/pages/auth/ForgotPassword.tsx` at `/auth/forgot-password` — email field → `requestPasswordReset`. Success state: "If an account exists, we sent reset instructions."
4. `src/pages/auth/ResetPassword.tsx` at `/auth/reset-password` — REQUIRED. Reads recovery token from URL hash, new-password form → `updatePassword`. On success → redirect to `/`.
5. `src/components/cog/AccountMenu.tsx` — header avatar dropdown:
   - Trigger: avatar circle (initials fallback) in top-right of every authenticated page.
   - Menu items: display name + email (header, non-interactive), "Settings" → `/settings`, "Admin" → `/admin` (render only when `isAdmin`), divider, "Sign out".
   - Built on shadcn `DropdownMenu`. Calm — no badges, no red dots.
6. `src/pages/Settings.tsx` at `/settings` — sections: Profile (display name, avatar upload — stub upload UI, Lovable wires storage later), Security (change password, sign out everywhere), Phone (add/verify phone if missing), Account (email shown read-only, plan tier badge). Each section is a card with gold-bordered selected state on focus.
7. `src/components/cog/RequireAuth.tsx` and `src/components/cog/RequireAdmin.tsx` route guards — use `useCurrentAccount()`. While `loading`, render a calm cream skeleton, not a spinner-flash. Redirect unauthed → `/auth/sign-in?next=<current>`. Redirect non-admin from admin routes → `/`.
8. Wire all routes in `src/App.tsx` (Claude rewrites/extends the router). Public routes: `/auth/*`, `/invite/:token`. Everything else gated by `RequireAuth`. `/admin/*` additionally gated by `RequireAdmin`.

**Hard rules for Claude:**
- Use ONLY `src/integrations/cog/auth.ts`. Never import `supabase` directly.
- Tokens only — never raw hex/Tailwind colors like `bg-white`, `text-black`. Use `bg-[var(--cog-cream)]`, `text-[var(--cog-charcoal)]`, etc., per `CLAUDE.md` §2.
- Serif for H1s (Playfair). Inter for body.
- Mobile-first (390px). Full-width gold CTAs on mobile, max-w-md card on desktop.
- Surface every `AuthError.code` as friendly copy (provide a copy map: `INVALID_CREDENTIALS` → "That email and password don't match.", `EMAIL_NOT_CONFIRMED` → "Check your inbox to confirm your email first.", `RATE_LIMITED` → "Too many attempts — try again in a minute.", `PROVIDER_NOT_CONFIGURED` → graceful fallback, `WEAK_PASSWORD` / HIBP → "Choose a stronger password — this one has been seen in a breach.").
- Keep the password input focused on mount; refocus after a failed attempt.
- After successful sign-in: navigate to `?next=` if present, else `/`.
- Account menu must be present on every authenticated screen — add it to the shared app shell.

**Acceptance checklist Claude must self-verify before handing back:**
- [ ] Sign in with `parker@veepo.ca` + dev password lands on `/`.
- [ ] AccountMenu shows email + an "Admin" item.
- [ ] `/admin` loads (RequireAdmin passes).
- [ ] `/settings` renders all four cards.
- [ ] Sign out clears session and bounces to `/auth/sign-in`.
- [ ] `/auth/reset-password` exists and handles `type=recovery` hash.
- [ ] No direct `@/integrations/supabase/client` imports outside `src/integrations/cog/*`.
- [ ] All colors use CSS vars; no raw Tailwind color utilities.

**Out of scope for Claude this round:** avatar storage upload wiring, billing/plan UI, referral dashboard, phone provider provisioning.

## 3. After both done

- Update `.lovable/plan.md` Phase status: Auth backend ✅, Auth UI handed to Claude.
- Reply to user with one-line summary + the artifact path of the handoff doc so they can paste it to Claude.

No DB migrations, no edge functions, no new secrets in this step.
