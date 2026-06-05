import { createAnonClient, getNumberEnv } from "../supaClient.js";
import { SendBudget, loadTestNumbers, printSummary, sendOtp, writeScenarioSummary, writeSkippedScenario, } from "../metrics.js";
import { sleep } from "../cooldown.js";
const SCENARIO = "t8-soak";
export async function runT8() {
    const minutes = getNumberEnv("OTP_T8_MINUTES", 30);
    const totalSends = Math.round(minutes * 2);
    const budget = new SendBudget();
    if (!budget.canReserve(totalSends)) {
        const summary = writeSkippedScenario(SCENARIO, ["C1", "C2"], `remaining budget ${budget.remaining} is below required ${totalSends}`);
        printSummary(summary);
        return;
    }
    const startedAt = new Date().toISOString();
    const client = createAnonClient();
    const numbers = loadTestNumbers().magic_numbers;
    const results = [];
    for (let i = 0; i < totalSends; i += 1) {
        const phone = numbers[i % numbers.length];
        results.push(await sendOtp(client, SCENARIO, phone, budget, `soak sample ${i + 1}/${totalSends}`));
        if (i < totalSends - 1)
            await sleep(30_000);
    }
    const accepted = results.filter((result) => result.accepted).length;
    const successRate = results.length ? accepted / results.length : 0;
    const p95 = results.length ? [...results].sort((a, b) => a.latency_ms - b.latency_ms)[Math.ceil(results.length * 0.95) - 1]?.latency_ms ?? 0 : 0;
    const status = successRate >= 0.98 && p95 <= 5000 ? "GREEN" : "YELLOW";
    const summary = writeScenarioSummary(SCENARIO, startedAt, results, ["C1", "C2"], status, `${(successRate * 100).toFixed(1)}% accepted over ${minutes} minutes, p95 ${p95}ms`);
    printSummary(summary);
}
runT8().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
