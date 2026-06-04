/**
 * Stress test for Supabase Auth `signInWithOtp` (phone) — the endpoint that
 * sits in front of Supabase's managed Twilio SMS sender.
 *
 * Run:
 *   deno run -A scripts/stress/otp-send.ts --mode=test-numbers --rps=20 --duration=60
 *
 * Modes:
 *   test-numbers (default) — fake numbers configured in Auth → Phone → Test OTP. $0 cost.
 *   canary                 — small list of real numbers; sends real SMS. Costs money.
 *   dry-run                — invalid phone format; exercises validation path only.
 *
 * Phones come from scripts/stress/phones.json (gitignored). Falls back to
 * phones.example.json for `test-numbers` and `dry-run`.
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { parseArgs } from "https://deno.land/std@0.224.0/cli/parse_args.ts";

type Mode = "test-numbers" | "canary" | "dry-run";

interface Result {
  ts: number;
  phone: string;
  status: number;
  latency_ms: number;
  error_code: string | null;
  error_msg: string | null;
}

const args = parseArgs(Deno.args, {
  string: ["mode", "rps", "duration", "concurrency", "ramp", "scenario"],
  default: { mode: "test-numbers", rps: "5", duration: "30", concurrency: "0", ramp: "" },
});

const mode = args.mode as Mode;
const rps = Number(args.rps);
const duration = Number(args.duration);
const concurrency = Number(args.concurrency); // 0 = open-loop

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  Deno.exit(1);
}

const OTP_URL = `${SUPABASE_URL}/auth/v1/otp`;

async function loadPhones(): Promise<string[]> {
  const root = new URL("./", import.meta.url);
  const tryPaths = ["phones.json", "phones.example.json"];
  for (const p of tryPaths) {
    try {
      const txt = await Deno.readTextFile(new URL(p, root));
      const obj = JSON.parse(txt);
      const list = obj[mode];
      if (Array.isArray(list) && list.length > 0) return list;
    } catch { /* keep trying */ }
  }
  console.error(`No phones found for mode=${mode}. Add scripts/stress/phones.json.`);
  Deno.exit(1);
}

function costEstimate(totalSends: number): number {
  if (mode === "test-numbers" || mode === "dry-run") return 0;
  return totalSends * 0.008; // ~$0.008 / SMS, US
}

async function sendOtp(phone: string): Promise<Result> {
  const t0 = performance.now();
  let status = 0;
  let error_code: string | null = null;
  let error_msg: string | null = null;
  try {
    const res = await fetch(OTP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY!,
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ phone, create_user: true }),
    });
    status = res.status;
    const body = await res.text();
    if (!res.ok) {
      try {
        const j = JSON.parse(body);
        error_code = j.error_code || j.code || j.error || String(res.status);
        error_msg = j.msg || j.message || j.error_description || body.slice(0, 120);
      } catch {
        error_code = String(res.status);
        error_msg = body.slice(0, 120);
      }
    }
  } catch (e) {
    status = 0;
    error_code = "network";
    error_msg = String(e).slice(0, 120);
  }
  return {
    ts: Date.now(),
    phone,
    status,
    latency_ms: Math.round(performance.now() - t0),
    error_code,
    error_msg,
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? Math.round(sorted[base] + rest * (sorted[base + 1] - sorted[base]))
    : sorted[base];
}

function summarize(results: Result[]) {
  const latencies = results.map((r) => r.latency_ms).sort((a, b) => a - b);
  const ok = results.filter((r) => r.status >= 200 && r.status < 300).length;
  const errCounts = new Map<string, number>();
  for (const r of results) {
    if (r.error_code) errCounts.set(r.error_code, (errCounts.get(r.error_code) ?? 0) + 1);
  }
  const topErrors = [...errCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    total: results.length,
    ok,
    err: results.length - ok,
    successPct: results.length ? ((ok / results.length) * 100).toFixed(1) : "0.0",
    p50: quantile(latencies, 0.5),
    p95: quantile(latencies, 0.95),
    p99: quantile(latencies, 0.99),
    max: latencies[latencies.length - 1] ?? 0,
    topErrors,
  };
}

async function runOpenLoop(phones: string[]): Promise<Result[]> {
  const results: Result[] = [];
  const intervalMs = 1000 / rps;
  const endAt = performance.now() + duration * 1000;
  let i = 0;
  const inflight: Promise<void>[] = [];

  while (performance.now() < endAt) {
    const phone = phones[i++ % phones.length];
    const fired = sendOtp(phone).then((r) => {
      results.push(r);
      const elapsed = (results.length / (rps * duration) * 100).toFixed(0);
      if (results.length % Math.max(1, Math.floor(rps)) === 0) {
        Deno.stderr.writeSync(new TextEncoder().encode(`\r  sent=${results.length} progress=${elapsed}%   `));
      }
    });
    inflight.push(fired);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  await Promise.all(inflight);
  Deno.stderr.writeSync(new TextEncoder().encode("\n"));
  return results;
}

async function runBurst(phones: string[]): Promise<Result[]> {
  const n = concurrency;
  console.log(`  firing ${n} parallel requests in a single tick…`);
  const promises = Array.from({ length: n }, (_, i) => sendOtp(phones[i % phones.length]));
  return await Promise.all(promises);
}

async function main() {
  const phones = await loadPhones();
  const isBurst = concurrency > 0;
  const estTotal = isBurst ? concurrency : rps * duration;
  const cost = costEstimate(estTotal);

  console.log("─".repeat(60));
  console.log(`OTP Stress Test`);
  console.log("─".repeat(60));
  console.log(`  mode:        ${mode}`);
  console.log(`  phones:      ${phones.length}`);
  console.log(`  url:         ${OTP_URL}`);
  if (isBurst) {
    console.log(`  pattern:     burst, ${concurrency} parallel`);
  } else {
    console.log(`  pattern:     open-loop, ${rps} rps for ${duration}s (~${estTotal} reqs)`);
  }
  console.log(`  est cost:    $${cost.toFixed(4)}${mode === "canary" ? "  ← REAL SMS" : ""}`);
  console.log("─".repeat(60));

  if (cost > 1.0) {
    console.error("Abort: estimated cost > $1. Adjust phones/duration or use test-numbers.");
    Deno.exit(2);
  }

  const t0 = Date.now();
  const results = isBurst ? await runBurst(phones) : await runOpenLoop(phones);
  const wallSec = (Date.now() - t0) / 1000;

  // Write NDJSON
  const outPath = `/tmp/otp-stress-${new Date().toISOString().replace(/[:.]/g, "-")}.ndjson`;
  await Deno.writeTextFile(outPath, results.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const s = summarize(results);
  console.log();
  console.log("─".repeat(60));
  console.log(`Summary  (wall=${wallSec.toFixed(1)}s, effective rps=${(s.total / wallSec).toFixed(1)})`);
  console.log("─".repeat(60));
  console.log(`  total:       ${s.total}`);
  console.log(`  success:     ${s.ok}  (${s.successPct}%)`);
  console.log(`  errors:      ${s.err}`);
  console.log(`  latency p50: ${s.p50} ms`);
  console.log(`  latency p95: ${s.p95} ms`);
  console.log(`  latency p99: ${s.p99} ms`);
  console.log(`  latency max: ${s.max} ms`);
  if (s.topErrors.length > 0) {
    console.log(`  top errors:`);
    for (const [code, n] of s.topErrors) {
      console.log(`    ${String(n).padStart(6)}  ${code}`);
    }
  }
  console.log(`  raw log:     ${outPath}`);
  console.log("─".repeat(60));
}

await main();