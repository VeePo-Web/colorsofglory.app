import { createAnonClient } from "../supaClient.js";
import { loadTestNumbers, printSummary, verifyOtp, writeScenarioSummary, } from "../metrics.js";
const SCENARIO = "t4-verify-negative";
export async function runT4() {
    const startedAt = new Date().toISOString();
    const client = createAnonClient();
    const results = [];
    const numbers = loadTestNumbers().magic_numbers;
    for (const phone of numbers) {
        const cases = [
            ["wrong-code", "000000"],
            ["empty-code", ""],
            ["five-digit", "12345"],
            ["seven-digit", "1234567"],
            ["different-number-code", "123456"],
        ];
        for (const [name, token] of cases) {
            const targetPhone = name === "different-number-code" ? numbers[(numbers.indexOf(phone) + 1) % numbers.length] : phone;
            results.push(await verifyOtp(client, SCENARIO, targetPhone, token, `${name} for ${phone}`));
        }
    }
    const falseSessions = results.filter((result) => result.accepted).length;
    const status = falseSessions === 0 ? "GREEN" : "RED";
    const summary = writeScenarioSummary(SCENARIO, startedAt, results, ["C4"], status, `${falseSessions} false sessions issued across ${results.length} negative verifications`);
    printSummary(summary);
}
runT4().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
