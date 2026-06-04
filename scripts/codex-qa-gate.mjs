import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  accessibilitySourceChecks,
  findForbiddenBrandHits,
  findOldAssetFilenameHits,
  instantFeelSourceChecks,
  mobileRenderRoutes,
  placeholderRouteFiles,
  qaRoutes,
  sourceScanTargets,
  textFileExtensions,
} from "./codex-qa-config.mjs";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const isWindows = process.platform === "win32";
const reportDir = join(process.cwd(), "docs", "codex-qa-gate");
const reportPath = join(reportDir, "latest.json");

const results = [];
const findings = [];

function record(name, status, details = "") {
  results.push({ name, status, details });
  const marker = status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
  console.log(`[${marker}] ${name}${details ? ` - ${details}` : ""}`);
}

function runCommand(name, args) {
  console.log(`\n> ${npmCommand} ${args.join(" ")}`);
  const result = isWindows
    ? spawnSync([npmCommand, ...args].join(" "), {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      })
    : spawnSync(npmCommand, args, {
        cwd: process.cwd(),
        stdio: "inherit",
      });

  if (result.status === 0) {
    record(name, "pass");
    return true;
  }

  record(name, "fail", result.error?.message ?? `exit ${result.status ?? "unknown"}`);
  return false;
}

function walkFiles(target) {
  const absolute = join(process.cwd(), target);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [absolute];

  const files = [];
  const stack = [absolute];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
      } else {
        files.push(child);
      }
    }
  }
  return files;
}

function relativePath(path) {
  return path.replace(`${process.cwd()}\\`, "").replaceAll("\\", "/");
}

function runOldBrandScan() {
  const contentHits = [];
  const filenameHits = [];

  for (const target of sourceScanTargets) {
    for (const file of walkFiles(target)) {
      const rel = relativePath(file);
      for (const hit of findOldAssetFilenameHits(rel)) {
        filenameHits.push({ file: rel, hit });
      }

      if (!textFileExtensions.has(extname(file))) continue;
      const text = readFileSync(file, "utf8");
      for (const hit of findForbiddenBrandHits(text)) {
        contentHits.push({ file: rel, hit });
      }
    }
  }

  if (contentHits.length > 0) {
    findings.push({
      severity: "P0",
      title: "Old-brand content is still present in app/public source.",
      details: contentHits,
    });
    record("Old-brand content scan", "fail", `${contentHits.length} content hits`);
    return false;
  }

  record("Old-brand content scan", "pass");

  if (filenameHits.length > 0) {
    findings.push({
      severity: "P2",
      title: "Legacy asset filenames remain in src/public and should be removed before release.",
      details: filenameHits.slice(0, 40),
      total: filenameHits.length,
    });
    record("Legacy asset filename scan", "warn", `${filenameHits.length} filename hits`);
  } else {
    record("Legacy asset filename scan", "pass");
  }

  return true;
}

function runSourcePatternChecks(name, checks, failureStatus = "fail") {
  let ok = true;
  const misses = [];

  for (const check of checks) {
    const absolute = join(process.cwd(), check.file);
    const text = existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
    if (!check.pattern.test(text)) {
      ok = false;
      misses.push(check);
    }
  }

  if (ok) {
    record(name, "pass");
    return true;
  }

  findings.push({
    severity: failureStatus === "warn" ? "P2" : "P1",
    title: `${name} missed expected source checks.`,
    details: misses.map((miss) => ({ file: miss.file, label: miss.label })),
  });
  record(name, failureStatus, `${misses.length} misses`);
  return failureStatus !== "fail";
}

function runPlaceholderScan() {
  const hits = [];
  for (const file of placeholderRouteFiles) {
    const absolute = join(process.cwd(), file);
    if (!existsSync(absolute)) continue;
    const text = readFileSync(absolute, "utf8");
    if (/coming soon/i.test(text)) {
      hits.push(file);
    }
  }

  if (hits.length > 0) {
    findings.push({
      severity: "P1",
      title: "Reachable routes still render coming-soon placeholders.",
      details: hits,
    });
    record("Placeholder route scan", "warn", `${hits.length} reachable placeholder files`);
  } else {
    record("Placeholder route scan", "pass");
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopPreviewServer(child) {
  if (child.exitCode !== null) return;

  if (isWindows && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
}

async function waitForPreview(baseUrl, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) {
      throw new Error(`Preview server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await wait(300);
    }
  }
  throw new Error("Timed out waiting for Vite preview");
}

async function runRouteSmoke() {
  const port = 4177;
  const baseUrl = `http://127.0.0.1:${port}`;
  const previewArgs = ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  const child = isWindows
    ? spawn([npmCommand, ...previewArgs].join(" "), {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      })
    : spawn(npmCommand, previewArgs, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(String(chunk)));
  child.stderr.on("data", (chunk) => logs.push(String(chunk)));

  try {
    await waitForPreview(baseUrl, child);
    const failures = [];

    for (const route of qaRoutes) {
      const response = await fetch(`${baseUrl}${route.path}`);
      const body = await response.text();
      if (response.status !== 200 || !body.includes('<div id="root">')) {
        failures.push({ route, status: response.status });
      }
    }

    if (failures.length > 0) {
      findings.push({
        severity: "P1",
        title: "Production preview route smoke failed.",
        details: failures,
      });
      record("Production preview route smoke", "fail", `${failures.length} failed routes`);
      return false;
    }

    record("Production preview route smoke", "pass", `${qaRoutes.length} routes`);
    return true;
  } catch (error) {
    findings.push({
      severity: "P1",
      title: "Production preview route smoke could not run.",
      details: { message: error instanceof Error ? error.message : String(error), logs: logs.join("") },
    });
    record("Production preview route smoke", "fail", error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    stopPreviewServer(child);
  }
}

function writeReport() {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        routesChecked: qaRoutes,
        mobileRenderRoutes,
        results,
        findings,
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  console.log("Codex QA Gate v1");
  console.log("================");

  const hardChecks = [
    runCommand("lint", ["run", "lint"]),
    runCommand("typecheck", ["run", "typecheck"]),
    runCommand("build", ["run", "build"]),
    runCommand("test", ["run", "test"]),
    runCommand("bundle budget", ["run", "perf:budget"]),
    runOldBrandScan(),
    runSourcePatternChecks("basic accessibility source checks", accessibilitySourceChecks),
    runSourcePatternChecks("instant-feel source checks", instantFeelSourceChecks),
  ];

  runPlaceholderScan();
  hardChecks.push(await runRouteSmoke());

  writeReport();
  console.log(`\nReport written to ${reportPath}`);

  if (hardChecks.every(Boolean)) {
    console.log("\nCodex QA Gate v1 passed hard checks.");
    return;
  }

  console.error("\nCodex QA Gate v1 failed hard checks.");
  process.exit(1);
}

main().catch((error) => {
  record("Codex QA Gate runtime", "fail", error instanceof Error ? error.message : String(error));
  writeReport();
  process.exit(1);
});
