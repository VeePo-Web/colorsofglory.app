import { createAnonClient, loadHarnessEnv } from "../supaClient.js";
import { SendBudget, loadTestNumbers, printSummary, sendOtp, writeScenarioSummary, writeSkippedScenario, } from "../metrics.js";
import { sleep } from "../cooldown.js";
const SCENARIO = "t5-cooldown-probe";
async function waitUntil(startMs, seconds) {
    const target = startMs + seconds * 1000;
    const remaining = target - Date.now();
    if (remaining > 0)
        await sleep(remaining);
}
export async function runT5() {
    const env = loadHarnessEnv();
    const attemptsAtSeconds = [0, 5, 15, 25, 31];
    const worstCase = 1 + attemptsAtSeconds.length;
    const budget = new SendBudget();
    if (!budget.canReserve(worstCase)) {
        const summary = writeSkippedScenario(SCENARIO, ["C5"], `remaining budget ${budget.remaining} is below required ${worstCase}`);
        printSummary(summary);
        return;
    }
    const startedAt = new Date().toISOString();
    const client = createAnonClient();
    const phone = loadTestNumbers().magic_numbers[0];
    const results = [];
    const startMs = Date.now();
    results.push(await sendOtp(client, SCENARIO, phone, budget, "initial send"));
    for (const seconds of attemptsAtSeconds) {
        await waitUntil(startMs, seconds);
        results.push(await sendOtp(client, SCENARIO, phone, budget, `resend at ${seconds}s`));
    }
    const resendResults = results.slice(1);
    const firstSuccess = resendResults.find((result) => result.accepted);
    const firstSuccessNote = firstSuccess?.note ?? "";
    const firstSuccessSeconds = Number(firstSuccessNote.match(/(\d+)s/)?.[1] ?? "0");
    const lowerBound = Math.max(0, env.cooldownSeconds - 3);
    const upperBound = env.cooldownSeconds + 3;
    const status = firstSuccessSeconds >= lowerBound && firstSuccessSeconds <= upperBound ? "GREEN" : "RED";
    const summary = writeScenarioSummary(SCENARIO, startedAt, results, ["C5"], status, firstSuccess
        ? `first resend success at ${firstSuccessSeconds}s; expected ${env.cooldownSeconds}s +/- 3s`
        : `no resend success observed by ${attemptsAtSeconds.at(-1)}s`);
    printSummary(summary);
}
runT5().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
