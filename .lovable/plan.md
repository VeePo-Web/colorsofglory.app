# Fix: Forgot password sends nothing

## Why nothing arrived

`EmailAuthPage.handleForgot` calls `supabase.auth.resetPasswordForEmail`, which routes through Supabase's default recovery email template. That template is not wired to a sender in this project (no Lovable auth-email-hook, no domain template), so the email is created on the auth side but never lands in the inbox.

Meanwhile the project already ships a fully branded, working alternative — `email-otp-start` + `email-otp-verify` edge functions delivering a 6-digit code via Resend (the same path used for signup). Forgot-password was just never moved over. Per `docs/claude-handoffs/2026-06-25-auth-portal-rebuild.md`, this swap is required and explicit.

## Plan (UI + SDK only, no backend changes)

### 1. SDK — `src/integrations/cog/auth.ts`
Replace the body of `requestPasswordReset(email)` so it calls:
```
startEmailOtp({ email, purpose: "reset" })
```
…and drop the `resetPasswordForEmail` call entirely. This keeps the public SDK shape stable; every existing caller now sends a branded 6-digit code instead of a (silent) default Supabase email.

### 2. New page — `src/pages/auth/ForgotPasswordPage.tsx` (route `/auth/forgot-password`)
A single VeePo-style screen with three internal steps:

- **Step "email"** — email field + "Send code" → `startEmailOtp({ email, purpose: "reset" })`. On success, advance to "code".
- **Step "code"** — 6-digit OTP input, 60s resend countdown, "Enter the code we just emailed to {email}".
- **Step "password"** — new password + confirm, caps-lock warning, show/hide toggle. On submit:
  1. `verifyEmailOtp({ email, code, purpose: "reset", password: newPassword })` — the edge function updates the password via Admin API.
  2. `signInWithPassword({ email, password: newPassword })` — drop straight into the app.
  3. Navigate to `/` via `routeAfterAuth`.

Visuals: reuse `OnboardingShell`, `CogBrand`, `GoldButton`, the same input styling used in `EmailAuthPage` so it feels like one portal. No new design tokens.

Error mapping (already classified by SDK):
- `INVALID_OTP` → "That code didn't match. Try again."
- `RATE_LIMITED` → "Too many attempts. Wait a minute and resend."
- `WEAK_PASSWORD` → "Pick at least 8 characters."

### 3. Hook it up in `EmailAuthPage.tsx`
Replace the inline `handleForgot` logic with a simple `navigate("/auth/forgot-password", { state: { email } })` so the email already typed in the sign-in form is carried over. Remove the cooldown/timer there (it now lives on the dedicated page). The existing "Forgot password?" button stays in the same spot, same copy.

### 4. Routing — `src/App.tsx`
Add the new public route `/auth/forgot-password` → `ForgotPasswordPage` (lazy import, alongside the existing `/auth/email` and `/auth/reset-password` routes). Leave `/auth/reset-password` in place for any in-flight Supabase recovery links (harmless fallback).

## Acceptance test

1. From `/auth/email`, type an email and tap **Forgot password?** → land on `/auth/forgot-password` with the email prefilled.
2. Tap **Send code** → branded COG email arrives within seconds with a 6-digit code.
3. Enter the code → password form appears.
4. Set a new password → automatically signed in and routed home.
5. Wrong code shows inline "didn't match"; 6th send within 15 min returns rate-limit copy.

## Out of scope

- No backend/edge-function changes (`email-otp-start` / `email-otp-verify` already handle the `reset` purpose).
- No design-token changes.
- No removal of `/auth/reset-password`; it stays as a graceful fallback for any cached recovery links.
