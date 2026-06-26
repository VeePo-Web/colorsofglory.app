## Audit findings — current Create Account flow

What's on disk today (`EmailAuthPage.tsx` + `signUpWithPassword` in `src/integrations/cog/auth.ts`):

1. **Calls `supabase.auth.signUp` directly.** That triggers Supabase's built-in confirmation email — sent from a `noreply@…` Supabase address, with copy and styling we don't control. New users see a Lovable/Supabase-branded message, not Colors of Glory. ⛔ Fails "nothing through Lovable."
2. **`emailRedirectTo: ${window.location.origin}/`** — on the preview that resolves to `…lovableproject.com` and on prod to `colorsofglory.app`. The link itself bounces through Supabase auth domain first. Another off-brand surface.
3. **Password reset uses `supabase.auth.resetPasswordForEmail`** — same problem: branded reset email comes from Supabase.
4. **No 2-step on email sign-in** (VeePo always asks for a 6-digit email OTP after password).
5. **No lockout / rate-limit on the form** (VeePo locks out for 30s after 5 failed attempts, shows a live countdown).
6. **Missing polish vs. VeePo portal:** no show/hide password toggle, no caps-lock warning, no per-attempt-remaining copy, no `noindex` meta, no "Verification required for security" footnote, no `aria-live` on countdown.
7. **`disable_signup` is currently off** — anyone can call the Auth REST API directly and create accounts that skip our funnel.

## What VeePo does (relevant patterns I'm copying)

- Custom email OTP after password — own edge function, own sender, 6-digit code, expiry, attempt cap.
- 5-attempt lockout with 30s countdown, live remaining-seconds indicator.
- "Don't have access? Contact us" pattern (we keep public signup since COG is a lead-magnet funnel — we deviate here intentionally).
- `Helmet noindex,nofollow` on auth screens.
- Caps-lock and show/hide password affordances on every password field.
- Loading button copy switches between "Sending code…" / "Signing in…" / "Creating account…".
- All auth state changes go through a single `AuthContext` listener — no scattered `getSession` calls.

## Fix plan (backend = me, UI = handoff doc for Claude)

### 1. New table — `email_otp_verifications`
service-role-only RLS. Columns: `id, email_hash, code_hash, purpose ('signup'|'login'|'reset'), attempts, expires_at, used_at, ip_hash, created_at`. Hash with the existing `OTP_IP_SALT`. 10-minute expiry, max 5 wrong-code attempts before the row is burned.

### 2. New edge function — `email-otp-start` (anon, `verify_jwt = false`)
Body: `{ email, purpose }`. Generates a 6-digit code, stores `code_hash`, sends a branded HTML email via Resend (`noreply@colorsofglory.app`) with COG cream + gold template, serif heading, plain code shown big. Returns `{ ok, expires_in: 600 }` or `{ ok:false, code }`. Rate-limited per email + per IP (reuses `check_and_record_otp_send` pattern). Never returns 5xx.

### 3. New edge function — `email-otp-verify` (anon, `verify_jwt = false`)
Body: `{ email, code, purpose, password? }`.
- `purpose='signup'`: verify code → `admin.createUser({ email, password, email_confirm: true })` (skips Supabase confirmation email entirely) → generateLink+verifyOtp dance to mint a session → return `{ access_token, refresh_token }`.
- `purpose='login'`: verify code only → returns `{ ok:true }` (caller already authenticated by password in step prior).
- `purpose='reset'`: verify code → `admin.updateUserById({ password })` → mint session.

### 4. New edge function — `auth-rate-limit-check` (or reuse `otp-guard` pattern)
Server-side 5-attempt password lockout per email-hash + IP-hash, 30s. Client lockout UI is mirrored but the server is source of truth.

### 5. SDK rewire — `src/integrations/cog/auth.ts`
- `signUpWithPassword({ email, password, firstName, lastName })` → calls `email-otp-start` with `purpose:'signup'`, stores pending payload in returned token, returns `{ pendingToken, expiresIn }`.
- New `completeSignupWithCode({ pendingToken, code })` → invokes `email-otp-verify`, `supabase.auth.setSession(...)`.
- `requestPasswordReset(email)` → invokes `email-otp-start` purpose=reset.
- New `completePasswordReset({ email, code, newPassword })` → invokes `email-otp-verify` purpose=reset.
- Optional 2FA on login (gated by `VITE_REQUIRE_LOGIN_2FA`): after `signInWithPassword`, immediately send purpose=login OTP and require verify before routing.
- Map all backend `code` values to existing `AuthError` codes — UI copy stays calm/honest.

### 6. Hard-disable Supabase's built-in email channel
`configure_auth({ disable_signup: true, auto_confirm_email: false, password_hibp_enabled: true, external_anonymous_users_enabled: false })`. With `disable_signup: true`, *only* our edge function path (which uses `admin.createUser`) can mint accounts — every Lovable/Supabase email surface is closed.

### 7. Resend connector
Add Resend connector (Lovable has it) using `colorsofglory.app` as the sending domain. If DNS isn't ready yet, fall back to Resend's `onboarding@resend.dev` only for non-prod, and surface a TODO. No template lives on Lovable infra — markup is inlined in the edge function.

### 8. Claude handoff doc — `docs/claude-handoffs/2026-06-25-auth-portal-rebuild.md`
Tells Claude exactly how to rebuild `EmailAuthPage` + a new `EmailCodeVerifyPage` + a new `PasswordResetPage` against the new SDK signatures. Includes:
- Required UX: show/hide password, caps-lock badge, `noindex` meta, 5/30s lockout with `aria-live` countdown, per-attempt-remaining copy, "Creating account…" / "Sending code…" loading copy.
- Required visual: cream + gold tokens, serif heading, OnboardingShell, 56-tall pill inputs, gold CTA — same system already in use on PhoneLoginPage.
- The 6-digit code page is the same `CodeVerifyPage` pattern already on phone, parameterized for email.

### 9. Verification I'll run before declaring done
- `curl_edge_functions` smoke `email-otp-start` with my email → row appears, Resend message ID logged.
- `email-otp-verify` rejects wrong code (5x → row burned), accepts correct code.
- After a successful signup-via-OTP: `auth.users` row exists with `email_confirmed_at` set, `handle_new_user` trigger populated `profiles` with referral_code.
- Confirm `supabase.auth.signUp` from the browser console now returns `signup_disabled` — proving the Supabase channel is closed.

### Files I'll touch
- `supabase/functions/email-otp-start/index.ts` (new)
- `supabase/functions/email-otp-verify/index.ts` (new)
- `supabase/migrations/<ts>_email_otp_verifications.sql` (new)
- `supabase/config.toml` (add `verify_jwt = false` blocks)
- `src/integrations/cog/auth.ts` (rewire signup + reset SDK)
- `docs/claude-handoffs/2026-06-25-auth-portal-rebuild.md` (new — UI spec for Claude)
- `configure_auth` call + `add_secret` for Resend (only if no Resend connector picked)

### What I'm explicitly NOT doing
- Not redesigning the pages in `src/pages/auth` myself — that's Claude's lane. I'll ship the SDK + the handoff doc; Claude executes the UI in his next pass.
- Not breaking existing phone OTP work (already shipped this turn).
- Not making COG invite-only — the business model requires open signup.
