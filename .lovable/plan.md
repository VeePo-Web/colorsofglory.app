# Add SMS OTP login (Twilio-backed)

Twilio is already configured as the phone provider in the backend Auth settings, so Supabase will send the codes for us. The existing `PhoneLoginPage` and `CodeVerifyPage` already call `signInWithOtp` / `verifyOtp` and work — they're just not surfaced from the main login screen yet. This plan exposes them and adds a tiny smoke test.

## Changes

### 1. `src/pages/auth/EmailAuthPage.tsx`
Add a single secondary entry point under the email/password form:

> Prefer your phone? **Text me a code →** (links to `/auth/phone`)

No other layout changes. Keep the email tabs, forgot password, and terms copy exactly as they are.

### 2. `src/pages/auth/PhoneLoginPage.tsx`
Two small fixes so the page works as a real entry point, not just a demo:
- Make **"Use email instead"** actually navigate to `/auth/login` (currently a dead button).
- Update the verify redirect from `/auth/verify` → `/auth/phone/verify` to match the real route in `App.tsx`.

### 3. `src/pages/auth/CodeVerifyPage.tsx`
Read-pass + verify it reads the `cog:phone-e164` sessionStorage key set by `PhoneLoginPage`, calls `verifyPhoneOtp`, and routes into the app on success. Patch only if mismatched.

### 4. Backend — no schema or function changes
- Phone provider + Twilio creds are already configured on the backend (user confirmed).
- No new secrets, no new tables, no edge functions.
- I'll run one quick OTP send against a test phone number via the existing `scripts/stress/otp-send.ts` (test-numbers mode, 1 request) to confirm the provider returns 200 before handing back.

### 5. Out of scope (not touching)
- Email/password flow, reset password, Google (already removed).
- SMS notifications, invite-by-SMS, WhatsApp — separate features for later.
- `src/integrations/cog/auth.ts` SDK — `sendPhoneOtp` / `verifyPhoneOtp` already exist.

## Verify
- Preview `/auth/login` → see the "Text me a code" link.
- Tap it → `/auth/phone` → enter a number → `/auth/phone/verify` → enter code → land in app.
- Confirm Supabase Auth returns 200 on `/auth/v1/otp` for a test number.
