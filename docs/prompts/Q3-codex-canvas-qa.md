# Q3 — CODEX: Canvas QA + Performance
## Cluster 2 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Gate the canvas after C1's restructure. Codex lane only: tests,
> perf, a11y, QA docs. No feature/UI changes; file bugs for Claude.

## YOUR ROLE
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI/schema.
`docs/BUILD-PATHWAY.md`. Run after Q1 (CI) + C1 (canvas cleanup).

## CONTEXT
The canvas was the weakest area (god component, two data models, sessionStorage mock,
seam violation, nav overload — see `docs/prompts/C1-claude-canvas-cleanup.md` and the
live findings in `docs/MOBILE-AUDIT-FINDINGS.md`). After C1 restructures it, lock it in.
Existing test: `src/test/feature04-canvas.test.tsx` (flaky under load — Q1 stabilizes).

## OBJECTIVE
Prove the restructured canvas is correct, smooth on mobile, and regression-proof.

## TASKS
1. **Structural guards (tests/lint):** assert **one** canvas data model (no local
   `CanvasCard`), and **no** `@/integrations/supabase/client` import under
   `src/components/canvas/*` or `src/lib/canvas/*` (a grep/lint rule in CI).
2. **Drag performance:** measure that node drag is transform/opacity + RAF only; no
   layout thrash; 60fps target on a mid-tier mobile profile. Document method + result.
3. **Persistence:** integration test that node positions survive reload via the seam
   (not sessionStorage).
4. **Render correctness:** canvas renders real `canvas_cards`/`song_sections` (or the
   defined adapter); empty/first-run state; many-cards stress (e.g. 40+).
5. **Mobile UX checks:** the `MOBILE-AUDIT-FINDINGS.md` items — no duplicate record FAB
   on canvas, nav not duplicated, tap targets ≥44px — encoded as assertions where feasible.
6. **Stabilize + wire:** fix/della-flake `feature04-canvas.test.tsx`; ensure all canvas
   tests run in the Q1 CI gate.

## DELIVERABLES
1. Structural lint/test guards (one model; no raw supabase in canvas).
2. Drag-perf report (`docs/codex-qa-gate/canvas-perf.md`).
3. Position-persistence + render/empty/stress tests; flaky test fixed.
4. Mobile-finding regressions encoded; canvas wired into CI.

## ACCEPTANCE CRITERIA
- [ ] CI fails if a 2nd canvas data model or a raw supabase import reappears in canvas.
- [ ] Drag is RAF/transform-only; documented 60fps on mid-tier mobile.
- [ ] Positions persist via seam (test-proven); empty + 40-card states pass.
- [ ] `feature04-canvas` deterministic; all canvas tests in CI green.

## CONSTRAINTS
Codex lane only — no canvas feature/UI edits; file product bugs for Claude. No
network tests. `codex/canvas-qa` → merge → delete. Never weaken a gate.

## REFERENCES
- `src/components/canvas/*`, `src/lib/canvas/*`, `src/test/feature04-canvas.test.tsx`
- `docs/prompts/C1-claude-canvas-cleanup.md`, `docs/prompts/Q1-codex-ci-quality-gate.md`
- `docs/MOBILE-AUDIT-FINDINGS.md`, `docs/BUILD-PATHWAY.md`
