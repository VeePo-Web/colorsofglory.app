## Plan — Owner/Admin account + sign-in (email primary, phone secondary)

### Goal
Get Parker (parker@veepo.ca, +1 403‑830‑8930) signed in today as the owner/admin, with a visible Account menu and a link into the existing `/admin` area. Phone OTP gets wired as a secondary path on the same sign‑in screen.

---

### 1. Seed the admin account (backend, runs once)

Use the existing `admin-seed-parker` edge function — it already:
- Creates or updates `parker@veepo.ca` with a confirmed email
- Grants `admin` role in `user_roles`
- Stores a password hint in `app_settings`

Changes:
- Update the seeded password to one you'll actually use. Two options:
  - **A.** Keep the current dev password (`MG101!! × 4`) and you reset it after first login.
  - **B.** Add a `secrets--add_secret` for `ADMIN_SEED_PASSWORD` and have the function read it. Safer.
- Invoke the function once from Lovable after the change deploys (no UI button needed).
- Also write `phone = +14038308930` on the `auth.users` row via `admin.updateUserById` so phone OTP works for the same account, and mirror `phone_e164` into `profiles` (the `handle_new_user` / sync paths already cover this on insert; we just patch the existing row).

### 2. Auth configuration

- `configure_auth`: `disable_signup: false`, `auto_confirm_email: false`, `password_hibp_enabled: true`, `external_anonymous_users_enabled: false` (matches the Core memory).
- Confirm Google OAuth provider is already wired (it is, per memory). No change.
- Phone OTP: enable only if a Twilio connection exists. If not, the UI shows a friendly "SMS sign‑in isn't available yet" message (the existing `PhoneLoginPage` already handles this error), and email stays the working path. We won't block on Twilio.

### 3. Sign-in screen (frontend SDK + thin page in `src/integrations/cog/*` only)

Per the 3‑agent contract, Lovable doesn't author `src/pages/**` or `src/components/**`. So:
- Add `src/integrations/cog/auth.ts` with typed helpers:
  - `signInWithPassword({ email, password })`
  - `signInWithGoogle()`
  - `sendPhoneOtp(e164)` / `verifyPhoneOtp(e164, code)`
  - `signOut()`
  - `getSessionUser()` (uses `getUser()` for trust checks)
  - `isCurrentUserAdmin()` already exists in `src/integrations/cog/admin.ts` — reuse.
- Claude Code owns the actual `/auth/sign-in` page + Account menu UI. We hand over a one‑page spec describing: email field, password field, "Sign in" gold CTA, "Continue with Google" secondary, divider, "Use phone instead" link routing to existing `/auth/phone` flow, "Forgot password" link to `/auth/reset` (also Claude's to build).
- Lovable will only verify the SDK contract compiles after Claude ships the page.

### 4. Account menu entry point

Hand to Claude with this contract (Lovable provides the data hook only):
- New typed hook `useCurrentAccount()` in `src/integrations/cog/auth.ts` returning `{ user, profile, isAdmin, signOut }`.
- Menu items: display name + email, "Settings" (→ `/settings`, already exists), "Admin" (→ `/admin`, only when `isAdmin`), "Sign out".

### 5. Verification checklist (Lovable runs after Claude lands the UI)

1. `parker@veepo.ca` + chosen password → lands on `/` authenticated.
2. `isCurrentUserAdmin()` returns `true`; `/admin` loads through `RequireAdmin`.
3. Account menu shows email + Admin link.
4. Sign out clears the session and redirects to sign‑in.
5. Phone OTP attempt with +1 403‑830‑8930 either succeeds (if Twilio is live) or shows the friendly fallback (if not).

---

### Out of scope (separate plans)
- Building the actual sign‑in page and Account menu components (Claude).
- Password reset email template branding (Lovable Emails scaffolding) — only if you want custom branded auth emails; default templates work otherwise.
- Twilio SMS provisioning, if not already connected.

---

### One decision I need from you before building
**Password handling for the seed:** do you want me to (A) keep the current dev password and you change it right after first login, or (B) have you set a real password via the `ADMIN_SEED_PASSWORD` secret before I run the seed? Reply "A" or "B" and I'll switch to build mode and execute.