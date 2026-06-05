import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
let envLoaded = false;
function parseEnvFile(path) {
    if (!existsSync(path))
        return {};
    const parsed = {};
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1)
            continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        parsed[key] = value;
    }
    return parsed;
}
function applyEnv(path) {
    const parsed = parseEnvFile(path);
    for (const [key, value] of Object.entries(parsed)) {
        if (process.env[key] === undefined)
            process.env[key] = value;
    }
}
function findRepoRoot(start) {
    let current = resolve(start);
    for (let i = 0; i < 8; i += 1) {
        if (existsSync(join(current, "src")) && existsSync(join(current, "supabase"))) {
            return current;
        }
        const parent = dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return resolve(start, "../../..");
}
export function loadHarnessEnv() {
    const harnessDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const rootDir = findRepoRoot(process.cwd());
    if (!envLoaded) {
        applyEnv(join(rootDir, ".env"));
        applyEnv(join(rootDir, ".env.local"));
        applyEnv(join(harnessDir, ".env"));
        envLoaded = true;
    }
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
    const confirm = process.env.CONFIRM ?? "";
    const cooldownSeconds = Number(process.env.RESEND_COOLDOWN_SECONDS ?? "30");
    const budgetMax = Number(process.env.OTP_SEND_BUDGET_MAX ?? "2000");
    return {
        supabaseUrl,
        supabaseAnonKey,
        confirm,
        cooldownSeconds: Number.isFinite(cooldownSeconds) ? cooldownSeconds : 30,
        budgetMax: Number.isFinite(budgetMax) ? budgetMax : 2000,
        rootDir,
        harnessDir,
    };
}
export function requireHarnessEnv() {
    const env = loadHarnessEnv();
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
        throw new Error("Missing SUPABASE_URL/SUPABASE_ANON_KEY or VITE Supabase equivalents.");
    }
    if (env.supabaseAnonKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Refusing to use a service-role key. Provide the public anon key only.");
    }
    return env;
}
export function createAnonClient() {
    const env = requireHarnessEnv();
    return createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}
export function getBooleanEnv(name) {
    const value = process.env[name];
    return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}
export function getNumberEnv(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}
