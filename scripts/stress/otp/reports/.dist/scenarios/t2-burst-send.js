import { CooldownTracker, sleep } from "../cooldown.js";
import { createAnonClient, getNumberEnv, loadHarnessEnv } from "../supaClient.js";
import { SendBudget, loadTestNumbers, printSummary, sendOtp, writeScenarioSummary, writeSkippedScenario, } from "../metrics.js";
const SCENARIO = "t2-burst-send";
export async function runT2() {
    const env = loadHarnessEnv();
    const rps = getNumberEnv("OTP_T2_RPS", 20);
    const durationSeconds = getNumberEnv("OTP_T2_DURATION_SECONDS", 60);
    const numbers = loadTestNumbers().magic_numbers;
    const requiredNumbers = CooldownTracker.requiredRotationSize(rps, env.cooldownSeconds);
    const totalRequests = Math.round(rps * durationSeconds);
    const budget = new SendBudget();
    if (numbers.length < requiredNumbers) {
        const summary = writeSkippedScenario(SCENARIO, ["C2", "C5"], `blocked before send: ${rps} RPS with ${env.cooldownSeconds}s cooldown requires ${requiredNumbers} allowed test numbers; only ${numbers.length} are configured`);
        printSummary(summary);
        return;
    }
    if (!budget.canReserve(totalRequests)) {
        const summary = writeSkippedScenario(SCENARIO, ["C2"], `remaining budget ${budget.remaining} is below required ${totalRequests}`);
        printSummary(summary);
        return;
    }
    const startedAt = new Date().toISOString();
    const client = createAnonClient();
    const cooldown = new CooldownTracker(env.cooldownSeconds * 1000);
    const results = [];
    const inflight = [];
    const intervalMs = 1000 / rps;
    for (let i = 0; i < totalRequests; i += 1) {
        const phone = numbers[i % numbers.length];
        if (!cooldown.canSend(phone)) {
            throw new Error(`Cooldown guard failed for ${phone}; this would violate the server-side resend cooldown.`);
        }
        cooldown.markSent(phone);
        inflight.push(sendOtp(client, SCENARIO, phone, budget, `burst index ${i}`).then((result) => {
            results.push(result);
        }));
        await sleep(intervalMs);
    }
    await Promise.all(inflight);
    const accepted = results.filter((result) => result.accepted).length;
    const successRate = results.length ? accepted / results.length : 0;
    const has5xx = results.some((result) => typeof result.status === "number" && result.status >= 500);
    const p95 = results.length ? [...results].sort((a, b) => a.latency_ms - b.latency_ms)[Math.ceil(results.length * 0.95) - 1]?.latency_ms ?? 0 : 0;
    const status = successRate >= 0.98 && !has5xx && p95 <= 5000 ? "GREEN" : "RED";
    const summary = writeScenarioSummary(SCENARIO, startedAt, results, ["C2", "C5"], status, `${(successRate * 100).toFixed(1)}% accepted, p95 ${p95}ms, 5xx=${has5xx}`);
    printSummary(summary);
}
runT2().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
