# Phone Sign-In (Twilio OTP) — Frictionless UX + Enablement Runbook

> Lane: **Frontend (Claude)** owns the screens + SDK error UX in this doc.
> **Backend (Lovable)** owns the Supabase Auth provider toggle + Twilio credentials + SMS template.
> This doc is the single source of truth for *why* the flow is built the way it is and
> *exactly* what backend has to flip for SMS to actually send.

---

## 1. The flow (what's already wired, frontend)

```
/auth/login  PhoneLoginPage
   → sendPhoneOtp(e164)                       src/integrations/cog/auth.ts
        → otp-guard edge fn (fraud rails)      geo allowlist + velocity caps + daily ceiling, FAILS OPEN
        → supabase.auth.signInWithOtp({phone}) Supabase → Twilio Verify → SMS
   → /auth/phone/verify  CodeVerifyPage
        → WebOTP auto-read (progressive)        useWebOtpAutofill — auto-fills + submits
        → verifyPhoneOtp(e164, code)            supabase.auth.verifyOtp({type:'sms'})
        → routeAfterAuth()                       invite / onboarding / home
```

Phone entry → code entry is two calm screens (Church Center pattern). No password, ever.

---

## 2. Why it said "SMS sign-in isn't available yet" — and the fix

The classifier in `auth.ts` / `PhoneLoginPage.tsx` matched `msg.includes("provider")` — a
catch so broad that *almost any* auth error (and several unrelated ones) dead-ended the user
on "contact support." That masked the real cause and looked like a hard outage.

**Fixed (frontend):** the provider-disabled branch now matches only the real signal
(`code === "phone_provider_disabled"` or the specific Supabase strings), and the message
routes the user to the email fallback instead of a dead end. Every other failure now surfaces
its true, actionable reason.

**If it still reports provider-disabled after this**, the cause is genuinely backend — see §3.

---

## 3. Backend enablement (Supabase dashboard — Lovable lane)

SMS will not send until **all** of these are true in the hosted project
(`vsiecltcxsuuulbczexl`). None of this lives in repo `config.toml`; it's dashboard-only.

1. **Auth → Providers → Phone**: toggled **ON**.
2. **SMS provider: Twilio** (use **Twilio Verify**, not generic Messaging):
   - Twilio **Account SID**
   - Twilio **Auth Token**
   - Twilio **Verify Service SID**
3. **Auth → Providers → Phone → "Allow new users to sign up"**: ON
   (passwordless OTP signs up first-time numbers; if off, returns "Signups not allowed for otp").
4. **OTP expiry**: raise from the 60s default to **≥ 300s** — 60s causes avoidable
   "code expired" failures on slow carriers. (Auth → Providers → Phone → OTP Expiry.)
5. **CAPTCHA + rate limits**: keep enabled (toll-fraud floor; our `otp-guard` is the
   app-level layer *on top*, and fails open by design).
6. **Twilio Verify geo permissions**: allow the countries you actually serve (US first).
7. **A2P 10DLC**: register the brand/campaign for reliable US deliverability.

### Optional but high-value: WebOTP auto-read
For the code to auto-fill with **zero typing** on Android Chrome, the SMS body's **last line**
must be exactly:

```
@colorsofglory.app #123456
```

(`@<domain>` then `#<code>`). Twilio Verify supports a custom template / `AppHash`. Once the
template includes this line, `useWebOtpAutofill` (already shipped, frontend) auto-fills and
submits. Until then it silently no-ops — `autocomplete="one-time-code"` still gives iOS the
keyboard-suggestion autofill with no template change.

---

## 4. Frictionless decisions (the UX argument)

Benchmarks: Church Center (behavioral floor) × Apple HIG × Temu's friction-removal psychology.

| Decision | Why |
|---|---|
| One tap to send, code auto-submits on the 6th digit | Removes the "press the button again" tax — completion is the default, not an action. |
| WebOTP auto-read + `one-time-code` autofill | The lowest-friction path is *no typing at all*. Code arrives → it's already in. |
| Paste fills all 6 boxes + submits | Copy-from-Messages is one gesture, not six. |
| Phone field autofocuses + `tel` keypad + `tel-national` autofill | Thumb is already on the numbers; the OS offers the user's own number. |
| Email fallback always visible, and provider-disabled routes *to* it | No dead ends. A blocked path always has an open one beside it. |
| Resend disabled with a live `30s` countdown, then one tap | Sets the expectation (reduces "it's broken" anxiety) without inviting toll-fraud spam. |
| Wrong code clears + refocuses box 1 instantly | Recovery is instant; the user never hunts for where to retry. |
| Masked number echoed on the verify screen | "Yes, that's my phone" — confidence before the wait. |
| Honest, specific errors (not "contact support") | Trust. The user can self-serve every failure. |
| Calm copy, gold accents, no red badge spam | Faith-context sanctuary tone, not a security checkpoint. |

---

## 5. Sources

- Supabase Phone Login — https://supabase.com/docs/guides/auth/phone-login
- signInWithOtp — https://supabase.com/docs/reference/javascript/auth-signinwithotp
- WebOTP API (MDN) — https://developer.mozilla.org/en-US/docs/Web/API/WebOTP_API
- WebOTP on Chrome — https://developer.chrome.com/docs/identity/cross-device-webotp
