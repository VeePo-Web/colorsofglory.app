import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadHarnessEnv } from "./supaClient.js";
const REPORTS_DIR = join(loadHarnessEnv().harnessDir, "reports");
const BUDGET_FILE = join(REPORTS_DIR, "budget-state.json");
export function ensureReportsDir() {
    mkdirSync(REPORTS_DIR, { recursive: true });
}
export function reportPath(name) {
    ensureReportsDir();
    return join(REPORTS_DIR, name);
}
export function loadTestNumbers() {
    const path = join(loadHarnessEnv().harnessDir, "test-numbers.json");
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed;
}
export function maskPhone(phone) {
    if (!phone.startsWith("+") || phone.length < 8)
        return "[invalid]";
    const visibleStart = phone.slice(0, 5);
    const visibleEnd = phone.slice(-4);
    return `${visibleStart}***${visibleEnd}`;
}
function readBudgetUsed() {
    ensureReportsDir();
    if (!existsSync(BUDGET_FILE))
        return 0;
    try {
        const parsed = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
        return typeof parsed.used === "number" ? parsed.used : 0;
    }
    catch {
        return 0;
    }
}
function writeBudgetUsed(used) {
    writeFileSync(BUDGET_FILE, JSON.stringify({ used, updated_at: new Date().toISOString() }, null, 2));
}
export class SendBudget {
    max;
    used;
    constructor(max = loadHarnessEnv().budgetMax) {
        this.max = max;
        this.used = readBudgetUsed();
    }
    get usedCount() {
        return this.used;
    }
    get remaining() {
        return Math.max(0, this.max - this.used);
    }
    canReserve(count) {
        return this.used + count <= this.max;
    }
    reserve(count) {
        if (!this.canReserve(count)) {
            throw new Error(`OTP send budget exhausted: ${this.used}/${this.max}, requested ${count}.`);
        }
        this.used += count;
        writeBudgetUsed(this.used);
    }
}
export function quantile(values, q) {
    if (values.length === 0)
        return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    return Math.round(next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]));
}
function errorIdentity(result) {
    return result.error_code ?? (result.status ? String(result.status) : "unknown_error");
}
function isTwilioViaSupabase(result) {
    const text = `${result.error_code ?? ""} ${result.error_message ?? ""}`.toLowerCase();
    return text.includes("twilio") || text.includes("provider") || text.includes("sms provider");
}
function countErrors(results, twilio) {
    const counts = {};
    for (const result of results) {
        if (result.accepted)
            continue;
        if (isTwilioViaSupabase(result) !== twilio)
            continue;
        const key = errorIdentity(result);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
}
export function appendJsonl(scenario, result) {
    appendFileSync(reportPath(`${scenario}.jsonl`), `${JSON.stringify(result)}\n`);
}
export function writeCsv(scenario, results) {
    const rows = [
        "scenario,kind,masked_phone,accepted,status,error_code,latency_ms,note",
        ...results.map((result) => [
            result.scenario,
            result.kind,
            result.masked_phone,
            String(result.accepted),
            String(result.status ?? ""),
            result.error_code ?? "",
            String(result.latency_ms),
            (result.note ?? "").replaceAll(",", " "),
        ].join(",")),
    ];
    writeFileSync(reportPath(`${scenario}.csv`), `${rows.join("\n")}\n`);
}
export function writeScenarioSummary(scenario, startedAt, results, claimsTouched, status, decidingMetric, skippedReason) {
    const budget = new SendBudget();
    const latencies = results.map((result) => result.latency_ms);
    const summary = {
        scenario,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        total_requests: results.length,
        accepted: results.filter((result) => result.accepted).length,
        rejected_by_supabase: countErrors(results, false),
        rejected_by_twilio_via_supabase: countErrors(results, true),
        latency_ms: {
            p50: quantile(latencies, 0.5),
            p95: quantile(latencies, 0.95),
            p99: quantile(latencies, 0.99),
            max: latencies.length ? Math.max(...latencies) : 0,
        },
        twilio_send_budget_used: budget.usedCount,
        twilio_send_budget_remaining: budget.remaining,
        claims_touched: claimsTouched,
        status,
        deciding_metric: decidingMetric,
        skipped_reason: skippedReason,
    };
    writeFileSync(reportPath(`${scenario}.json`), JSON.stringify(summary, null, 2));
    writeCsv(scenario, results);
    return summary;
}
export function writeSkippedScenario(scenario, claimsTouched, reason) {
    const startedAt = new Date().toISOString();
    return writeScenarioSummary(scenario, startedAt, [], claimsTouched, "SKIPPED", reason, reason);
}
function captureError(error) {
    const shaped = error;
    return {
        status: typeof shaped?.status === "number" ? shaped.status : null,
        error_code: typeof shaped?.code === "string" ? shaped.code : typeof shaped?.name === "string" ? shaped.name : null,
        error_message: typeof shaped?.message === "string" ? shaped.message : String(error),
    };
}
export async function sendOtp(client, scenario, phone, budget, note) {
    budget.reserve(1);
    const started = new Date();
    const t0 = performance.now();
    try {
        const { error } = await client.auth.signInWithOtp({ phone });
        const result = {
            scenario,
            kind: "send",
            phone,
            masked_phone: maskPhone(phone),
            started_at: started.toISOString(),
            latency_ms: Math.round(performance.now() - t0),
            accepted: !error,
            status: error?.status ?? null,
            error_code: error?.code ?? null,
            error_message: error?.message ?? null,
            note,
        };
        appendJsonl(scenario, result);
        return result;
    }
    catch (error) {
        const captured = captureError(error);
        const result = {
            scenario,
            kind: "send",
            phone,
            masked_phone: maskPhone(phone),
            started_at: started.toISOString(),
            latency_ms: Math.round(performance.now() - t0),
            accepted: false,
            ...captured,
            note,
        };
        appendJsonl(scenario, result);
        return result;
    }
}
export async function verifyOtp(client, scenario, phone, token, note) {
    const started = new Date();
    const t0 = performance.now();
    try {
        const { data, error } = await client.auth.verifyOtp({ phone, token, type: "sms" });
        const result = {
            scenario,
            kind: "verify",
            phone,
            masked_phone: maskPhone(phone),
            started_at: started.toISOString(),
            latency_ms: Math.round(performance.now() - t0),
            accepted: !error && Boolean(data.session),
            status: error?.status ?? null,
            error_code: error?.code ?? null,
            error_message: error?.message ?? null,
            note,
        };
        appendJsonl(scenario, result);
        return result;
    }
    catch (error) {
        const captured = captureError(error);
        const result = {
            scenario,
            kind: "verify",
            phone,
            masked_phone: maskPhone(phone),
            started_at: started.toISOString(),
            latency_ms: Math.round(performance.now() - t0),
            accepted: false,
            ...captured,
            note,
        };
        appendJsonl(scenario, result);
        return result;
    }
}
export function printSummary(summary) {
    console.log(`${summary.scenario}: ${summary.status}`);
    console.log(`  total=${summary.total_requests} accepted=${summary.accepted}`);
    console.log(`  latency p95=${summary.latency_ms.p95}ms max=${summary.latency_ms.max}ms`);
    console.log(`  budget=${summary.twilio_send_budget_used}/2000`);
    console.log(`  deciding=${summary.deciding_metric}`);
}
