import { createAnonClient } from "../supaClient.js";
import {
  SendBudget,
  loadTestNumbers,
  printSummary,
  sendOtp,
  writeScenarioSummary,
  writeSkippedScenario,
  type OtpResult,
  type ScenarioStatus,
} from "../metrics.js";
import { sleep } from "../cooldown.js";

const SCENARIO = "t6-abuse-sim";

export async function runT6(): Promise<void> {
  const numbers = loadTestNumbers();
  const targets = [
    ...numbers.malformed.map((phone) => ({ phone, label: "malformed" })),
    ...numbers.out_of_geo.map((phone) => ({ phone, label: "out-of-geo" })),
    ...numbers.synthetic_fakes.map((phone) => ({ phone, label: "synthetic-fake" })),
  ];
  const budget = new SendBudget();
  if (!budget.canReserve(targets.length)) {
    const summary = writeSkippedScenario(
      SCENARIO,
      ["C4"],
      `remaining budget ${budget.remaining} is below abuse ceiling ${targets.length}`,
    );
    printSummary(summary);
    return;
  }

  const startedAt = new Date().toISOString();
  const client = createAnonClient();
  const results: OtpResult[] = [];

  for (const target of targets) {
    const result = await sendOtp(client, SCENARIO, target.phone, budget, target.label);
    results.push(result);
    if (result.accepted) {
      const summary = writeScenarioSummary(
        SCENARIO,
        startedAt,
        results,
        ["C4"],
        "RED",
        `accepted abuse target in ${target.label}; stop immediately to avoid billing leakage`,
      );
      printSummary(summary);
      process.exitCode = 1;
      return;
    }
    await sleep(100);
  }

  const status: ScenarioStatus = results.every((result) => !result.accepted) ? "GREEN" : "RED";
  const summary = writeScenarioSummary(
    SCENARIO,
    startedAt,
    results,
    ["C4"],
    status,
    `${results.filter((result) => !result.accepted).length}/${results.length} abuse sends rejected`,
  );
  printSummary(summary);
}

runT6().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
