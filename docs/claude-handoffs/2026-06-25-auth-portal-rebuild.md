# Auth Portal Rebuild — Branded Email OTP (no Lovable/Supabase default emails)

_Handed off: 2026-06-25 · Owner: Claude (UI/UX) · Backend ready: Lovable_

## Why

Default Supabase signup emails are branded by Lovable and route through the
Lovable Cloud auth template stack. The user has explicitly required that **no
account flow ever uses Lovable-managed emails**. The backend now ships a custom
branded OTP path that fully replaces the signup confirmation email and the
password-reset email.

## Backend surface (already shipped)

- Table `email_otp_verifications` — service-role only; hashed codes; 10-min TTL.
- Edge `email-otp-start` — sends a 6-digit code via Resend (gateway), branded
  in the cream/gold COG template, from `onboarding@resend.dev` until the
  `colorsofglory.app` sender is verified on Resend (then swap the
  `EMAIL_OTP_FROM` secret).
- Edge `email-otp-verify` — verifies the code; for `signup` creates the user
  with `email_confirm=true` and the supplied password; for `reset` updates the
  password.
- SDK (`src/integrations/cog/auth.ts`):
  - `startEmailOtp({ email, purpose })` — `purpose: 'signup' | 'login' | 'reset'`
  - `verifyEmailOtp({ email, code, purpose, password?, firstName?, lastName? })`
  - `completeEmailSignup({ email, password, code, firstName?, lastName? })` →
    returns a live `Session`.
  - `signInWithPassword`, `requestPasswordReset` remain available but
    `requestPasswordReset` MUST be replaced in the UI by `startEmailOtp({ purpose: 'reset' })` so the reset email is branded.

## Required UI work

1. **Signup screen** — replace any `supabase.auth.signUp` call with the
   two-step flow:
   - Step 1: collect email + password (+ optional name) → `startEmailOtp({ email, purpose: 'signup' })` → push to the OTP step.
   - Step 2: 6-digit code input → `completeEmailSignup(...)` → on success route to `/onboarding`.
   - Resend countdown (60s); show remaining attempts when API returns `INVALID_OTP`.
2. **Forgot password** — replace the existing flow with
   `startEmailOtp({ email, purpose: 'reset' })` → OTP screen → `verifyEmailOtp({ purpose: 'reset', password: newPassword })` → call `signInWithPassword` to drop straight into the app.
3. **VeePo-style polish (parity targets)**
   - Caps-lock warning under the password field.
   - Show/hide password toggle.
   - Lockout countdown when `AuthError.code === 'RATE_LIMITED'`.
   - Strength meter (zxcvbn or simple heuristic) with HIBP-friendly copy.
   - Inline server errors styled with `--cog-warm-gray` text, no toast spam.
4. **Do not call** `supabase.auth.signUp` anywhere. ESLint rule suggestion:
   ```js
   'no-restricted-syntax': ['error', { selector: "CallExpression[callee.property.name='signUp']", message: 'Use startEmailOtp(\"signup\") instead — branded path only.' }]
   ```

## Error code map (already classified by the SDK)

| Server code           | `AuthErrorCode`         | Suggested copy |
|-----------------------|-------------------------|----------------|
| `invalid_code`        | `INVALID_OTP`           | "That code didn't match. Try again." |
| `invalid_or_expired`  | `INVALID_OTP`           | "That code expired. Tap resend." |
| `too_many_attempts`   | `RATE_LIMITED`          | "Too many wrong codes. Request a new one." |
| `rate_limited`        | `RATE_LIMITED`          | "Too many code requests. Wait a minute." |
| `weak_password`       | `WEAK_PASSWORD`         | "Pick at least 8 characters." |
| `email_in_use`        | `UNKNOWN` (custom copy) | "That email already has an account." |

## Operational notes

- For production, set the secret `EMAIL_OTP_FROM` to
  `"Colors of Glory <noreply@colorsofglory.app>"` once the domain is verified
  inside Resend. Until then, the function sends from `onboarding@resend.dev`,
  which is deliverable but visually unbranded in the From field — the email
  body itself is fully COG-branded.
- Velocity caps: 5 codes per email per 15 minutes, 5 verify attempts per code.
- The Supabase native "confirm email" template is no longer the entry point;
  if anyone re-enables it via `supabase.auth.signUp`, fix the call site.