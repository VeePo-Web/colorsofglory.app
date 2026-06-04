# Stress Test: Phone OTP Send (`signInWithOtp`)

## Why we cannot just "send a ton"

`PhoneLoginPage.tsx` calls `supabase.auth.signInWithOtp({ phone })`. That endpoint is owned by **Supabase Auth's managed Twilio**, not a custom edge function. Hammering it naively will:

1. **Cost real money** — every successful call sends a real SMS (Twilio bills per segment, ~$0.0079+ each).
2. **Trip rate limits fast** — Supabase Auth defaults: ~30 OTP/hour per IP, 1 send per phone per 60s, plus global hourly caps. We'll hit `over_sms_send_rate_limit` in seconds.
3. **Risk SMS-pumping fraud flags** on the Twilio account, which can suspend the number.

So the test has to be designed around those gates, not against them.

## What we will measure

- **Throughput**: requests/sec the endpoint actually accepts before rate-limiting.
- **Latency**: p50 / p95 / p99 of `signInWithOtp` round-trip.
- **Rate-limit behavior**: which error codes return, at what RPS, with what `Retry-After`.
- **Per-phone vs per-IP gates**: confirm 60s same-number cooldown and hourly IP cap.
- **Concurrency safety**: 50 / 100 / 250 parallel callers — any 5xx, dropped responses, or socket errors?
- **Cost ceiling**: every run prints estimated SMS spend before it starts and aborts if > $X.

## How we send safely

Three modes, selectable via `--mode` flag:

1. **`test-numbers` (default, $0 cost)** — Use Supabase Auth's **Test Phone Numbers** feature (Auth → Phone Provider → Test OTP). Add 20 fake numbers like `+15555550100..0119` with fixed OTPs. These bypass Twilio entirely. **This is the mode we'll actually push hard.**
2. **`canary` (small cost)** — 5 real numbers you own, 1 send each, used once to verify the real Twilio path still works end-to-end.
3. **`dry-run`** — Hits a non-existent provider config or uses an invalid phone format to exercise the request path without sending. Measures pure API latency/validation.

## Test script

New file (Codex-owned, since Codex handles perf): `scripts/stress/otp-send.ts`

```ts
// Deno script. Run: deno run -A scripts/stress/otp-send.ts --mode=test-numbers --rps=20 --duration=60
```

Features:
- Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`.
- Phone pool from `scripts/stress/phones.json` (gitignored; one list per mode).
- Configurable: `--rps`, `--duration`, `--concurrency`, `--mode`.
- Open-loop load generator (constant arrival rate, not closed-loop) so we measure server behavior, not client backpressure.
- Per-request: timestamp, phone, status, error code, latency ms, response body hash.
- Writes NDJSON results to `/tmp/otp-stress-<ts>.ndjson`.
- Prints a summary table at the end: total, success%, p50/p95/p99, top 5 error codes with counts, and inferred rate-limit thresholds (first-failure RPS).

## Test scenarios (run in order)

| # | Scenario | Mode | RPS | Duration | Expectation |
|---|----------|------|-----|----------|-------------|
| 1 | Baseline single | test-numbers | 1 | 30s | 100% success, p95 < 800ms |
| 2 | Per-phone cooldown | test-numbers | 5 (same number) | 30s | First succeeds, rest = `over_sms_send_rate_limit` after 1/60s |
| 3 | Ramp | test-numbers | 1→50 step 5 every 10s | 100s | Find knee where success% drops below 95% |
| 4 | Sustained burst | test-numbers | 50 | 60s | Measure rate-limit recovery + tail latency |
| 5 | Concurrency stress | test-numbers | 250 parallel, single tick | 5s | No 5xx, no dropped TCP, all responses returned |
| 6 | Canary real SMS | canary | 1 | 5 sends total | All deliver; confirms prod path |

## Reporting

After the run, the script writes `docs/codex-stress/otp-send-<date>.md` with:
- Config used
- Summary table
- Two ASCII charts: latency over time, RPS vs error-rate
- Observed Supabase rate-limit thresholds
- Recommended client-side guards (debounce window, retry-after honoring)

## Code/config that will change

- **Create** `scripts/stress/otp-send.ts` (Deno load-test script)
- **Create** `scripts/stress/phones.example.json` (committed) + `scripts/stress/phones.json` (gitignored)
- **Create** `docs/codex-stress/README.md` explaining how to run, prerequisites, and how to add test numbers in the Auth dashboard
- **Update** `.gitignore` to exclude `scripts/stress/phones.json` and `/tmp/otp-stress-*.ndjson`
- **No** app code changes. **No** edge function changes. **No** schema changes.

## Out of scope

- Auto-creating test phone numbers in the Auth provider config (requires manual dashboard step — script will print instructions).
- Stress-testing `verifyOtp` (separate plan if you want it).
- Building a Twilio-direct custom send function (separate plan).

## Prereqs you must do once before run #1

1. Open Cloud → Users → Auth Settings → Phone provider → **Test OTP** and add 20 numbers `+15555550100` through `+15555550119`, all with OTP `123456`.
2. Confirm Lovable Cloud Auth is in **sandbox / dev** environment so we don't pollute prod metrics.

After approval I'll create the script + docs, then run scenarios 1–5 and surface the report.
