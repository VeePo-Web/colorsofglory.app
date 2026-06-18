# Colors of Glory — Custom Twilio OTP Auth: 10 Build Prompts

These prompts replace Supabase's phone provider with a custom OTP flow powered by the Twilio connector. Each prompt is self-contained — copy/paste one at a time into a Lovable (or Codex) build session. They are ordered; do not skip ahead.

## Shared context (paste at the top of any prompt if a fresh session lacks it)

> Product: **Colors of Glory** — a mobile-first songwriting app on Lovable Cloud (Supabase under the hood).
> Auth model: custom 6-digit SMS OTP that **bypasses Supabase's phone provider entirely**. Twilio is connected via the Lovable connector gateway (`https://connector-gateway.lovable.dev/twilio`). Verification returns a Supabase **magic link** that the browser follows to establish a session.
> Secrets already present (verify with `fetch_secrets`): `LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`, `OTP_PEPPER`.
> Hard rules:
> - Never log the 6-digit code, the full phone number, or the pepper.
> - Never grant `anon` or `authenticated` on `phone_otps` — service role only.
> - Never FK to `auth.users`. Use `user_id uuid` + `profiles`.
> - Lovable owns backend + the thin SDK at `src/integrations/cog/auth.ts`. Claude owns `src/pages/**` and `src/components/**` UI.

---

## Prompt 1 — Secrets preflight

**Goal:** Confirm all four secrets exist and are usable before any code is written. Detect whether `TWILIO_FROM_NUMBER` is a phone number (`+1…`) or a Messaging Service SID (`MG…`) and record the branch for Prompt 3.

**Inputs:** None.

**Do:**
1. Call `fetch_secrets` and confirm presence of `LOVABLE_API_KEY`, `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER`, `OTP_PEPPER`.
2. Without echoing values, report:
   - `TWILIO_FROM_NUMBER` shape: `phone` (starts with `+`, 8–15 digits) or `messaging_service` (starts with `MG`, length 34) or `invalid`.
   - `OTP_PEPPER` length ≥ 32: yes/no.
3. If any secret is missing or invalid, stop and request it via `add_secret` with one-line guidance on where to find it in the Twilio console.
4. Hit the Twilio gateway health endpoint with a no-op call to verify credentials:
   ```
   POST https://connector-gateway.lovable.dev/api/v1/verify_credentials
   Authorization: Bearer $LOVABLE_API_KEY
   X-Connection-Api-Key: $TWILIO_API_KEY
   ```
   Expect `{ "outcome": "verified" }`. On `failed`, surface the gateway error verbatim and stop.

**Deliverables:** A short checklist in chat — no code, no migrations.

**Acceptance:** All four secrets present, `verify_credentials` returns `verified`, the `MG…` vs `+…` branch is recorded.

**Out of scope:** Writing code, creating tables, deploying functions.

---

## Prompt 2 — Migration: `phone_otps` table

**Goal:** Create the OTP storage table with the strictest possible access (service role only) and a cleanup helper.

**Do:** Run a single migration containing exactly these objects, in this order:

```sql
CREATE TABLE public.phone_otps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL,
  code_hash     text NOT NULL,
  expires_at    timestamptz NOT NULL,
  attempts      smallint NOT NULL DEFAULT 0,
  consumed_at   timestamptz,
  last_sent_at  timestamptz NOT NULL DEFAULT now(),
  ip            inet,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phone_otps_attempts_max CHECK (attempts >= 0 AND attempts <= 5),
  CONSTRAINT phone_otps_hash_len     CHECK (char_length(code_hash) = 64),
  CONSTRAINT phone_otps_phone_fmt    CHECK (phone_e164 ~ '^\+[1-9][0-9]{6,14}$')
);

CREATE INDEX phone_otps_lookup_idx  ON public.phone_otps (phone_e164, created_at DESC);
CREATE INDEX phone_otps_expires_idx ON public.phone_otps (expires_at);

-- INTENTIONAL: no GRANTs to anon or authenticated. Service role only.
GRANT ALL ON public.phone_otps TO service_role;

ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;
-- No policies — service role bypasses RLS; everyone else is denied.

CREATE OR REPLACE FUNCTION public.cleanup_phone_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.phone_otps
  WHERE created_at < now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION public.cleanup_phone_otps() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_phone_otps() TO service_role;
```

**Acceptance:**
- `supabase--linter` is clean (or only flags pre-existing warnings).
- `read_query` confirms zero rows in `information_schema.role_table_grants` for `phone_otps` where `grantee in ('anon','authenticated')`.
- `\d public.phone_otps` shows both indexes and all three CHECK constraints.

**Out of scope:** Edge functions, profile changes, cron.

---

## Prompt 3 — Edge function `send-otp`

**Goal:** Public endpoint that generates a 6-digit code, stores its SHA-256 hash, and sends the code via Twilio. Rate-limited and abuse-aware.

**Inputs:** `{ phone: string }` — E.164 format.

**Do:** Create `supabase/functions/send-otp/index.ts`. Requirements:

1. **CORS:** Import `corsHeaders` from `npm:@supabase/supabase-js@2/cors`. Handle `OPTIONS` preflight. Include `corsHeaders` in every response, including errors.
2. **Validation (Zod):** `z.object({ phone: z.string().regex(/^\+[1-9]\d{6,14}$/) })`. On failure → `400 { error: 'invalid_phone' }`.
3. **Service-role Supabase client:** `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
4. **Rate limits** (query the latest rows for this phone):
   - Cooldown: latest row's `last_sent_at` within 30s → `429 { error: 'cooldown', cooldownSec: <n> }`.
   - Hourly: ≥ 5 rows in the last hour → `429 { error: 'hourly_limit' }`.
5. **Code generation:** `crypto.getRandomValues(new Uint32Array(1))` → `code = String(value % 1_000_000).padStart(6, '0')`.
6. **Hash:** `sha256Hex(`${OTP_PEPPER}:${phone}:${code}`)` using `crypto.subtle.digest('SHA-256', …)`. Insert row with `expires_at = now() + 10 minutes` and `ip = req.headers.get('cf-connecting-ip')`.
7. **Twilio send via gateway** (`https://connector-gateway.lovable.dev/twilio/Messages.json`, `application/x-www-form-urlencoded`):
   - Branch on `TWILIO_FROM_NUMBER` prefix:
     - `MG…` → `MessagingServiceSid=<value>`
     - otherwise → `From=<value>`
   - `To = phone`, `Body = "Your Colors of Glory code is {code}. It expires in 10 minutes."`
   - On non-2xx: log `twilio_failed` with status + `code` field from Twilio response (never the OTP). Return `502 { error: 'twilio_failed' }`. Do **not** retry.
8. **Success:** `200 { ok: true, cooldownSec: 30 }`.
9. **Logging redaction:** Only log the last 4 digits of the phone (`***1234`) and never the code, hash, or pepper.

**Acceptance:**
- `curl_edge_functions` with a valid phone returns 200 and inserts exactly one row whose `code_hash` is 64 hex chars.
- Second call within 30s returns 429 `cooldown`.
- Invalid phone returns 400 `invalid_phone`.
- A real SMS is received on a verified Twilio test number.

**Out of scope:** Verification logic, user creation, magic links.

---

## Prompt 4 — Edge function `verify-otp`

**Goal:** Verify a submitted code and return a Supabase magic-link URL that the browser will navigate to in order to establish a session.

**Inputs:** `{ phone: string, code: string }`.

**Do:** Create `supabase/functions/verify-otp/index.ts`. Requirements:

1. **CORS + Zod** (same pattern as `send-otp`). `code` must match `/^\d{6}$/`.
2. **Service-role client.**
3. **Fetch latest row:** `select * from phone_otps where phone_e164 = $1 and consumed_at is null order by created_at desc limit 1`.
   - No row → `400 { error: 'not_found' }`.
   - `expires_at < now()` → `400 { error: 'expired' }`.
   - `attempts >= 5` → `429 { error: 'locked' }`.
4. **Constant-time compare:** Recompute the SHA-256 hash and compare byte-by-byte without short-circuiting.
   - Mismatch → increment `attempts`, return `400 { error: 'invalid_code', remaining: 5 - newAttempts }`.
   - Match → `update phone_otps set consumed_at = now() where id = $1`.
5. **User upsert (synthetic email pattern):**
   - `email = 'phone+' + phone.replace(/\D/g,'') + '@cog.local'`
   - Try `auth.admin.getUserByEmail(email)`. If missing, `auth.admin.createUser({ email, email_confirm: true, user_metadata: { phone_e164: phone } })`.
6. **Generate magic link:**
   ```ts
   const { data, error } = await supabase.auth.admin.generateLink({
     type: 'magiclink',
     email,
     options: { redirectTo: `${SITE_URL}/auth/callback` },
   });
   ```
   Return `200 { action_link: data.properties.action_link }`.
7. **Logging:** Same redaction rules. Never log the code or hash.

**Acceptance:**
- Happy path: send-otp → verify-otp returns `action_link` matching `https://<ref>.supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=…`.
- Replaying a consumed code returns `not_found` (the `consumed_at is null` filter excludes it).
- 5 wrong attempts → next call returns `locked`.

**Out of scope:** Frontend redirect, profile field write (handled by trigger in Prompt 5).

---

## Prompt 5 — Update `handle_new_user` trigger

**Goal:** Persist `phone_e164` from auth metadata onto `profiles` and seed a friendly display name.

**Do:** Replace the function body (keep the existing trigger binding):

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := NEW.raw_user_meta_data ->> 'phone_e164';
  v_last4 text := CASE WHEN v_phone IS NOT NULL
                       THEN right(regexp_replace(v_phone, '\D', '', 'g'), 4)
                       ELSE NULL END;
BEGIN
  INSERT INTO public.profiles (id, phone_e164, display_name)
  VALUES (
    NEW.id,
    v_phone,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name',
             CASE WHEN v_last4 IS NOT NULL THEN 'Friend ' || v_last4 ELSE 'Friend' END)
  )
  ON CONFLICT (id) DO UPDATE
    SET phone_e164 = COALESCE(EXCLUDED.phone_e164, public.profiles.phone_e164);
  RETURN NEW;
END;
$$;
```

**Acceptance:**
- Creating a user via `auth.admin.createUser` with `user_metadata.phone_e164` results in a `profiles` row whose `phone_e164` matches.
- Re-running for the same user does not overwrite an existing phone with NULL.
- Linter clean.

**Out of scope:** Any other profile fields.

---

## Prompt 6 — Rewrite SDK `src/integrations/cog/auth.ts`

**Goal:** Replace Supabase's phone-provider calls with `functions.invoke` calls against `send-otp` / `verify-otp`. Keep the public surface identical so `PhoneLoginPage` only needs error-mapping tweaks.

**Do:**
1. Read the current file to capture the existing `AuthErrorCode` union and `classify()` map.
2. Rewrite:
   ```ts
   export async function sendPhoneOtp(phone: string): Promise<{ cooldownSec: number }> {
     const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone } });
     if (error) throw classify(error, data);
     return { cooldownSec: data?.cooldownSec ?? 30 };
   }

   export async function verifyPhoneOtp(phone: string, code: string): Promise<void> {
     const { data, error } = await supabase.functions.invoke('verify-otp', { body: { phone, code } });
     if (error) throw classify(error, data);
     if (!data?.action_link) throw new AuthError('otp_send_failed', 'No action link returned');
     window.location.assign(data.action_link);
   }
   ```
3. Extend `AuthErrorCode` with: `otp_cooldown | otp_invalid | otp_expired | otp_locked | otp_send_failed | otp_not_found | otp_hourly_limit`.
4. Update `classify()` to map edge-function error strings (`cooldown`, `hourly_limit`, `invalid_code`, `expired`, `locked`, `not_found`, `twilio_failed`, `invalid_phone`) onto the union.
5. Do NOT edit any file under `src/pages/**` or `src/components/**`.

**Acceptance:** TypeScript compiles. `grep -R "signInWithOtp\|verifyOtp" src/integrations/cog` returns nothing.

**Out of scope:** UI work.

---

## Prompt 7 — Handoff to Claude: `PhoneLoginPage.tsx` wiring

**Goal:** A Markdown handoff doc Claude can act on without reading any backend code.

**Do:** Create `docs/claude-handoffs/2026-06-18-phone-otp.md` containing:

1. **Contract:** `sendPhoneOtp(phone)` returns `{ cooldownSec }`; `verifyPhoneOtp(phone, code)` performs a full-page redirect on success — so the page must show a "Signing you in…" state and not try to navigate manually.
2. **Error code → copy table:**

   | Code | Copy |
   |---|---|
   | `otp_cooldown` | "Please wait {cooldownSec}s before requesting another code." |
   | `otp_hourly_limit` | "Too many requests. Try again in an hour." |
   | `otp_invalid` | "That code isn't right. {remaining} tries left." |
   | `otp_expired` | "This code expired. Request a new one." |
   | `otp_locked` | "Too many attempts — try again in 10 minutes." |
   | `otp_not_found` | "Request a code first." |
   | `otp_send_failed` | "We couldn't send your code. Please try again." |
   | `invalid_phone` | "Enter a valid phone number with country code." |

3. **Cooldown countdown spec:** Disable the "Resend" button for `cooldownSec` seconds; show `Resend in {n}s`.
4. **Boundary:** Claude owns layout, typography, motion. Lovable owns the error code contract — do not rename codes without coordinating.

**Acceptance:** Doc committed; no code edits to `src/pages/**`.

---

## Prompt 8 — Happy-path E2E test

**Goal:** Prove the full send → verify → magic-link → session loop works.

**Do:**
1. `curl_edge_functions` POST `/send-otp` with a real verified Twilio number → expect 200, `{ ok: true }`.
2. `read_query`:
   ```sql
   select id, phone_e164, char_length(code_hash) as hlen, expires_at > now() as alive
   from phone_otps where phone_e164 = $1 order by created_at desc limit 1;
   ```
   Confirm `hlen = 64`, `alive = true`, **no plaintext code column exists**.
3. Read the SMS, then `curl_edge_functions` POST `/verify-otp` with `{ phone, code }`.
4. Assert response shape: `action_link` starts with `https://` and contains `type=magiclink`.
5. Open `action_link` in `browser--navigate_to_url`. Confirm redirect to `/auth/callback`, then `read_console_logs` for `supabase.auth.onAuthStateChange` → `SIGNED_IN`.
6. `read_query`: `select id, phone_e164 from profiles where id = (select id from auth.users where email = 'phone+<digits>@cog.local')` → row exists, `phone_e164` matches.

**Acceptance:** All six steps green. Tear down the test user with `auth.admin.deleteUser` after.

---

## Prompt 9 — Negative-path test matrix

**Goal:** Cover every documented error path. Use SQL to fast-forward time where needed.

**Test matrix:**

| # | Setup | Call | Expect |
|---|---|---|---|
| 1 | Send once | Send again within 30s | 429 `cooldown` |
| 2 | Send 5× over a few minutes | 6th send | 429 `hourly_limit` |
| 3 | Send, then guess wrong code ×5 | 6th verify | 429 `locked` |
| 4 | Send, then backdate `expires_at` | Verify with correct code | 400 `expired` |
| 5 | No send | Verify | 400 `not_found` |
| 6 | Send, verify (consume), verify again with same code | — | 400 `not_found` |
| 7 | Send body `{ phone: '12345' }` | — | 400 `invalid_phone` |
| 8 | Verify body `{ phone: '+15551234567', code: 'abc123' }` | — | 400 `invalid_phone` |

**Helper SQL for #4:**
```sql
UPDATE phone_otps SET expires_at = now() - interval '1 minute'
WHERE phone_e164 = $1 AND consumed_at IS NULL;
```

**Acceptance:** All 8 cases return the expected status and `error` string. No row in `phone_otps` ever contains the plaintext code — verify with a `read_query` enumerating columns; only `code_hash` should exist.

---

## Prompt 10 — Cleanup, cron, and abuse hardening

**Goal:** Production-readiness sweep.

**Do:**

1. **Cron purge** (use `supabase--insert`, not migration, because the function URL is project-specific):
   ```sql
   select cron.schedule(
     'phone-otps-cleanup-daily',
     '15 3 * * *',
     $$ select public.cleanup_phone_otps(); $$
   );
   ```
   Enable `pg_cron` first if not enabled.
2. **Audit logging** (in both edge functions, after success):
   ```ts
   await supabase.from('audit_logs').insert({
     event_kind: 'otp_sent', // or 'otp_verified'
     subject_hash: await sha256Hex(phone), // never raw phone
     metadata: { last4: phone.slice(-4) },
   });
   ```
   (Assumes existing `audit_logs` table; if missing, add via separate migration.)
3. **Twilio console (manual user step, document in chat):**
   - Enable **SMS Pumping Protection** on the messaging service / number.
   - Set **Geo Permissions** to allow only the destination countries you ship to (default: US, CA).
   - Confirm the number/service is A2P-registered for US traffic.
4. **Optional IP rate limit** (only if user asks): track `cf-connecting-ip` in `phone_otps.ip` and add a "max 10 sends per IP per hour" check at the top of `send-otp`. Document the tradeoff: VPN users may share IPs.
5. **Final read-only sanity:**
   - `read_query` shows no `anon`/`authenticated` grants on `phone_otps`.
   - `edge_function_logs` for `send-otp` and `verify-otp` contain no 6-digit codes or full phone numbers.

**Acceptance:** Cron job visible in `cron.job`, audit rows appear on both send and verify, Twilio settings confirmed by the user.

**Out of scope:** Anything beyond OTP — profile editing, song flows, billing.

---

## Execution order summary

1 → 2 → 3 → 4 → 5 → 6 (Lovable, single session each)
7 (handoff doc; Claude implements next)
8 → 9 → 10 (Lovable validation + hardening once Claude's UI is in)
