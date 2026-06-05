import { createAnonClient } from "../supaClient.js";
import {
  SendBudget,
  loadTestNumbers,
  printSummary,
  sendOtp,
  writeScenarioSummary,
  type OtpResult,
  type ScenarioStatus,
} from "../metrics.js";
import { sleep } from "../cooldown.js";

const SCENARIO = "t1-baseline-send";

export async function runT1(): Promise<void> {
  const startedAt = new Date().toISOString();
  const client = createAnonClient();
  const budget = new SendBudget();
  const numbers = loadTestNumbers().magic_numbers;
  const results: OtpResult[] = [];

  if (!budget.canReserve(numbers.length)) {
    const summary = writeScenarioSummary(
      SCENARIO,
      startedAt,
      results,
      ["C1"],
      "SKIPPED",
      `remaining budget ${budget.remaining} is below required ${numbers.length}`,
      "insufficient send budget",
    );
    printSummary(summary);
    return;
  }

  for (const phone of numbers) {
    results.push(await sendOtp(client, SCENARIO, phone, budget));
    await sleep(200);
  }

  const accepted = results.filter((result) => result.accepted).length;
  const p95 = results.length ? [...results].sort((a, b) => a.latency_ms - b.latency_ms)[Math.ceil(results.length * 0.95) - 1]?.latency_ms ?? 0 : 0;
  const status: ScenarioStatus = accepted === numbers.length && p95 <= 4000 ? "GREEN" : "RED";
  const summary = writeScenarioSummary(
    SCENARIO,
    startedAt,
    results,
    ["C1"],
    status,
    `${accepted}/${numbers.length} accepted, p95 ${p95}ms`,
  );
  printSummary(summary);
}

runT1().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
