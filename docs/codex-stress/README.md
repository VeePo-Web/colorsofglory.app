# OTP Send Stress Tests

Load-tests the `signInWithOtp` (phone) endpoint that fronts Supabase's managed
Twilio SMS sender. Owned by Codex (perf) — Lovable and Claude do not touch
running it.

## Prerequisites (one-time)

1. **Add test phone numbers** in the Auth dashboard so we don't pay for SMS:
   Lovable Cloud → Users → Auth Settings → Phone provider → **Test OTP**.
   Add `+15555550100` through `+15555550119`, all with OTP `123456`.
   These bypass Twilio entirely. **Required for `--mode=test-numbers`.**
2. Copy `scripts/stress/phones.example.json` to `scripts/stress/phones.json`
   and edit the `canary` array if you plan to send real SMS to numbers you own.
   `phones.json` is gitignored.
3. Ensure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Modes

| Mode | Real SMS? | Use for |
|------|-----------|---------|
| `test-numbers` | No ($0) | All real load testing |
| `canary` | Yes | Smoke-test the live Twilio path |
| `dry-run` | No | Pure API validation path (invalid phone format) |

## Scenarios

| # | Command | What it shows |
|---|---------|---------------|
| 1 | `deno run -A scripts/stress/otp-send.ts --mode=test-numbers --rps=1 --duration=30` | Baseline latency, p95 < 800ms expected |
| 2 | Edit phones.json to a single number, then run rps=5 for 30s | Per-phone cooldown (1 send / 60s) |
| 3 | `--rps=10 --duration=60` then 25, then 50 | Find the rate-limit knee |
| 4 | `--rps=50 --duration=60` | Sustained-burst behavior + tail latency |
| 5 | `--concurrency=250` (burst mode ignores rps/duration) | Concurrency safety, no dropped responses |
| 6 | `--mode=canary --concurrency=5` | Real SMS smoke test (≈$0.04) |

The script aborts before sending if estimated SMS cost exceeds $1.

## Output

- Console summary: total / success% / p50/p95/p99 / top error codes
- Raw NDJSON log at `/tmp/otp-stress-<ts>.ndjson` (gitignored)

## Expected error codes

- `over_sms_send_rate_limit` — Supabase global / IP / per-phone cap hit
- `over_email_send_rate_limit` — shouldn't appear; flag if it does
- `429` (raw status) — gateway-level rate limit
- `validation_failed` — only in `--mode=dry-run`

## What "passes"

- No 5xx under any scenario
- No dropped TCP / network errors under concurrency=250
- Rate limits return structured JSON with a recognized `error_code`, not HTML
- p95 under 1500 ms at the supported rps tier

If any of these fail, file findings in `docs/codex-stress/otp-send-<date>.md`.