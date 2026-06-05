# Codex prompt — Twilio SMS OTP stress-test harness

Paste everything below the line into Codex, run from the repo root.

---

You are Codex operating on the Colors of Glory repo. Your single deliverable
this session is a Twilio SMS-OTP stress-test harness. You will NOT modify
application code, edge functions, RLS, or the database schema. All work
lives under `scripts/stress/otp/`. All artifacts land under
`scripts/stress/otp/reports/` (gitignored).

# 0. MISSION

Prove or disprove these claims, with numbers, under load:

  C1. Supabase Auth + Twilio reliably sends one SMS OTP per phone within
      p95 ≤ 4000 ms from request → Supabase "ok" response (proxy for
      Twilio "queued").
  C2. The same pipeline survives a 20-RPS burst for 60 s without any
      provider-side 5xx, without dropping below 98% accepted-send rate,
      and without violating the configured per-number cooldown.
  C3. `supabase.auth.verifyOtp({ type: "sms" })` returns a session for
      the magic test numbers (+15555550100..+15555550119, code 123456)
      with p95 ≤ 800 ms and 100% success.
  C4. Abuse traffic (fake E.164 numbers outside Geo Permissions,
      malformed numbers, replayed codes) is rejected with the expected
      Supabase error codes and never reaches Twilio billing.
  C5. The resend cooldown enforced server-side matches what the UI
      shows on `/auth/code-verify` (currently 30 s). No client trick
      bypasses it.

Each claim ends GREEN / YELLOW / RED in the final report with the
specific metric that decided it.

# 1. HARD GUARDRAILS — VIOLATING ANY OF THESE FAILS THE RUN

- HARD CAP: total Twilio sends across this entire session ≤ 2000.
  Implement a process-wide counter; refuse to send once hit; log and
  exit non-zero.
- NEVER send to a real phone number. Allowed destinations:
    * Supabase magic test numbers `+15555550100`..`+15555550119`
    * Twilio magic numbers `+15005550006` (valid) / `+15005550001`
      (invalid) — only via Supabase's send path
    * Synthetic fakes for abuse sim (see §4 T6) — must be REJECTED
      before reaching Twilio. If any reach Twilio, abort the scenario.
- NEVER print or persist: `TWILIO_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`,
  OTP codes for real numbers, or full phone numbers in logs (mask the
  middle 4 digits: `+1555***0100`).
- NEVER use the service-role key from a client-style call path. Only the
  anon key + the public Supabase JS client, exactly as the app uses it.
- NEVER call Twilio's REST API directly. The whole point is to exercise
  the Supabase Auth → Twilio path the app actually uses.
- READ-ONLY against production data. No INSERT/UPDATE/DELETE on any
  public table. No edge function deploys. No migrations.
- If you discover the harness is sending to a number not in the
  allow-list above, STOP within 1 second and exit non-zero.

# 2. PRE-FLIGHT — REFUSE TO START UNTIL ALL TRUE

Print a checklist and require each line to be ✅ before any scenario
runs. If any line is ❌, write `reports/preflight-blocked.md` explaining
what is missing and exit 0 (not an error — the operator must fix
backend config).

    [ ] SUPABASE_URL and SUPABASE_ANON_KEY readable from .env
    [ ] Supabase Auth → Phone provider = Twilio, ENABLED
    [ ] Twilio Messaging Service SID configured (NOT a single From)
    [ ] A2P 10DLC campaign registered + APPROVED for sending number
    [ ] SMS Pumping Protection: ON
    [ ] Geo Permissions: only US + CA enabled
    [ ] Test OTPs configured in Supabase Auth → Phone:
          +15555550100..+15555550119 → 123456
    [ ] Resend cooldown documented (default 30 s — confirm in dashboard)
    [ ] Operator typed "I CONFIRM SANDBOX" into CONFIRM env var

The preflight script probes Supabase by sending exactly ONE OTP to
`+15555550100` and asserting a non-error response. That single send
counts against the 2000 budget.

# 3. FILE LAYOUT — CREATE EXACTLY THIS

    scripts/stress/otp/
      README.md                # how to run, what each scenario does
      .env.example             # required env vars, no real values
      package.json             # type: module, scripts: preflight, t1..t8, all
      tsconfig.json            # node16 module, strict
      supaClient.ts            # creates anon client, no service role
      metrics.ts               # latency histogram, error taxonomy, csv writer
      cooldown.ts              # last-send-per-number, asserts ≥ N seconds
      budget.ts                # process-wide send counter, hard cap 2000
      mask.ts                  # phone masking helper
      test-numbers.json        # 20 magic + 50 synthetic fakes (labeled)
      scenarios/
        t1-baseline-send.ts
        t2-burst-send.ts
        t3-verify-happy.ts
        t4-verify-negative.ts
        t5-cooldown-probe.ts
        t6-abuse-sim.ts
        t7-real-phone-smoke.ts   # GUARDED: REAL_PHONE_OPT_IN=1 + number
        t8-soak.ts
      run-all.ts               # orchestrates t1→t8 (minus t7), writes SUMMARY.md
      reports/                 # gitignored, .gitkeep only

    scripts/stress/otp/reports/.gitignore   # ignore everything except .gitkeep

# 4. SCENARIO MATRIX — IMPLEMENT EACH

For every scenario: structured JSONL log under
`reports/<scenario>.jsonl`, per-request timing, error code captured
verbatim from Supabase (`error.code` / `error.message` /
`error.status`). Never invent your own taxonomy — record what Supabase
returned and bucket afterward.

    T1 baseline-send
      Loop the 20 magic numbers, sequentially, 1 send each, 200 ms
      apart. Pass: 100% accepted, p95 latency ≤ 4000 ms.
      Budget: 20 sends.

    T2 burst-send
      20 RPS for 60 s = 1200 requests across the 20 magic numbers,
      round-robin. Respect cooldown by widening rotation if needed.
      Pass: ≥ 98% accepted, zero 5xx, p95 ≤ 5000 ms.
      Budget: ≤ 1200 sends.

    T3 verify-happy
      For each magic number used in T1, call
      `supabase.auth.verifyOtp({ phone, token: "123456", type: "sms" })`.
      Pass: 100% returns a session, p95 ≤ 800 ms.
      Budget: 0 sends (verify-only).

    T4 verify-negative
      For each magic number, call verifyOtp with: wrong code "000000",
      empty code, 5-digit code, 7-digit code, and a code from a
      different number. Pass: every call returns an error; classify by
      Supabase error code; zero false sessions issued.
      Budget: 0 sends.

    T5 cooldown-probe
      Send to one magic number, then immediately re-send. Expect
      rate-limit / cooldown error. Walk the cooldown: re-send at t=5s,
      15s, 25s, 31s. First success time must be ≥ documented cooldown
      (default 30 s). Pass: cooldown observed within ±3 s of UI value.
      Budget: ≤ 6 sends.

    T6 abuse-sim
      Attempt to send to: malformed numbers ("123", "abc", "+1"),
      out-of-geo numbers (+44…, +91…, +234…), and 50 synthetic fakes
      shaped like +1-area-NXX-XXXX but reserved/invalid. EVERY ONE must
      be rejected by Supabase or by Geo Permissions before reaching
      Twilio billing. If any go through, mark RED and stop scenario.
      Budget: 0 expected; 60 absolute ceiling.

    T7 real-phone-smoke (GUARDED)
      Only runs if env `REAL_PHONE_OPT_IN=1` AND `REAL_PHONE_E164` is
      set AND operator confirms in stdin ("YES" exactly). Sends exactly
      ONE OTP, prompts operator to type the received code, verifies,
      exits. This is the only path that touches a real number.
      Budget: 1 send. NEVER run in `npm run all`.

    T8 soak
      1 send every 30 s for 30 min, rotating across the 20 magic
      numbers. Watches for latency drift, error-rate creep, and Twilio
      queue backpressure (look at supabase `error.status`, count 429s).
      Budget: 60 sends.

# 5. METRICS — REPORT EXACTLY THESE

For every scenario emit `reports/<scenario>.json`:

    {
      "scenario": "t2-burst-send",
      "started_at": "...", "ended_at": "...",
      "total_requests": 1200,
      "accepted": 1188,
      "rejected_by_supabase": { "over_sms_send_rate_limit": 8, "...": 4 },
      "rejected_by_twilio_via_supabase": {},
      "latency_ms": { "p50": ..., "p95": ..., "p99": ..., "max": ... },
      "twilio_send_budget_used": 1188,
      "twilio_send_budget_remaining": <2000 - cumulative>,
      "claims_touched": ["C1","C2"]
    }

Final `reports/SUMMARY.md`:

- Table: claim → GREEN/YELLOW/RED → deciding metric → source scenario
- Top 5 error codes observed, with counts and remediation hints
- Twilio budget used / 2000
- Operator action items (e.g. "raise Supabase rate limit", "register
  second 10DLC campaign", "tighten Geo Permissions")
- Reproduction commands

# 6. ORCHESTRATION

    npm run preflight   # §2 checklist + 1 probe send
    npm run t1 .. t8    # individual scenarios
    npm run all         # preflight → t1 t2 t3 t4 t5 t6 t8 → SUMMARY.md
                        # t7 NEVER runs in `all`; must be invoked explicitly

Between scenarios, sleep 60 s to let cooldowns and Twilio queues drain.
Re-check budget remaining before each scenario; skip and mark SKIPPED
if remaining < scenario's worst-case send count.

# 7. STYLE & DEPENDENCIES

- TypeScript, Node ≥ 20, ESM. No frameworks. Only deps allowed:
  `@supabase/supabase-js`, `dotenv`, `picocolors`. No test runner needed.
- Every async call wrapped with try/catch + structured error capture.
- No top-level await chains > 3 levels; pull helpers into `supaClient.ts`
  and `metrics.ts`.
- Code is the spec — comment WHY, not WHAT.

# 8. WHEN YOU FINISH

Print, in this order:

1. Files created (tree).
2. How to run preflight.
3. Two-paragraph plain-English summary suitable for pasting back to
   the Lovable agent — what is GREEN, what is YELLOW, what is RED, and
   the single highest-leverage fix.

Do not open a PR. Do not commit. Leave the working tree dirty for the
operator to review.