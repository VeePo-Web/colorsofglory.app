# Create `.lovable/otp-prompts.md` — 10 In-Depth Build Prompts

Single new file. Each section is a self-contained, copy-pasteable prompt sized for one focused build pass (Lovable or Codex). Every prompt includes: **Goal · Inputs · Deliverables · Acceptance criteria · Edge cases · Out of scope**. Below is a faithful preview of what the file will contain — condensed here, fully expanded in the actual file.

---

## File outline

### Header
Context block: product = Colors of Glory; auth = custom Twilio OTP bypassing Supabase phone provider; secrets already set (`TWILIO_API_KEY`, `LOVABLE_API_KEY`, `TWILIO_FROM_NUMBER`, `OTP_PEPPER`); gateway base `https://connector-gateway.lovable.dev/twilio`; never log codes; never grant anon on `phone_otps`.

### Prompt 1 — Secrets preflight
Verify all four secrets via `fetch_secrets`. Detect `MG…` prefix on `TWILIO_FROM_NUMBER` → branch later as `MessagingServiceSid`. Validate pepper length ≥ 32. No code output; produce a checklist.

### Prompt 2 — Migration `phone_otps`
Exact SQL: table, indexes `(phone_e164, created_at desc)` and `(expires_at)`, RLS ON, **only** `GRANT ALL ... TO service_role` (no anon/authenticated). `cleanup_phone_otps()` SECURITY DEFINER function. Constraints: `attempts <= 5`, `length(code_hash) = 64`. Acceptance: linter clean, `read_query` confirms grants.

### Prompt 3 — `send-otp` edge function
Full Deno scaffold: CORS, Zod E.164 validator, rate-limit query (1/30s, 5/h), `crypto.getRandomValues` 6-digit code, SHA-256 of `${pepper}:${e164}:${code}`, insert row with 10-min expiry, Twilio gateway POST (form-encoded), branch `From` vs `MessagingServiceSid`. Response shape `{ ok, cooldownSec }`. Error codes: `invalid_phone`, `cooldown`, `hourly_limit`, `twilio_failed`. Logs must redact code + phone last 4 only.

### Prompt 4 — `verify-otp` edge function
Fetch latest unconsumed row, expiry/attempts gate, constant-time hash compare, increment attempts on miss, mark `consumed_at` on hit. User upsert via synthetic email `phone+<digits>@cog.local` with `email_confirm: true` and `user_metadata.phone_e164`. `auth.admin.generateLink({ type: 'magiclink', email })` → return `{ action_link }`. Error codes: `invalid_code`, `expired`, `locked`, `not_found`.

### Prompt 5 — `handle_new_user` trigger update
Read `NEW.raw_user_meta_data->>'phone_e164'`, persist on `profiles.phone_e164`, fallback `display_name` = `"Friend "+ right(digits,4)`. Idempotent ON CONFLICT. Acceptance: insert via admin API creates profile row with phone.

### Prompt 6 — SDK rewrite `src/integrations/cog/auth.ts`
Replace `sendPhoneOtp` / `verifyPhoneOtp` with `functions.invoke` calls. `verifyPhoneOtp` returns `Promise<void>` and performs `window.location.assign(action_link)`. Extend `AuthErrorCode` union with `otp_cooldown | otp_invalid | otp_expired | otp_locked | otp_send_failed`. Update `classify()` mapping table. No UI edits.

### Prompt 7 — `PhoneLoginPage.tsx` wiring (Claude handoff)
Markdown handoff doc for Claude: list of new error codes, copy strings ("Too many attempts — try again in 10 minutes", cooldown countdown spec), redirect behavior, no visual redesign. Boundary: Claude owns layout/typography; Lovable owns error code contract.

### Prompt 8 — Happy-path E2E test
Step-by-step using `supabase--curl_edge_functions` + `read_query`: send → verify row exists with `code_hash` (never plaintext) → call verify → assert `action_link` shape `https://<ref>.supabase.co/auth/v1/verify?token=...&type=magiclink` → manual browser redirect → session present.

### Prompt 9 — Negative-path test matrix
Table of 8 scenarios with expected status + error code: wrong code ×5, expired (backdate via SQL), cooldown burst, invalid E.164, missing phone, replay consumed code, twilio 401, oversized body. Includes SQL snippets to backdate rows.

### Prompt 10 — Cleanup + abuse hardening
`pg_cron` job daily for `cleanup_phone_otps()`. `audit_logs` insert on send/verify (store SHA-256 of phone, never raw). Doc block instructing user to enable Twilio **SMS Pumping Protection** + **Geo Permissions** (US/CA only) before launch. Optional IP-based rate limit using `cf-connecting-ip` header.

---

## Acceptance for this plan
- File `.lovable/otp-prompts.md` created (~600–900 lines).
- Each prompt is independently runnable with no cross-references needed.
- No code is executed and no other files are modified.
