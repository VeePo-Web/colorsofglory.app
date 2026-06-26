# Phone Sign-In Audit — Root Cause + Fix Plan

## What's actually broken

Auth logs are unambiguous:
```
POST /otp → 400 phone_provider_disabled
```

The frontend is calling Supabase's **native** phone OTP (`supabase.auth.signInWithOtp({ phone })`), but the native Phone provider in the Supabase Auth dashboard is OFF — and on Lovable Cloud we can't toggle that dashboard. That endpoint will never work for this project.

### Why "we built a custom Twilio flow" doesn't help right now
The earlier handoff (`docs/claude-handoffs/2026-06-23-twilio-sms-signin-enable-and-ux.md`) and the more recent email-OTP rebuild both reference custom `phone-otp-start` / `phone-otp-verify` edge functions. **Those files are not in the repo.** Only `otp-guard`, `email-otp-start`, `email-otp-verify` exist under `supabase/functions/`. Same disappearance pattern as the email OTP functions a few turns ago.

Meanwhile the SDK (`src/integrations/cog/auth.ts:192–235`) still calls the native Supabase endpoints:
```ts
supabase.auth.signInWithOtp({ phone, … })   // line 222
supabase.auth.verifyOtp({ phone, token, type: "sms" })  // line 230
```

So the broken chain is: **UI → SDK → native Supabase phone provider (disabled) → 400.**

### What's already healthy
- Twilio connector linked. Secrets present: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_VERIFY_SERVICE_SID`.
- `otp-guard` edge function + `check_and_record_otp_send` RPC (toll-fraud rails) are live and fail-open.
- `OnboardingShell`, `PhoneLoginPage`, `CodeVerifyPage`, `OTPInput`, `useWebOtpAutofill` all built and styled — no UI rewrite needed.
- Email OTP equivalent (`email-otp-start` / `email-otp-verify`) already works using Resend + Supabase Admin API — we mirror that exact shape.

## Church Center UX research (applied)

Church Center's phone sign-in is the gold standard for non-tech audiences:
1. **One field, one ask.** Phone first, code next — no password, no "create account vs sign in" branching.
2. **Forgiving input.** Strips formatting, accepts pasted `+1 (555)…`, country chip is decorative not interactive for US-only.
3. **Honest errors.** "We couldn't send the code. Try again in a moment." — never a Supabase code string.
4. **Auto-advance + auto-submit.** Six digits land, screen submits — no "Continue" button required once the code is full.
5. **Resend with a countdown.** Disabled link until ~30s passes, then "Resend code".
6. **Change number link.** Always visible on the verify screen.
7. **One-tap SMS autofill.** `autocomplete="one-time-code"` + WebOTP (Android) — both already wired.
8. **No marketing copy on auth screens.** Calm, single-purpose.
9. **Same flow on a new device.** No "magic link in email" rescue path that drops users into a different mailbox app.
10. **Sign-in == sign-up.** First valid OTP creates the account; no separate registration form.

Our current screens already follow 1, 2, 3, 5, 6, 7, 8, 10. Gap is the broken backend (4 fires but submission fails) and we should re-confirm 4 once verify works.

## Fix plan

### Step 1 — Recreate `phone-otp-start` edge function
- Public (`verify_jwt = false` in `supabase/config.toml`).
- Validates E.164 (`+1XXXXXXXXXX`), calls `otp-guard` RPC first (toll-fraud rails — block / cool down / geo-allow).
- POSTs to Twilio Verify: `POST /v2/Services/{TWILIO_VERIFY_SERVICE_SID}/Verifications` with `To=<e164>&Channel=sms` via the gateway pattern Twilio docs use (`Authorization: Bearer LOVABLE_API_KEY`, `X-Connection-Api-Key: TWILIO_API_KEY`).
- Returns typed JSON: `{ ok: true }` or `{ ok: false, code: "RATE_LIMITED" | "GEO_BLOCKED" | "INVALID_PHONE" | "PROVIDER_ERROR" }`.
- Logs send to `phone_otp_verifications` audit table (create if missing — mirror `email_otp_verifications`).

### Step 2 — Recreate `phone-otp-verify` edge function
- Public, CORS on.
- POSTs to Twilio Verify Check: `POST /v2/Services/{SID}/VerificationCheck` with `To=<e164>&Code=<code>`.
- On `status === "approved"`: use **Supabase Admin API** to upsert a user keyed by phone (same trick as email-otp-verify), then mint a session via `admin.generateLink({ type: "magiclink", … })` OR sign in by creating a one-shot password — match exactly what `email-otp-verify` does so the pattern is consistent.
- Returns `{ ok: true, session }` (access + refresh tokens) or `{ ok: false, code: "INVALID_OTP" | "EXPIRED" | "MAX_ATTEMPTS" }`.

### Step 3 — Rewire SDK (`src/integrations/cog/auth.ts`)
Replace the `signInWithOtp` / `verifyOtp` bodies in `sendPhoneOtp` / `verifyPhoneOtp` to call the new edge functions via `supabase.functions.invoke`, map response codes → existing `AuthError` enum. Keep the function signatures identical so `PhoneLoginPage.tsx` and `CodeVerifyPage.tsx` don't change.

### Step 4 — Config + audit table
- `supabase/config.toml`: add `verify_jwt = false` blocks for both new functions.
- Migration: `phone_otp_verifications` table (id, e164, status, attempts, ip_hash, created_at, verified_at), service-role only — no public GRANT. Plus index on `(e164, created_at desc)`.

### Step 5 — Verify end-to-end
- `curl` `phone-otp-start` with a test number → expect `{ok:true}` and a real Twilio Verify SMS.
- `curl` `phone-otp-verify` with the received code → expect `{ok:true, session:{…}}`.
- Confirm auth logs show no more `phone_provider_disabled`.
- Smoke through the preview UI on a real device once curl is green.

### Step 6 — Tiny UX polish (only if time, frontend lane)
The OTP input is already 6 boxes with WebOTP hook; the handoff doc §6 noted iOS Security-Code AutoFill drops the full code into box 0 and `.slice(-1)` truncates it. If still present, that's a one-file change in `OTPInput.tsx` — flag for Claude rather than fix from this lane.

## Files touched
- **Add**: `supabase/functions/phone-otp-start/index.ts`, `supabase/functions/phone-otp-verify/index.ts`, one migration for `phone_otp_verifications`.
- **Edit**: `supabase/config.toml` (two new function blocks), `src/integrations/cog/auth.ts` (`sendPhoneOtp` + `verifyPhoneOtp` bodies only).
- **No UI files touched** — Claude's lane.

## Definition of done
- Real phone receives a Twilio Verify SMS within 5s of pressing Continue.
- Entering the code lands signed-in on `/` with no console errors.
- Auth logs show zero `phone_provider_disabled` for new attempts.
- Rate-limit path (4+ sends in 15 min) returns `RATE_LIMITED` with kind copy.
