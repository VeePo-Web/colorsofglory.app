import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A1 design-system DRIFT GUARD.
 *
 * The COG palette is single-sourced in `src/styles/tokens.css`. Every other file
 * in the design-system FOUNDATION lane must reference colors through CSS
 * variables (`var(--cog-*)`) or Tailwind tokens — never a raw brand hex. This
 * test fails the build the moment a raw brand hex is reintroduced into the
 * foundation, so no future change can silently drift the palette.
 *
 * SCOPE: this guards the foundation lane only (shadcn primitives, the motion
 * library, and src/styles). The wider app still carries legacy raw hex pending
 * the cross-lane purge (Step 6); widen SCAN_DIRS as those files are converted.
 */

const ROOT = process.cwd();

const SCAN_DIRS = ["src/components/ui", "src/lib/motion", "src/styles"];

// tokens.css is the ONE sanctioned home for canonical brand hex values.
const ALLOWLIST = new Set(["src/styles/tokens.css"]);

// Canonical COG brand hexes (incl. known drift values) + the signature gold rgba.
const BRAND_HEX =
  /#(?:FAFAF6|F5F0E8|EDE7DA|FAF7F2|B5935A|B8953A|B77722|D4AE5C|E8D5A0|1C1A17|1A1A1A|E05440|53AB8B|8070C4|C26A95)\b|rgba\(\s*184\s*,\s*149\s*,\s*58/i;

function walk(relDir: string): string[] {
  const abs = join(ROOT, relDir);
  let out: string[] = [];
  let names: string[];
  try {
    names = readdirSync(abs);
  } catch {
    return [];
  }
  for (const name of names) {
    const full = join(abs, name);
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (statSync(full).isDirectory()) out = out.concat(walk(rel));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(rel);
  }
  return out;
}

describe("design-system drift guard", () => {
  it("has no raw brand hex outside tokens.css in the foundation lane", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(dir)) {
        if (ALLOWLIST.has(file)) continue;
        const source = readFileSync(join(ROOT, file), "utf8");
        source.split(/\r?\n/).forEach((line, i) => {
          if (BRAND_HEX.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        });
      }
    }
    expect(
      offenders,
      `Raw brand hex found in the design-system foundation — reference var(--cog-*) tokens instead:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
