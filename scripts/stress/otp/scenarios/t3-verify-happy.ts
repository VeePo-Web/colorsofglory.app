import { createAnonClient } from "../supaClient.js";
import {
  loadTestNumbers,
  printSummary,
  verifyOtp,
  writeScenarioSummary,
  type OtpResult,
  type ScenarioStatus,
} from "../metrics.js";

const SCENARIO = "t3-verify-happy";

export async function runT3(): Promise<void> {
  const startedAt = new Date().toISOString();
  const client = createAnonClient();
  const results: OtpResult[] = [];

  for (const phone of loadTestNumbers().magic_numbers) {
    results.push(await verifyOtp(client, SCENARIO, phone, "123456", "magic test code"));
  }

  const accepted = results.filter((result) => result.accepted).length;
  const p95 = results.length ? [...results].sort((a, b) => a.latency_ms - b.latency_ms)[Math.ceil(results.length * 0.95) - 1]?.latency_ms ?? 0 : 0;
  const status: ScenarioStatus = accepted === results.length && p95 <= 800 ? "GREEN" : "RED";
  const summary = writeScenarioSummary(
    SCENARIO,
    startedAt,
    results,
    ["C3"],
    status,
    `${accepted}/${results.length} sessions, p95 ${p95}ms`,
  );
  printSummary(summary);
}

runT3().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
