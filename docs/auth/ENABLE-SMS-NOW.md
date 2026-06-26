# ✅ Turn On SMS Sign-In — Owner Action Sheet (CURRENT architecture)

**Who does this:** whoever holds the **Lovable / Supabase** project + the **Twilio**
account. No app-code changes — the frontend and edge functions are already built.

> ⚠️ **This supersedes the old "enable the native Supabase Phone provider" version.**
> The app does **NOT** use Supabase's built-in phone provider (it's off on Lovable
> Cloud). It uses a **custom Twilio Verify path** through two edge functions. Enabling
> the native provider does nothing here — follow the steps below instead.

---

## How sign-in actually works now (so you know what to turn on)

```
PhoneLoginPage → sendPhoneOtp()
   → edge fn  phone-otp-start   → toll-fraud guard → Twilio Verify "send code"
CodeVerifyPage → verifyPhoneOtp()
   → edge fn  phone-otp-verify  → Twilio Verify "check code" → creates session
```

Twilio is reached through the **Lovable connector gateway**, authenticated with
`LOVABLE_API_KEY` + the Twilio connection key. So three things must be true:

---

## Part A — Twilio Verify (≈5 min)
1. **console.twilio.com** → confirm the account is **Upgraded** (trial only texts
   pre-verified numbers — real users fail silently).
2. **Verify → Services → Create** → name `Colors of Glory Auth` → copy the
   **Service SID** (`VA…`). This is `TWILIO_VERIFY_SERVICE_SID`.
3. Make sure the Twilio connection used by Lovable has a valid **API key/secret**
   (this is what `TWILIO_API_KEY` references in the connector).
4. (Recommended) enable **Fraud Guard** on the Verify service + a Twilio **billing
   alert** (~500/day, matching our daily ceiling).

## Part B — Lovable / Supabase secrets + deploy (≈5 min)
Set these as **Edge Function secrets** on the project (Supabase → Edge Functions →
Secrets, or via the Lovable connector UI):
- **`LOVABLE_API_KEY`** — the Lovable connector gateway key.
- **`TWILIO_API_KEY`** — the Twilio connection key for the gateway.
- **`TWILIO_VERIFY_SERVICE_SID`** — the `VA…` from Part A.
- **`OTP_IP_SALT`** — any random hex (`openssl rand -hex 16`) for the fraud-guard IP hashing.

Then **deploy the two functions** (already in the repo + `config.toml`):
```bash
supabase functions deploy phone-otp-start
supabase functions deploy phone-otp-verify
```
*(Lovable may deploy these automatically on connect — confirm they show as deployed.)*

## Part C — Confirm the DEPLOY BRANCH (important)
The frictionless frontend (single-field autofill, honest errors, etc.) lives on
**`main`**. If your preview/production deploys from a different branch, you'll be
running older code. **Confirm the deploy is built from `main`** (Lovable/Vercel
dashboard → Git branch).

---

## Part D — Verify it works (≈2 min)
1. App → phone login → real US mobile → **Continue**.
2. Code arrives in a few seconds; on the phone it **auto-fills** and signs you in.
3. If it fails:
   - *"We couldn't send the code"* → a secret is missing or `phone-otp-start` isn't
     deployed (the function returns `PROVIDER_ERROR` when `LOVABLE_API_KEY` /
     `TWILIO_API_KEY` / `TWILIO_VERIFY_SERVICE_SID` are unset). Re-check Part B.
   - *"…not available in your region"* → the number's country isn't in the geo
     allowlist (`check_and_record_otp_send`). Widen it for the countries you serve.
   - Check **Twilio → Verify → Logs** and the **edge function logs** for the attempt.

---

## What's already done (no action needed)
Frontend: honest errors + email fallback, single-field OTP with iOS/Android autofill
+ WebOTP + auto-submit + desktop paste, resend confirmation, instant retry, forgiving
phone entry, number pre-fill, full screen-reader a11y (verified by
`src/test/cog-phone-otp-input.test.tsx`, 5/5 green). Edge functions
`phone-otp-start` / `phone-otp-verify` are written and registered in `config.toml`.
**The only remaining steps are Parts A–C above — all dashboard/secrets, no code.**

*Background: `docs/auth/PHONE-OTP-FRICTIONLESS.md`.*
