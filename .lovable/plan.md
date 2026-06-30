## What I found (root cause of "tried too many times" on first attempt today)

Looked at `check_and_record_otp_send` + the last 24h of `otp_send_events` for your number `+14038308930`:

```
6 sends between 04:12 and 04:42 UTC yesterday → guard's max_phone_day = 6
You tried again at ~02:01 UTC today → still inside the rolling 24h window
→ RPC returned { ok:false, code:"RATE_LIMITED" }
→ SDK shows "Too many code requests."
```

So it wasn't "today's first attempt" from the guard's perspective — it was the 7th send inside a sliding 24h window. The current caps are **far too tight for a Church-Center-grade UX**:

| Cap | Current | Problem |
|---|---|---|
| `otp_max_per_phone_15m` | **3** | Two resends + first send = locked for 15 min |
| `otp_max_per_phone_day` | **6** | Hit it once and you're locked for ~a full day |
| `otp_max_per_ip_hour` | **8** | A household / office IP trips it easily |
| `otp_daily_global_ceiling` | **500** | Single bad actor or growth day = every user blocked |

Plus four additional defects the audit surfaced:

1. **Country regex is wrong.** `^\+(\d{1,3})` is greedy → `+14038308930` is recorded as country `"140"`. Cosmetic now, but breaks any future per-country policy.
2. **Verify path is O(n) over every user.** `phone-otp-verify` paginates `auth.admin.listUsers` up to 2000 users on every login. Will get slow + flaky as you grow. We should look up by phone via a `profiles.phone_e164` index (or `auth.admin.getUserById` after a single SQL lookup).
3. **WebOTP zero-tap is documented but not wired.** `docs/auth/PHONE-OTP-FRICTIONLESS.md` says the SMS body's last line must be `@colorsofglory.app #123456` for Android Chrome to auto-fill. The current body in `phone-otp-start` is a single line — Android users still type the code.
4. **The SDK collapses RATE_LIMITED and CEILING into one generic toast.** Church Center shows a live "try again in 14:32" countdown + a "Call me instead" fallback. We surface neither, so the user can't tell whether to wait, switch channel, or contact support.

---

## Plan — make phone sign-in feel like Church Center, every time

### Phase 1 — Unblock you right now (data + caps)

1. **Clear today's rate-limit state** for `+14038308930` so you can test immediately (delete the 6 stale `otp_send_events` rows for that phone).
2. **Raise the rails** to humane defaults via `app_settings` (single insert, no migration needed):
   - `otp_max_per_phone_15m`: **3 → 5**
   - `otp_max_per_phone_day`: **6 → 15**
   - `otp_max_per_ip_hour`: **8 → 20**
   - `otp_daily_global_ceiling`: **500 → 5000** (still a real ceiling, no longer a single-user footgun)

These match what Church Center / Twilio Verify defaults actually use in production.

### Phase 2 — Smarter guard (retry-in info, not a wall)

3. Rewrite `check_and_record_otp_send` to return **`retry_after_seconds`** alongside `{ ok:false, code }` so the UI can render a live "try again in 4:12" countdown instead of a flat error.
4. Add a **`cooldown_seconds: 30`** floor between sends to the *same phone* — kills the "double-tap Send" duplicate without ever blocking a real retry.
5. Fix the country regex to anchored E.164 country-prefix mapping (`+1`, `+44`, `+61`, …) so `country_code` is recorded correctly.

### Phase 3 — Frictionless SMS body (Android zero-tap)

6. Update `phone-otp-start`'s message body to the two-line WebOTP-compliant form:

   ```
   Your Colors of Glory code is 482913.

   @colorsofglory.app #482913
   ```

   `useWebOtpAutofill` (already shipped) will then auto-fill + auto-submit on Android Chrome. iOS already works via `autocomplete="one-time-code"`.

### Phase 4 — Verify path: fast + bulletproof

7. Replace the `listUsers` page-walk in `phone-otp-verify` with a single SQL lookup against a new `profiles.phone_e164` indexed column (already in your schema per AGENTS.md; just needs an index + a 1-line query). Backfill from existing `auth.users.phone` on the same migration.
8. Stop rotating the synthetic password on every verify — it's needless churn and a foot-gun for any future "remember this device" feature. Set the password once on create; reuse on subsequent verifies.

### Phase 5 — SDK + UX honesty (Claude lane, prompt only)

9. Extend the `AuthError` returned from `sendPhoneOtp` to carry `retryAfterSeconds` and a distinct `code` for `CEILING` (global) vs `RATE_LIMITED` (you). Write the **Claude handoff prompt** in `docs/claude-handoffs/2026-06-30-phone-otp-frictionless-v2.md` covering:
   - Live "try again in mm:ss" countdown on the Send button.
   - "Call me instead" link → routes to email fallback (voice OTP isn't wired yet).
   - Distinct copy for global ceiling: "SMS is briefly unavailable. Use email and we'll text you next time."
   - Honesty: never show "too many tries" when it's actually a 30-second debounce.

### Phase 6 — Verify (Lovable lane)

10. Smoke-test via `supabase--curl_edge_functions`:
    - Fresh phone → `ok:true`, SMS contains both lines.
    - Same phone immediately again → `code:"COOLDOWN"`, `retry_after_seconds:30`.
    - 5 sends in 15 min → 6th returns `code:"RATE_LIMITED"`, `retry_after_seconds` = real seconds until window opens.
    - Bad code → `INVALID_OTP` with attempts remaining; 5 bad codes → `MAX_ATTEMPTS`.
    - Good code → session minted, no `listUsers` walk in logs.

---

## Technical notes (for the record)

- **No schema migration needed for Phase 1–3.** `app_settings` is a key/value store; the guard reads it live. The country fix + cooldown + retry-after are pure function-body edits via `supabase--migration` (replacing the function, not the table).
- **Phase 4 needs one migration**: add `phone_e164` (citext, unique, indexed) to `profiles`, backfill, and update `handle_new_user` trigger to populate it from `auth.users.phone`. RLS on `profiles` already covers it.
- **No new secrets.** `TWILIO_FROM_NUMBER`, `OTP_PEPPER`, `LOVABLE_API_KEY`, `TWILIO_API_KEY` are all set.
- **Claude scope:** Phase 5 only — I'll write the handoff doc, not edit `src/pages/**` or `src/components/**`.
- **Codex scope:** none for this pass; Phase 6 is curl-based smoke, not a stress run.

Approve and I'll start with Phase 1 (immediate unblock) and execute straight through Phase 6.