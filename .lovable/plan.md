# Custom Phone OTP via Twilio (Bypass Supabase Phone Provider)

## Why
Supabase's phone provider isn't configurable on Lovable Cloud, so `supabase.auth.signInWithOtp({ phone })` returns `phone_provider_disabled`. We'll implement the OTP flow ourselves using the existing Twilio connector and sign the user in by minting a magic-link token with the service role.

## Architecture

```text
[Phone page] --sendPhoneOtp(e164)--> [send-otp edge fn]
                                       ├─ rate-limit check (phone_otps)
                                       ├─ generate 6-digit code
                                       ├─ insert sha256(code) row, expires_at = now()+10m
                                       └─ Twilio gateway: POST /Messages.json
[Phone page] --verifyPhoneOtp(e164,code)--> [verify-otp edge fn]
                                       ├─ find latest unused row for phone
                                       ├─ check expiry, attempts < 5, hash match
                                       ├─ mark consumed
                                       ├─ upsert profiles.phone_e164
                                       ├─ find/create auth user (service role; phone-only synthetic email)
                                       └─ generateLink('magiclink') → return action_link
[Phone page] window.location = action_link  // Supabase verifies, sets session
```

Using a magic-link `verifyOtp` token returned to the client (no email actually sent) is the cleanest way to mint a real session on Lovable Cloud without exposing the service role.

## Backend changes

### 1. Migration: `phone_otps` table
- Columns: `id uuid pk`, `phone_e164 text not null`, `code_hash text not null`, `expires_at timestamptz not null`, `attempts int not null default 0`, `consumed_at timestamptz`, `created_at timestamptz default now()`, `ip text`, `last_sent_at timestamptz default now()`.
- Indexes: `(phone_e164, created_at desc)`.
- GRANTs: `service_role` only (no anon/authenticated). RLS enabled; no policies (edge functions use service role).
- Helper RPC (optional): none — edge functions use service-role client directly.
- Also: ensure `profiles.phone_e164` has a unique index (already a column).

### 2. Edge function `send-otp` (`verify_jwt = false`, public)
- Input: `{ phone: string }` (E.164, validated with zod).
- Rate limits:
  - Per phone: max 1 send / 30s, max 5 / hour (count rows in last hour).
  - Returns 429 with friendly message.
- Generate code `crypto.getRandomValues` → 6 digits, hash with SHA-256 + per-row salt (use code+phone+pepper from secret).
- Insert row.
- Send via Twilio gateway `POST {GATEWAY}/twilio/Messages.json` with `From` = `TWILIO_FROM_NUMBER` secret, `Body` = `Your Colors of Glory code is 123456. It expires in 10 minutes.`
- Response: `{ ok: true }`. Never echo the code.

### 3. Edge function `verify-otp` (`verify_jwt = false`, public)
- Input: `{ phone, code }`.
- Fetch latest unconsumed row for phone; if none → 400 invalid.
- If `expires_at < now()` → 400 expired.
- Increment attempts; if `attempts > 5` after increment → 400, lock row by marking consumed.
- Compare sha256(code+phone+pepper) to `code_hash`; on mismatch → 400.
- On success: mark `consumed_at = now()`.
- Look up user by phone:
  - Query `profiles` where `phone_e164 = phone` → get `user_id`, else
  - Use admin API `auth.admin.listUsers` (filter by email synthesis) — instead, simpler: store a `phone_users` mapping... actually use `auth.admin.createUser({ phone, phone_confirm: true })` and trap `phone_exists` → then `listUsers` to find existing. Cleaner: use synthetic email `phone+<e164digits>@cog.local` and `createUser({ email, email_confirm: true, user_metadata: { phone_e164 } })`; on conflict fetch by email. Persist `phone_e164` to `profiles` via `handle_new_user` trigger update.
- Mint session: `supabase.auth.admin.generateLink({ type: 'magiclink', email })` → returns `properties.action_link` (contains `token_hash` + `type=magiclink`).
- Response: `{ action_link }`.

### 4. Secrets needed
- `TWILIO_FROM_NUMBER` (E.164 of the verified Twilio sender, or Messaging Service SID via `MessagingServiceSid`).
- `OTP_PEPPER` (random 32+ char string for hashing).
- Existing: `LOVABLE_API_KEY`, `TWILIO_API_KEY` (from connector).

## Frontend SDK changes (`src/integrations/cog/auth.ts`)
- Rewrite `sendPhoneOtp` to call `supabase.functions.invoke('send-otp', { body: { phone } })`.
- Rewrite `verifyPhoneOtp` to call `supabase.functions.invoke('verify-otp', { body: { phone, code } })`, then `window.location.assign(action_link)` so Supabase's `/auth/v1/verify` redirect lands the user back with a real session. The existing `onAuthStateChange` listener picks it up.
- Update `classify()` to map new HTTP error codes (`rate_limited`, `expired`, `invalid_code`, `twilio_failed`).
- Return type of `verifyPhoneOtp` becomes `Promise<void>` (since redirect happens). UI side will need to await + show "Signing you in…" until redirect.

## Out of scope (Claude/UI work — not this task)
- Any visual changes to `/auth/phone`. Only the SDK signature note above; if the page reads the return value, Claude updates it. Lovable does not edit `src/pages/**`.

## Technical details

- Twilio call (Deno):
  ```ts
  const body = new URLSearchParams({ To: phone, From: FROM, Body: `Your Colors of Glory code is ${code}. Expires in 10 min.` });
  await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      'X-Connection-Api-Key': Deno.env.get('TWILIO_API_KEY')!,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  ```
- Hash: `hex(sha256(code + ':' + phone + ':' + OTP_PEPPER))`.
- Service-role client built from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (auto-injected in edge functions).
- Synthetic email pattern keeps `profiles` clean and lets `generateLink('magiclink')` work without sending an email (we never call `inviteUser`, we just consume the `action_link` client-side).

## Build order
1. Add secrets: `TWILIO_FROM_NUMBER`, `OTP_PEPPER`.
2. Migration: `phone_otps` table.
3. Edge function `send-otp`.
4. Edge function `verify-otp`.
5. Update `src/integrations/cog/auth.ts` SDK.
6. Test end-to-end with real phone via preview.

After approval I'll request the two secrets first, then proceed.
