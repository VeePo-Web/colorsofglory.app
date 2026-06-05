# Colors of Glory OTP Stress Harness

This harness exercises the same Supabase Auth phone-OTP path used by the app:

```ts
supabase.auth.signInWithOtp({ phone })
supabase.auth.verifyOtp({ phone, token, type: "sms" })
```

It never calls Twilio directly, never uses the Supabase service-role key, and never touches app code, edge functions, migrations, or public tables.

## Setup

From `scripts/stress/otp/`:

```bash
cp .env.example .env
```

Fill in:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CONFIRM=I CONFIRM SANDBOX`
- The operator-confirmed backend checklist flags

The harness also accepts the app-style names `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the repo root `.env`, but the dedicated names above are preferred for stress runs.

## No-Send Preflight

```bash
npm run preflight
```

Preflight performs zero SMS sends. It verifies local env readiness and writes `reports/preflight-blocked.md` if backend dashboard configuration still needs operator confirmation.

## Scenarios

```bash
npm run t1   # baseline send, 20 magic numbers
npm run t2   # 20 RPS burst, blocked if cooldown math is impossible
npm run t3   # verify happy path, magic code 123456
npm run t4   # verify negative cases
npm run t5   # resend cooldown probe
npm run t6   # malformed/out-of-geo/synthetic abuse sim
npm run t7   # guarded real-phone smoke, never run by all
npm run t8   # 30-minute soak
npm run all  # preflight -> t1 t2 t3 t4 t5 t6 t8 -> SUMMARY.md
```

All reports are written to `scripts/stress/otp/reports/` and are ignored by git.

## Safety Rules

- Hard cap: `OTP_SEND_BUDGET_MAX=2000`.
- Every `signInWithOtp` attempt reserves budget before the network call.
- Full phone numbers are masked in all logs and reports.
- Real phone smoke requires `REAL_PHONE_OPT_IN=1`, `REAL_PHONE_E164`, and interactive stdin confirmation.
- T7 never runs from `npm run all`.

## Important T2 Note

The requested `20 RPS for 60 seconds` is not compatible with `20` test numbers and a `30s` per-number cooldown. The harness calculates required rotation size as:

```text
ceil(rps * cooldown_seconds)
```

At 20 RPS and 30 seconds, that requires 600 allowed test numbers. With the default 20, T2 writes a skipped report instead of violating the cooldown.
