# Make Twilio SMS OTP work on mobile

## What's actually broken

Right now, tapping "Continue" on `/auth/login` sends a request to Supabase Auth's `/otp` endpoint and gets back:

```
400 { "code": "phone_provider_disabled", "message": "Unsupported phone provider" }
```

This is **not a code bug**. The backend (Lovable Cloud / Supabase Auth) has no SMS provider configured, so it refuses to send the code. No amount of frontend work will fix this — the provider has to be turned on in the Auth dashboard.

The fix is a one-time backend configuration + a couple of small code hardenings so the experience is solid on real phones.

---

## Plan

### 1. Turn on Twilio as the SMS provider (you do this, ~5 min)

In Lovable Cloud → Auth → Phone provider, enable **Twilio** and paste in:

- Twilio Account SID
- Twilio Auth Token (or API Key SID + Secret)
- Twilio Messaging Service SID *(recommended)* or a single Twilio "From" number in E.164 format (e.g. `+15551234567`)

You'll need a Twilio account with:
- A verified sender (Messaging Service or a purchased number with SMS capability)
- For Canadian/US destinations: **A2P 10DLC registration** completed, OR a Toll-Free number that's been verified. Without this, carriers silently drop SMS to US/CA mobiles — the API returns 200 but the phone never rings.

I'll walk you through where to click once you say go.

### 2. Add Twilio test credentials for the stress harness (optional but smart)

`docs/codex-stress/README.md` already expects "Test OTP" entries (`+15555550100`–`+15555550119` → `123456`) so Codex can load-test without burning real SMS. We'll add those in the same Auth panel under **Test OTP**.

### 3. Lock down SMS abuse before going live

Twilio's two cheap protections, both toggled in the Twilio console (I'll point to them):

- **SMS Pumping Protection** — blocks the fraud pattern where attackers spam OTP sends to premium-rate numbers they own.
- **SMS Geo Permissions** — restrict to US + CA only (you can add more countries later). Default is "everywhere," which is how people wake up to $4k bills.

### 4. Frontend hardening (small, mobile-only polish)

Touch only `src/pages/auth/PhoneLoginPage.tsx` and `CodeVerifyPage.tsx`:

- **Better error mapping.** Right now `phone_provider_disabled`, `sms_send_failed`, and `over_sms_send_rate_limit` all collapse to "We could not send the code." Map them to honest messages so future regressions surface fast.
- **Disable the Continue button while in flight** (already done) + add a 30s client-side cooldown on resend (already done in `CodeVerifyPage`, mirror it on `PhoneLoginPage` so the user can't double-tap and trip per-phone rate limits).
- **`autoComplete="one-time-code"` + `inputMode="numeric"`** on the OTP boxes so iOS Safari and Android Chrome auto-fill the code from the SMS notification — this is the single biggest mobile UX win and `OTPInput.tsx` likely doesn't set it yet. I'll verify and patch.
- **E.164 sanity check** before submit. Today we hardcode `+1` and 10 digits, which is fine for US/CA only. We'll keep that but reject obviously bad inputs (all zeros, repeating digits) before spending a Twilio send.

### 5. Verify end-to-end on a real phone

After Twilio is live:

1. Load the preview on an actual mobile device (not just the desktop preview).
2. Enter your real number → tap Continue → confirm SMS arrives within ~10s.
3. iOS: confirm the code suggestion bar appears above the keyboard. Android: confirm SMS Retriever/autofill fills the boxes.
4. Try a wrong code → friendly error, boxes clear.
5. Wait 30s → Resend works.
6. Sign out, sign back in → existing-user path works.

If anything fails, I'll read `supabase--edge_function_logs` for the `auth` service and the Twilio Messaging logs side-by-side to diagnose.

### 6. Codex stress pass (optional, after #5 passes)

Hand off to Codex to run `scripts/stress/otp-send.ts --mode=test-numbers --rps=5 --duration=30` to confirm p95 latency and that rate limits return structured JSON, not HTML.

---

## What I need from you to start

1. **Confirm you have a Twilio account** (or want me to walk you through creating one — ~10 min including A2P).
2. **Pick the sender:** Messaging Service SID (recommended, better deliverability + pumping protection) vs. single Twilio number.
3. **Confirm launch geography** — US + CA only, or also international? This decides whether we need additional A2P/regulatory work.

Once you answer those three, I'll switch to build mode and:
- Guide you through the Auth panel paste-in
- Patch `PhoneLoginPage.tsx`, `CodeVerifyPage.tsx`, and `OTPInput.tsx` for the mobile polish
- Verify on the preview together
