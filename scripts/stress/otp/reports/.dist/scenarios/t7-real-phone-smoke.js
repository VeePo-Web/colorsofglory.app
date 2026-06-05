import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAnonClient, getBooleanEnv } from "../supaClient.js";
import { SendBudget, printSummary, sendOtp, verifyOtp, writeScenarioSummary, writeSkippedScenario, } from "../metrics.js";
const SCENARIO = "t7-real-phone-smoke";
export async function runT7() {
    const phone = process.env.REAL_PHONE_E164 ?? "";
    if (!getBooleanEnv("REAL_PHONE_OPT_IN") || !phone.startsWith("+")) {
        const summary = writeSkippedScenario(SCENARIO, ["C1", "C3"], "REAL_PHONE_OPT_IN=1 and REAL_PHONE_E164 are required");
        printSummary(summary);
        return;
    }
    const rl = createInterface({ input, output });
    const confirm = await rl.question(`Type YES to send exactly one OTP to the configured real phone: `);
    if (confirm !== "YES") {
        rl.close();
        const summary = writeSkippedScenario(SCENARIO, ["C1", "C3"], "operator did not type YES");
        printSummary(summary);
        return;
    }
    const budget = new SendBudget();
    if (!budget.canReserve(1)) {
        rl.close();
        const summary = writeSkippedScenario(SCENARIO, ["C1", "C3"], "send budget exhausted");
        printSummary(summary);
        return;
    }
    const startedAt = new Date().toISOString();
    const client = createAnonClient();
    const results = [];
    results.push(await sendOtp(client, SCENARIO, phone, budget, "guarded real phone smoke"));
    if (results[0]?.accepted) {
        const code = await rl.question("Enter the received 6-digit code: ");
        results.push(await verifyOtp(client, SCENARIO, phone, code.trim(), "operator-entered code"));
    }
    rl.close();
    const status = results.length === 2 && results.every((result) => result.accepted) ? "GREEN" : "RED";
    const summary = writeScenarioSummary(SCENARIO, startedAt, results, ["C1", "C3"], status, `${results.filter((result) => result.accepted).length}/${results.length} real-phone steps accepted`);
    printSummary(summary);
}
runT7().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
