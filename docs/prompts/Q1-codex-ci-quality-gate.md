# Q1 — CODEX: CI Baseline + Quality Gate (keep `main` always green)
## Cluster 0 (Foundation) · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. This wires real enforcement around the QA work that already
> exists. Codex's lane only: CI, tests, scripts, perf, a11y, QA docs. Do **not**
> implement features (Claude), change schema/RLS (Lovable), or alter visual design.

---

## YOUR ROLE (do not overstep)

You are **Codex**, owner of the **quality gate**: CI, `src/test/*`, `scripts/*`,
Lighthouse, a11y, perf, regression, and the `docs/codex-*` reports. You verify and
gate other agents' work; you do not build features or design UI. Contract:
`docs/BUILD-PATHWAY.md`.

---

## CONTEXT

The repo has good QA *scripts* but **no enforcement**, which is the core reason
`main` keeps breaking after "many tries." Current state:

- `package.json` scripts: `typecheck` (`tsc -p tsconfig.app.json`), `lint`,
  `test` (vitest), `qa:codex` (`scripts/codex-qa-gate.mjs`), `qa:mobile`,
  `perf:budget` (`scripts/check-bundle-budget.mjs`).
- `scripts/codex-qa-gate.mjs` is a solid umbrella gate: runs commands + source
  scans (forbidden fly4me brand hits, old asset names, a11y checks, instant-feel,
  mobile-render routes, placeholder routes) and writes `docs/codex-qa-gate/latest.json`.
- Tests in `src/test/*` (capture, canvas, routing, seo, mobile-render, etc.).
- **No `.github/workflows/` — nothing runs any of this on push or PR.**
- Doc sprawl: 8 `docs/CODEX-AUDIT-*.md` files + stray logs committed
  (`docs/codex-feature-002-preview.*.log/.pid`).
- At least one **flaky test**: `src/test/feature04-canvas.test.tsx` times out under
  full-suite load (passes in isolation). A gate must be deterministic.

---

## OBJECTIVE

Make `main` **provably always green**: a single enforced CI pipeline that runs the
existing gate on every push and PR, a deterministic test suite, and a consolidated
QA report — so no agent's merge can break the trunk.

---

## TASKS

### 1. Wire CI enforcement (the missing piece)
- Add `.github/workflows/ci.yml` running on `push` and `pull_request` to `main`.
- Steps (fail the job on any non-zero): install (bun or npm per lockfile) →
  `typecheck` → `lint` → `test` → `build` → `perf:budget` → `qa:codex`.
- Cache deps; pin Node/bun; keep total runtime sane (< ~8 min).
- Upload `docs/codex-qa-gate/latest.json` (and any Lighthouse output) as a build artifact.

### 2. One umbrella gate
- Ensure a single `npm run qa:all` (or extend `qa:codex`) is the one command CI and
  humans run, chaining typecheck + lint + test + build + perf:budget + source scans.
- Keep the JSON report at `docs/codex-qa-gate/latest.json` as the machine-readable truth.

### 3. Stabilize the suite (a gate must be reliable)
- Root-cause the `feature04-canvas.test.tsx` timeout under load (raise `testTimeout`,
  reduce per-test setup cost, or fix the slow render). It must pass deterministically
  in the full run, not just in isolation.
- Sweep for other flakiness (timers, network, ordering). No `.skip` without a written
  reason + tracking note.

### 4. Branch protection (document for the user)
- Document the GitHub setting to **require CI green before merge to `main`** and to
  require branches up to date. (This is a repo setting the user enables; provide exact steps.)

### 5. Consolidate QA docs + remove stray artifacts
- Merge the 8 `docs/CODEX-AUDIT-*.md` into **one living** `docs/codex-qa-gate/REPORT.md`
  (history summarized, latest state on top); move the rest to `docs/archive/`.
- Remove committed run-logs from git (`docs/codex-feature-002-preview.*.log/.pid`,
  any `*.log`/`*.pid` artifacts) and add patterns to `.gitignore`.

### 6. The reusable QA checklist (for Q2–Q10)
- Produce `docs/codex-qa-gate/CHECKLIST.md`: the per-feature QA rubric Codex runs on
  every cluster (functional on iOS Safari, a11y, perf/CWV, regression, RLS-from-client
  where relevant) so Q2–Q10 are consistent.

---

## DELIVERABLES
1. `.github/workflows/ci.yml` — enforced on push + PR to `main`.
2. `npm run qa:all` umbrella (or extended `qa:codex`) wired into CI.
3. Deterministic test suite (flaky canvas test fixed; full `npm test` green repeatedly).
4. `docs/codex-qa-gate/REPORT.md` (consolidated) + archived old audit docs.
5. `.gitignore` updated for logs/pids; stray artifacts removed from git.
6. `docs/codex-qa-gate/CHECKLIST.md` — the reusable per-cluster QA rubric.
7. Branch-protection setup steps for the user.

---

## ACCEPTANCE CRITERIA
- [ ] CI runs on every push and PR to `main` and **fails red** on any gate failure.
- [ ] `npm test` passes deterministically 3× in a row (no flaky timeouts).
- [ ] One umbrella command runs the full gate locally and in CI.
- [ ] `main` is green at the end; the gate would have caught the kinds of breakage seen before.
- [ ] CODEX-AUDIT docs consolidated to one report; stray logs gone from git + ignored.
- [ ] Reusable QA checklist exists for Q2–Q10.

---

## CONSTRAINTS
- Codex lane only: CI, tests, scripts, perf, a11y, QA docs. **No feature code, no UI/design, no schema/RLS.**
- If a test reveals a product bug, **file it** (hand to Claude/Lovable) — don't fix the feature yourself.
- Work on `codex/ci-quality-gate` → merge to `main` → delete. Never weaken a gate to make it pass.
- Keep CI fast and deterministic; no network-dependent tests in the gate.

---

## REFERENCES
- `package.json` (scripts), `scripts/codex-qa-gate.mjs`, `scripts/codex-qa-config.mjs`, `scripts/check-bundle-budget.mjs`
- `src/test/*`, `vitest.config.ts`, `tsconfig.app.json`
- `docs/CODEX-AUDIT-*.md`, `docs/codex-qa-gate/`
- `docs/BUILD-PATHWAY.md` (role contract + git rules)
