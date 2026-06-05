import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadHarnessEnv } from "./supaClient.js";
import { reportPath } from "./metrics.js";
const REQUIRED_CONFIRMATIONS = [
    ["SMS_PROVIDER_TWILIO_ENABLED", "Supabase Auth -> Phone provider = Twilio, ENABLED"],
    ["TWILIO_MESSAGING_SERVICE_CONFIGURED", "Twilio Messaging Service SID configured"],
    ["A2P_10DLC_APPROVED", "A2P 10DLC campaign registered + APPROVED"],
    ["SMS_PUMPING_PROTECTION_ON", "SMS Pumping Protection: ON"],
    ["GEO_PERMISSIONS_US_CA_ONLY", "Geo Permissions: only US + CA enabled"],
    ["TEST_OTPS_CONFIGURED", "Test OTPs +15555550100..+15555550119 -> 123456 configured"],
];
const SCENARIO_COMMANDS = [
    ["t1-baseline-send", "reports/.dist/scenarios/t1-baseline-send.js"],
    ["t2-burst-send", "reports/.dist/scenarios/t2-burst-send.js"],
    ["t3-verify-happy", "reports/.dist/scenarios/t3-verify-happy.js"],
    ["t4-verify-negative", "reports/.dist/scenarios/t4-verify-negative.js"],
    ["t5-cooldown-probe", "reports/.dist/scenarios/t5-cooldown-probe.js"],
    ["t6-abuse-sim", "reports/.dist/scenarios/t6-abuse-sim.js"],
    ["t8-soak", "reports/.dist/scenarios/t8-soak.js"],
];
function truthyEnv(name) {
    const value = process.env[name];
    return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}
function runPreflight() {
    const env = loadHarnessEnv();
    const checks = [
        {
            label: "SUPABASE_URL and SUPABASE_ANON_KEY readable from .env",
            ok: Boolean(env.supabaseUrl && env.supabaseAnonKey),
            detail: env.supabaseUrl && env.supabaseAnonKey ? "found" : "missing",
        },
        ...REQUIRED_CONFIRMATIONS.map(([name, label]) => ({
            label,
            ok: truthyEnv(name),
            detail: `${name}=${process.env[name] ?? ""}`,
        })),
        {
            label: "Resend cooldown documented",
            ok: Number.isFinite(env.cooldownSeconds) && env.cooldownSeconds > 0,
            detail: `${env.cooldownSeconds}s`,
        },
        {
            label: 'Operator typed "I CONFIRM SANDBOX" into CONFIRM env var',
            ok: env.confirm === "I CONFIRM SANDBOX",
            detail: env.confirm ? "provided" : "missing",
        },
    ];
    console.log("OTP preflight (zero sends)");
    console.log("--------------------------");
    for (const check of checks) {
        console.log(`${check.ok ? "[ok]" : "[missing]"} ${check.label} (${check.detail})`);
    }
    const failed = checks.filter((check) => !check.ok);
    if (failed.length > 0) {
        const body = [
            "# OTP Preflight Blocked",
            "",
            "No SMS sends were made.",
            "",
            "Fix or confirm these items before running send-capable scenarios:",
            "",
            ...failed.map((check) => `- ${check.label} (${check.detail})`),
            "",
            "Run again:",
            "",
            "```bash",
            "npm run preflight",
            "```",
            "",
        ].join("\n");
        writeFileSync(reportPath("preflight-blocked.md"), body);
        return false;
    }
    writeFileSync(reportPath("preflight-ok.md"), `# OTP Preflight OK\n\nNo SMS sends were made.\n\nGenerated: ${new Date().toISOString()}\n`);
    return true;
}
function runScenario(script) {
    const result = spawnSync(process.execPath, [script], {
        cwd: loadHarnessEnv().harnessDir,
        stdio: "inherit",
        env: process.env,
    });
    return result.status ?? 1;
}
function loadScenarioSummary(name) {
    const path = reportPath(`${name}.json`);
    if (!existsSync(path))
        return null;
    return JSON.parse(readFileSync(path, "utf8"));
}
function collectErrorCounts(summaries) {
    const counts = new Map();
    for (const summary of summaries) {
        for (const bucket of [summary.rejected_by_supabase, summary.rejected_by_twilio_via_supabase]) {
            for (const [code, count] of Object.entries(bucket)) {
                counts.set(code, (counts.get(code) ?? 0) + count);
            }
        }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}
function claimRows(summaries) {
    const byClaim = new Map();
    for (const summary of summaries) {
        for (const claim of summary.claims_touched) {
            byClaim.set(claim, [...(byClaim.get(claim) ?? []), summary]);
        }
    }
    const claims = ["C1", "C2", "C3", "C4", "C5"];
    return claims.map((claim) => {
        const touched = byClaim.get(claim) ?? [];
        const red = touched.find((summary) => summary.status === "RED");
        const skipped = touched.find((summary) => summary.status === "SKIPPED");
        const yellow = touched.find((summary) => summary.status === "YELLOW");
        const green = touched.find((summary) => summary.status === "GREEN");
        const deciding = red ?? yellow ?? skipped ?? green;
        const status = red ? "RED" : yellow ? "YELLOW" : skipped && !green ? "YELLOW" : green ? "GREEN" : "YELLOW";
        return `| ${claim} | ${status} | ${deciding?.deciding_metric ?? "not exercised"} | ${deciding?.scenario ?? "none"} |`;
    });
}
function writeSummary() {
    const summaries = SCENARIO_COMMANDS
        .map(([name]) => loadScenarioSummary(name))
        .filter((summary) => Boolean(summary));
    const topErrors = collectErrorCounts(summaries);
    const latestBudget = summaries.at(-1);
    const body = [
        "# OTP Stress Summary",
        "",
        `Generated: ${new Date().toISOString()}`,
        "",
        "| Claim | Status | Deciding metric | Source scenario |",
        "|---|---:|---|---|",
        ...claimRows(summaries),
        "",
        "## Top Error Codes",
        "",
        ...(topErrors.length
            ? topErrors.map(([code, count]) => `- ${code}: ${count}`)
            : ["- None observed"]),
        "",
        "## Budget",
        "",
        `Used: ${latestBudget?.twilio_send_budget_used ?? 0} / 2000`,
        "",
        "## Operator Action Items",
        "",
        "- If preflight is blocked, finish the Supabase Auth/Twilio dashboard checklist first.",
        "- If T2 is skipped, add enough allowed test numbers for the configured cooldown or lower RPS.",
        "- If abuse sends are accepted, tighten Geo Permissions and SMS Pumping Protection before production.",
        "- If p95 send latency is red, inspect Supabase Auth logs and Twilio messaging service queue health.",
        "",
        "## Reproduction Commands",
        "",
        "```bash",
        "npm run preflight",
        "npm run t1",
        "npm run t2",
        "npm run t3",
        "npm run t4",
        "npm run t5",
        "npm run t6",
        "npm run t8",
        "npm run all",
        "```",
        "",
    ].join("\n");
    writeFileSync(reportPath("SUMMARY.md"), body);
}
async function main() {
    const mode = process.argv[2] ?? "all";
    if (mode === "preflight") {
        runPreflight();
        return;
    }
    if (mode !== "all") {
        throw new Error(`Unknown run-all mode: ${mode}`);
    }
    if (!runPreflight())
        return;
    for (const [name, script] of SCENARIO_COMMANDS) {
        console.log(`\n--- ${name} ---`);
        const status = runScenario(script);
        if (status !== 0) {
            console.error(`${name} exited with ${status}; stopping run-all.`);
            writeSummary();
            process.exit(status);
        }
        if (name !== SCENARIO_COMMANDS.at(-1)?.[0]) {
            console.log("Cooling down for 60 seconds before the next scenario...");
            await new Promise((resolve) => setTimeout(resolve, 60_000));
        }
    }
    writeSummary();
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
