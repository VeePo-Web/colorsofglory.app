## Why phone sign-in is broken right now

Your live auth logs (4:48 UTC) show the exact failure:

```
POST /otp  →  400  error_code=phone_provider_disabled
              "Unsupported phone provider"
```

That error comes from Supabase Auth itself, before any Twilio call. It means **the Phone provider is OFF on the backend auth project** — no SMS sender credentials are configured, so `supabase.auth.signInWithOtp({ phone })` in `src/pages/auth/PhoneLoginPage.tsx` is rejected immediately. Our `otp-guard` edge function, the E.164 formatting, the 6-digit verify screen, and the toll-fraud rate limiter are all correct — they just never run because step 1 dies.

The secondary error in the same session (`email_not_confirmed` when you tried email as a fallback) is unrelated to Twilio: email verification is ON and you hadn't clicked the confirm link yet. Expected behavior.

## What world-class does here (Church Center, Linear, Notion, Stripe Identity)

After studying the Church Center sign-in flow and the leading OTP UXs, the bar is:

1. **One field, one tap.** Phone field auto-focuses, auto-formats as you type, country code is implicit (US default) with a discoverable selector for non-US.
2. **Carrier-grade delivery.** Use Twilio **Verify** (not raw Programmable Messaging) so Twilio handles retries, alternate channels, fraud scoring, and SMS Pumping Protection automatically.
3. **6-digit code, auto-advance, paste-friendly, OTP autofill.** Each input reads `inputmode="numeric"` `autocomplete="one-time-code"` so iOS/Android pull the code from the SMS banner with zero typing.
4. **Resend with a 30s cooldown countdown.** Never let users hammer resend (that's how SMS-pumping bills blow up).
5. **Graceful fallback to email.** If a number can't receive SMS, offer email magic link in the same flow — Church Center does this elegantly.
6. **Clear, calm error copy.** No raw Supabase error strings; map every code to a one-sentence human message.
7. **Geographic guardrails.** Only enable destination countries you actually serve (US/CA to start) in Twilio's SMS Geo Permissions — kills the #1 SMS-pumping vector.

Most of #1, #3, #5, #6 are already implemented well in our two pages. The gaps are #2 (no provider), #4 (cooldown exists but resend button visibility needs a polish pass), and #7 (Twilio-side config the user owns).

## Plan

### Part A — Make phone sign-in actually work (the only thing blocking you)

This is a backend/secrets task. Lovable Cloud cannot toggle the Phone provider via tools, so the flow is:

1. **Connect Twilio** via the Lovable Twilio connector (`standard_connectors--connect twilio`). This stores `TWILIO_API_KEY` (and SID) as runtime secrets and is the same credential we'll use for Verify.
2. **Create a Twilio Verify Service** in the user's Twilio console (one-time, ~60 seconds). Capture the Verify **Service SID** (starts `VA…`).
3. **Add the Verify Service SID as a secret** (`TWILIO_VERIFY_SERVICE_SID`) via `add_secret`. Also confirm `TWILIO_ACCOUNT_SID` is set.
4. **Switch our OTP flow off Supabase's built-in phone provider and onto Twilio Verify via our own edge functions.** Two new functions:
   - `phone-otp-start` — accepts `{ phone }`, runs the existing `otp-guard` rate-limit check, then calls Twilio Verify `/Services/{VA}/Verifications` to send the SMS. Returns `{ ok, channel, attempts_remaining }`.
   - `phone-otp-verify` — accepts `{ phone, code }`, calls Twilio Verify `/Services/{VA}/VerificationCheck`. On `approved`, looks up or creates the matching `auth.users` row (by phone) via admin client and returns a Supabase **session** (using `admin.generateLink` or `admin.createUser` + `signInWithPassword` w/ a derived secret, or — cleanest — a server-minted session using `admin.signInWithIdToken` pattern). Profile + referral attach run in the same call (mirroring the existing email flow).
   - Rationale: keeps Twilio as the single source of truth for SMS, gives us SMS Pumping Protection + Geo Permissions for free, and removes the dependency on Supabase's phone provider toggle.
5. **Update `PhoneLoginPage.tsx` and `CodeVerifyPage.tsx`** to call our two new edge functions instead of `supabase.auth.signInWithOtp` / `verifyOtp`. Error-code → friendly-copy mapping stays; we just add the Twilio-specific codes (`60200` invalid param, `60202` max attempts, `60203` max sends, `20429` rate limit).
6. **Turn on Twilio safety rails** (user-side checklist surfaced in the final message): SMS Pumping Protection ON, SMS Geo Permissions limited to US + CA (expand on request).

### Part B — UX polish to hit Church-Center-grade calm

Small, surgical changes — no redesign:

- `PhoneLoginPage.tsx`: add a subtle "We'll text you a 6-digit code. Standard rates apply." helper under the input (already partial — tighten copy + match cream/charcoal token usage).
- `CodeVerifyPage.tsx`: confirm `autocomplete="one-time-code"` on the input, add visible resend countdown (`Resend in 0:23`), and a clear "Use email instead" link that routes to `/auth/email` preserving any pending invite token in sessionStorage.
- Add an "edit number" affordance on the verify screen (one tap back to the phone field with the value pre-filled).
- Ensure both screens carry the warm radial glow + serif heading per design system.

### Part C — Tracking & audit trail

- New table `phone_otp_events` (id, phone_hash, ip_hash, country, channel, kind: sent|verified|failed, twilio_sid, created_at) populated by the two new edge functions. Used by admin tools to investigate disputed logins and to detect pumping patterns.
- Extend the existing `fraud_flags` trigger family with `kind = 'otp_velocity'` when `check_and_record_otp_send` denies > N times for the same `ip_hash` in 24h.
- Surface last 50 OTP events for a given user in `admin-audit-search` (already exists — just add the new table to its union).

### Out of scope

- WhatsApp OTP channel (Twilio Verify supports it; add later if a user asks).
- Passkeys / WebAuthn (separate initiative).
- Changing email auth — that's working; the "email_not_confirmed" you hit is expected when you haven't clicked the confirm link.

## Technical details

**Files touched / added**

- Add: `supabase/functions/phone-otp-start/index.ts`
- Add: `supabase/functions/phone-otp-verify/index.ts`
- Add: `supabase/migrations/<ts>_phone_otp_events.sql` (table + GRANTs + RLS + `otp_velocity` fraud trigger + extend `admin_audit_search` RPC)
- Edit: `src/pages/auth/PhoneLoginPage.tsx` (call `functions.invoke('phone-otp-start')` instead of `auth.signInWithOtp`)
- Edit: `src/pages/auth/CodeVerifyPage.tsx` (call `functions.invoke('phone-otp-verify')`, persist returned session via `supabase.auth.setSession`, polish resend countdown + email fallback)
- Edit: `src/integrations/cog/` — add `auth/phoneOtp.ts` SDK wrappers
- Edit: `docs/claude-handoffs/` — new handoff doc for Claude on the UX polish bits

**Secrets to add** (Part A, step 3)

- `TWILIO_VERIFY_SERVICE_SID` (user supplies from Twilio console)
- Reuse `TWILIO_API_KEY` and `TWILIO_ACCOUNT_SID` from the Twilio connector

**User actions required** (cannot be done by tools)

1. Approve linking the Twilio connector.
2. In Twilio console: create a Verify Service, copy the Service SID, paste into `add_secret` prompt.
3. In Twilio console: enable SMS Pumping Protection; restrict SMS Geo Permissions to US + CA.

After those three, phone sign-in works end-to-end and the audit trail starts populating.
