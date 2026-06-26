# ✅ Turn On SMS Sign-In — 15-Minute Owner Action Sheet

**Who does this:** whoever holds the **Supabase** and **Twilio** logins. No coding.
**Why:** the app already has the full, frictionless phone sign-in built. It says
*"SMS sign-in isn't available yet"* for ONE reason — Supabase is returning
`phone_provider_disabled`, i.e. **the Phone provider is switched OFF in the Supabase
dashboard.** "Twilio is hooked in" means a Twilio *account* exists; it is **not yet
connected to Supabase Auth.** Flip the switch below and sign-in works instantly —
nothing else to change in the code.

---

## Part A — Twilio (get 3 values + 1 safety setting) ~6 min

1. Sign in at **console.twilio.com**.
2. **Upgrade the account if it still says "Trial."**
   Top of the console → **Upgrade**. ⚠️ A trial account can only text phone numbers
   you've manually verified — real users get **silent failures**. This step is not optional.
3. On the **console home page**, copy two values from the "Account Info" panel:
   - **Account SID** (starts with `AC…`)
   - **Auth Token** (click to reveal, starts with a long random string)
4. Create a **Verify Service**:
   - Left menu → **Explore Products → Verify → Services** (or go to
     **verify.twilio.com → Services**).
   - **Create new** → Friendly name: `Colors of Glory Auth` → **Create**.
   - On the service page, copy the **Service SID** (starts with `VA…`).
5. (Recommended) On that Verify service, turn on **Fraud Guard**, and set a Twilio
   **billing alert** around **500/day** so a spike can't surprise-bill you.

> You now have: **Account SID (AC…)**, **Auth Token**, **Verify Service SID (VA…)**.

---

## Part B — Supabase (connect Twilio + turn Phone on) ~5 min

1. Sign in at **supabase.com/dashboard** → open the **Colors of Glory** project
   (project id `vsiecltcxsuuulbczexl`).
2. Left menu → **Authentication → Providers** (also called "Sign In / Providers").
3. Click **Phone** → toggle **Enable Phone provider = ON**.
4. **SMS provider** dropdown → choose **Twilio Verify** (NOT plain "Twilio").
5. Paste the three values from Part A:
   - **Account SID** → `AC…`
   - **Auth Token** → (the revealed token)
   - **Verify Service SID** → `VA…`
6. Set **OTP length = 6** and **OTP expiry = 600** (seconds). *(60s is the default and
   is too short — it causes "code expired" errors on slow carriers.)*
7. Click **Save**.

---

## Part C — Anti-abuse floor (so attackers can't run up your bill) ~3 min

Still in **Authentication**, open **Rate Limits / Attack Protection**:

1. **Allowed Countries / SMS region**: restrict to **United States (+1)** for now.
2. **Provider SMS rate limit**: start conservative (e.g. **≤ 30 / hour**).
3. **CAPTCHA**: safe to enable — the app is already wired to send a CAPTCHA token.
   *(If you turn it on, tell the app team so they switch on the invisible widget; the
   plumbing already exists in `sendPhoneOtp`.)*

---

## Part D — Confirm it works ~1 min

1. Open the app → **phone login** → enter a **real US mobile number** → **Continue**.
2. A 6-digit code should arrive in **under ~5 seconds**.
3. On the phone it **auto-fills** (iOS QuickType / Android) and signs you in.
4. Request a code **4× fast** → you should see a kind *"Too many attempts"* message,
   not a raw error. ✅ Done.

**If a code still doesn't arrive**, check, in order: Twilio account is **upgraded**
(Part A.2) · the test number's **country is allowed** (Part C.1) · Twilio **Verify logs**
(verify.twilio.com → your service → Logs) show the attempt.

---

## What's already done (no action needed)
The entire frontend is built and verified: honest errors with an email fallback,
single-field code entry with iOS/Android autofill + WebOTP one-tap + auto-submit,
resend confirmation, instant retry, forgiving phone entry, CAPTCHA-readiness, and
number pre-fill. The toll-fraud guard edge function is live. **This sheet is the only
remaining step.**

*Deeper background: `docs/auth/PHONE-OTP-FRICTIONLESS.md` and
`docs/claude-handoffs/2026-06-23-twilio-sms-signin-enable-and-ux.md`.*
