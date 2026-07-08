// Regenerates src/integrations/supabase/types.ts from the live Supabase schema.
//
// The generated file is the ROOT that every domain type in `@/types` derives
// from — it is NEVER hand-edited. This script runs the Supabase CLI, prepends a
// fixed "do not edit" banner, and writes the result in place.
//
// REQUIREMENTS (present in CI, NOT in local dev worktrees):
//   - the `supabase` CLI on PATH
//   - a linked project OR SUPABASE_ACCESS_TOKEN + project ref
// Live regeneration therefore runs in CI / Lovable, not in this worktree.
//
// Usage:
//   npm run types:gen     # regenerate in place
//   npm run types:check   # regenerate, then `git diff --exit-code` (staleness gate)
//
// The BANNER constant below is the SINGLE source of the banner text. Because it
// is deterministic, a fresh generation on an unchanged schema reproduces the
// committed file byte-for-byte, so `types:check` yields no diff.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID || "vsiecltcxsuuulbczexl";
const OUT_PATH = join(
  process.cwd(),
  "src",
  "integrations",
  "supabase",
  "types.ts",
);

// Keep in sync with the banner already committed at the top of types.ts.
const BANNER = `// ============================================================================
// GENERATED FILE — DO NOT EDIT.
// Generated from the Supabase schema (owned by Lovable) via the Supabase CLI.
// To update: run \`npm run types:gen\` (requires the supabase CLI + project access).
// This file is the ROOT that every domain type in \`@/types\` derives from.
// Hand-edits will be overwritten and are caught in CI by \`npm run types:check\`.
// ============================================================================
`;

function generate() {
  const cmd = `supabase gen types typescript --project-id ${PROJECT_ID} --schema public`;
  console.error(`[types:gen] running: ${cmd}`);
  let types;
  try {
    types = execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    console.error(
      "[types:gen] FAILED to run the Supabase CLI. Live regeneration requires " +
        "the `supabase` CLI on PATH and project access (SUPABASE_ACCESS_TOKEN " +
        "or a linked project). This runs in CI / Lovable, not local worktrees.",
    );
    process.exit(err.status || 1);
  }

  if (!types || !types.includes("export type Database")) {
    console.error(
      "[types:gen] Aborting: CLI output did not contain `export type Database`. " +
        "Refusing to overwrite types.ts with unexpected content.",
    );
    process.exit(1);
  }

  const normalized = types.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const output = `${BANNER}\n${normalized.replace(/^\n+/, "")}`;
  writeFileSync(OUT_PATH, output, "utf8");
  console.error(`[types:gen] wrote ${OUT_PATH}`);
}

generate();
