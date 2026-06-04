
# Phase A — Twilio phone OTP + founder-code redemption

Backend-only. No frontend files touched. Wires the first real entry door of the onboarding state machine: phone login → (optional) founder code → `intent_selected` already works.

## 1. Twilio connector

- Link the **Twilio** app connector via `standard_connectors--connect`. Gateway-backed; injects `TWILIO_API_KEY` (gateway connection key, not the raw Twilio auth token) into edge functions. Account SID is auto-prefixed by the gateway.
- Use Twilio **Verify** (not raw `/Messages.json`) so we don't manage code generation / expiry / brute-force protection ourselves. Verify lives at `/v2/Services/{ServiceSid}/Verifications` and `/VerificationCheck` — the gateway path will need the full Verify path (not the auto-prefixed `/2010-04-01/Accounts/...`).
  - If the gateway only auto-prefixes the Messaging API, fall back to calling `Messages.json` ourselves with a generated 6-digit code stored hashed in `otp_attempts`. Decide at implementation time after a `verify_credentials` probe.
- Ask the user to also add one secret: `TWILIO_VERIFY_SERVICE_SID` (required for Verify; created once in Twilio console). Phone numbers / messaging service config live inside that Verify service — no extra secret needed for `From`.
- Recommend SMS Pumping Protection + Geo Permissions in Twilio console (mention to user, don't enforce in code).

## 2. Schema (one migration)

### `otp_attempts` (rate limit + abuse log)
- `id uuid pk`, `phone_e164 text`, `ip inet`, `kind text check in ('start','verify')`, `success bool`, `error_code text`, `created_at timestamptz default now()`
- Index `(phone_e164, created_at desc)` and `(ip, created_at desc)`.
- GRANT to `service_role` only (no `anon`/`authenticated` direct access). RLS ON, no policies = locked.

### `founder_codes` (catalog)
- `code text pk` (case-insensitive via `citext` or upper() check)
- `label text`, `max_uses int not null`, `uses int not null default 0`, `expires_at timestamptz`, `perks jsonb not null default '{}'::jsonb` (free-form, e.g. `{ "storage_bonus_mb": 500, "plan_tier": "founder" }`), `active bool not null default true`, `created_at`, `created_by uuid`
- GRANT to `service_role` only.

### `founder_redemptions`
- `user_id uuid pk references profiles(user_id) on delete cascade` (one-per-user)
- `code text not null references founder_codes(code)`, `redeemed_at timestamptz default now()`, `perks_snapshot jsonb not null`
- GRANT to `service_role` only.

### Helper function
- `public.redeem_founder_code(_user_id uuid, _code text) returns jsonb` — SECURITY DEFINER:
  1. `select ... for update` the code row; validate active, not expired, uses < max_uses.
  2. Insert `founder_redemptions` (unique violation → return `{ ok:false, code:'ALREADY_REDEEMED' }`).
  3. Increment `founder_codes.uses`.
  4. Call `advance_onboarding(_user_id, 'founder_code_seen', jsonb_build_object('founder_code_redeemed', true, 'code', _code), 'user:redeem-founder-code')` and swallow non-OK results into the response payload.
  5. Optionally apply perks: bump `profiles.plan_tier` if perks contain it; add to a storage bonus column if present (defer real perk wiring — just store snapshot for now).
  6. Return `{ ok:true, perks, onboarding_step }`.

## 3. Edge functions

### `phone-otp-start` (`verify_jwt = false`, validate in code)
- POST `{ phone_e164 }`. Zod validate E.164 (`^\+[1-9]\d{6,14}$`).
- Rate limit (server-side): reject if `otp_attempts` has ≥ 5 `start` rows for this phone in the last hour, or ≥ 20 from the same IP. Return `{ ok:false, code:'RATE_LIMITED', retry_after }`.
- POST to Twilio Verify via gateway: `POST /v2/Services/{TWILIO_VERIFY_SERVICE_SID}/Verifications` body `To=...&Channel=sms`.
- Log to `otp_attempts(kind='start', success, error_code)`.
- Return `{ ok:true }` (never reveal whether the number exists).

### `phone-otp-verify` (`verify_jwt = false`)
- POST `{ phone_e164, code }`. Zod validate, code length 6 digits.
- Rate limit verify attempts (≥ 8 in 10 min per phone → `RATE_LIMITED`).
- POST to Twilio Verify `VerificationCheck`. On non-`approved` → log + return `{ ok:false, code:'INVALID_CODE' }`.
- On approved:
  - Admin client (`SUPABASE_SERVICE_ROLE_KEY`): look up `auth.users` by phone → if missing, `auth.admin.createUser({ phone, phone_confirm: true })`.
  - Mirror phone onto `profiles.phone_e164` (add column in same migration; unique nullable).
  - Generate a session: use `supabase.auth.admin.generateLink({ type: 'magiclink', email: ... })` is email-only. For phone, the supported path is `signInWithOtp({ phone })` from the client — but we'd then need a second SMS. Cleanest workaround: have the client call `supabase.auth.signInWithOtp({ phone })` directly AFTER our function confirms eligibility, OR mint a custom JWT.
  - **Decision:** return `{ ok:true, user_id, access_token, refresh_token }` by calling `auth.admin.createSession`-equivalent via `generateLink({ type: 'magiclink' })` against a synthetic email is brittle. Instead, expose `{ ok:true }` and let the frontend call `supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })` against Supabase's native phone auth — which requires Supabase project-level Twilio config.
  - **Final decision in this plan:** go with the **Supabase-native phone auth path** for session minting:
    - Configure Supabase phone provider with the same Twilio credentials (manual step the user does in Lovable Cloud → Users → Auth Settings → Phone, since `configure_auth` doesn't expose phone provider fields).
    - Our `phone-otp-start` / `phone-otp-verify` become **rate-limit + abuse-log middleware** in front of `signInWithOtp` / `verifyOtp`. After `phone-otp-start` returns ok, frontend calls `supabase.auth.signInWithOtp({ phone })` (which sends the SMS via Supabase's Twilio). Our `verify` function is unused in v1 — drop it. Skip the duplicate SMS by removing our Twilio Verify call and just doing the rate-limit insert.
  - **Even simpler — what we'll actually ship in v1:**
    1. **Skip custom OTP edge functions entirely.** Use Supabase native phone auth + Twilio at the project level.
    2. Ship only `redeem-founder-code` + the schema + ask user to configure Twilio in Lovable Cloud auth settings.
    3. Defer the abuse-log table until we see real traffic.

### `redeem-founder-code` (`verify_jwt = false`, validate in code)
- POST `{ code }`. Zod: `code` 4–32 chars `[A-Z0-9-]`. Uppercase server-side.
- Auth: extract bearer JWT, validate with anon client `auth.getUser()`. 401 if missing/invalid.
- Call `public.redeem_founder_code(user_id, code)`.
- Map result envelope:
  - `OK` → 200 `{ ok:true, perks, onboarding_step, next_suggested_route:'/onboarding/start-song' }`
  - `INVALID_CODE | CODE_EXPIRED | CODE_EXHAUSTED | ALREADY_REDEEMED` → 200 `{ ok:false, code, current_step }`.

## 4. What the user has to do manually

1. **Connect Twilio** (I'll trigger the connector picker).
2. **Add secret `TWILIO_VERIFY_SERVICE_SID`** (only if we end up keeping our own Verify path — likely deferred per the simplification above).
3. **Enable Supabase phone provider** in Lovable Cloud → Users → Auth Settings → Phone, paste Twilio account SID + auth token + messaging service SID. (One-time, ~2 min.)
4. **(Optional)** Enable SMS Pumping Protection + Geo Permissions in Twilio console.

## 5. Scope cut for v1 (explicit)

- ✅ `founder_codes` + `founder_redemptions` tables + `redeem_founder_code` fn + `redeem-founder-code` edge function.
- ✅ `profiles.phone_e164` column (nullable, unique) + sync trigger from `auth.users.phone` on insert/update.
- ⏸️ `otp_attempts` table + custom rate-limit edge functions — deferred until Supabase native phone auth is live and we measure abuse. Supabase already rate-limits phone OTP per project.
- ⏸️ Perk application (storage bonus, plan_tier bump) — stored in `perks_snapshot` but not yet applied to live limits. Wire in Phase D (storage quotas).

## 6. Smoke tests

- `curl_edge_functions redeem-founder-code` with no bearer → 401.
- Insert one test code via SQL (`SEED-FOUNDER-1`, max_uses=3), redeem it → expect `ok:true`, `onboarding_step='founder_code_seen'`.
- Redeem again with same user → `ALREADY_REDEEMED`.
- Manually phone-login from preview (after Supabase phone provider is configured by user) → verify a `profiles` row gets `phone_e164` populated.

## 7. Execution order

```text
1. standard_connectors--connect (Twilio)  — user picks connection
2. Migration: phone_e164 column + sync trigger, founder_codes, founder_redemptions, redeem_founder_code()
3. Edge function: redeem-founder-code
4. Tell user: enable Supabase phone provider in Cloud auth settings, paste Twilio creds
5. Seed one test founder code, smoke-test
```
