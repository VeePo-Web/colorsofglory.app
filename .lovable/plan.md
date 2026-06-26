## Twilio phone sign-in audit findings

**Root cause:** the current `phone-otp-start` function is calling Twilio Verify at the wrong connector-gateway path:

```text
/twilio/Verify/v2/Services/{VERIFY_SID}/Verifications
```

The linked Twilio connector gateway automatically targets the classic Twilio Account API path, so this Verify v2 path is returning `404 {}`. That becomes `PROVIDER_ERROR`, and the app shows: “We couldn't send the code. Please try again.”

**Confirmed signals:**
- Browser request: `phone-otp-start` returned `{ ok:false, code:"PROVIDER_ERROR" }`.
- Function log: `twilio verify start failed 404 {}`.
- Direct Twilio gateway smoke test works for classic Twilio resources (`IncomingPhoneNumbers.json` returns 200), which means the connector itself is linked and usable.
- Direct gateway request to `/Services.json` fails because it is being routed under the classic `/2010-04-01/Accounts/...` prefix, not Verify v2.
- No verify-function logs exist yet, because the user never gets past the send-code step.

## Church Center UX benchmark notes

Church Center’s phone login works because it keeps the flow extremely calm and narrow:
- Phone/email first, then code second; no passwords in the primary flow.
- Clear region support: phone login is primarily US/Canada; email fallback for unsupported regions.
- Code-entry screen assumes SMS may be delayed and makes resend obvious without blaming the user.
- Errors are specific: wrong code, expired code, rate-limited, unsupported phone, or delivery failed.
- The best OTP UX avoids a generic dead-end when a provider fails.

## Implementation plan

### 1. Replace the broken Verify path with a working Twilio SMS OTP path
Use the Twilio connector gateway’s supported Messaging API:

```text
POST /twilio/Messages.json
```

Build `phone-otp-start` to generate our own short-lived 6-digit code server-side, hash it with a backend pepper, store only the hash, then send the code through Twilio SMS using the connected Twilio sender number.

Why this is the right fix here:
- The existing connector is confirmed working for classic Twilio Account API routes.
- It avoids the broken Verify v2 routing through this gateway.
- It keeps secrets server-side.
- It gives us full control over Church Center-style UX states: resend cooldown, expiry, attempts, lockouts, and audit logging.

### 2. Harden `phone-otp-start`
- Validate E.164 phone numbers.
- Keep existing toll-fraud guard RPC (`check_and_record_otp_send`).
- Require `TWILIO_FROM_NUMBER` or a Messaging Service SID secret for the sender.
- Require `OTP_PEPPER` for hashing OTP codes.
- Generate a 6-digit numeric OTP.
- Store a hash, expiry time, attempt counter, and status in the existing OTP/audit table or create the missing storage table if needed.
- Send SMS with short, branded copy, e.g. `Your Colors of Glory code is 123456. It expires in 10 minutes.`
- Map Twilio errors into useful app codes: `INVALID_PHONE`, `RATE_LIMITED`, `GEO_BLOCKED`, `PROVIDER_ERROR`.

### 3. Harden `phone-otp-verify`
- Stop calling the broken Verify Check endpoint.
- Look up the most recent unexpired pending OTP for the phone.
- Hash the submitted code with `OTP_PEPPER` and compare server-side.
- Increment attempts on wrong code.
- Expire/lock after too many wrong attempts.
- On success, mark the OTP verified and create/update the backend auth user for that phone.
- Return the current one-shot password flow only if it remains the safest available bridge to create a browser session.

### 4. Patch the thin SDK error handling
Update `src/integrations/cog/auth.ts` only, staying in Lovable’s lane:
- Surface `PROVIDER_ERROR` as a delivery failure.
- Surface `RATE_LIMITED`, `INVALID_PHONE`, `GEO_BLOCKED`, `INVALID_OTP`, `EXPIRED`, and `MAX_ATTEMPTS` distinctly.
- Avoid generic “couldn’t send” when the backend gives a better reason.

### 5. Add/repair backend schema if the OTP storage table is missing
If the current database only has audit rows and no pending-code storage, add a secure `phone_otps` table:
- No anonymous access.
- Service-role only table access.
- RLS enabled.
- Store phone, hash, expiry, attempts, consumed timestamp, IP hash, and provider message SID.
- Add cleanup-friendly indexes.

### 6. Verify the end-to-end path
After implementation:
- Deploy `phone-otp-start` and `phone-otp-verify`.
- Test send-code against the deployed function.
- Confirm the function logs show a Twilio `SM...` message SID instead of a 404.
- Test wrong-code behavior.
- Test expired/attempt-limited behavior if possible.
- Verify the app no longer returns the generic provider failure for the send step.

## Secrets needed before/while implementing

I will check current runtime secrets first. If either is missing, I will request it securely:
- `TWILIO_FROM_NUMBER` — currently the connected Twilio account has `+15878044471` available; we can store that as the sender if you want.
- `OTP_PEPPER` — should be generated and stored securely, never committed.

## Deliverable

A working custom Twilio SMS phone login path that does not use the broken native phone provider or broken Verify gateway route, with better Church Center-style reliability and clearer failure states.