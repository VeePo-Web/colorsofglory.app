# Q8 — CODEX: Credits QA
## Cluster 9 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Credits must be **accurate, fair, and owner-gated** — and the export
> must be correct (people may rely on it for splits). Codex lane only: tests, perf, a11y,
> QA docs. No feature/UI changes; file bugs.

## YOUR ROLE
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI/schema. Run
after Q1 (CI) + L8 + C8. `docs/BUILD-PATHWAY.md`.

## CONTEXT
L8 builds the ledger from L7 activity (de-duplicated), allows owner curation, optional
splits (sum 100%), and export (PDF + CSV/JSON). C8 renders it. Surfaces:
`src/integrations/cog/ledger.ts`, table `credit_ledger`.

## OBJECTIVE
Prove credits are derived correctly, curation is owner-only, splits validate, and exports
are accurate — at scale, member-scoped, accessible.

## TASKS
1. **Derivation accuracy:** given an activity stream, the ledger produces the right
   de-duplicated contribution lines per contributor (no missing/phantom contributions).
2. **Owner-gated curation (RLS-from-client):** a non-owner cannot add/edit/re-attribute or
   set splits — denied by the **database**, not just the UI; owner can; edits audited.
3. **Split math:** when splits are used, the API rejects totals ≠ 100%; acknowledgment-only
   mode (no splits) works.
4. **Export integrity:** the exported PDF + CSV/JSON contain the correct names, roles,
   contributions, splits, song title, date; signed URL is member-scoped + expiring.
5. **RLS:** members read the ledger; non-members see nothing.
6. **a11y + perf:** credits list keyboard-operable, labeled, ≥44px; large rosters render fine.
7. **CI:** wire credits tests into the Q1 gate.

## DELIVERABLES
1. Derivation-accuracy tests. 2. Owner-gated curation (RLS-from-client) tests. 3. Split
100% validation tests. 4. Export-integrity tests (PDF/CSV content + signed URL). 5. RLS
membership tests. 6. a11y/perf. 7. CI wiring.

## ACCEPTANCE CRITERIA
- [ ] Ledger lines match the activity stream (de-duplicated, complete, no phantoms).
- [ ] Non-owner curation/splits denied by the DB; owner edits audited.
- [ ] Splits reject ≠100%; acknowledgment-only mode works.
- [ ] Export content is correct; signed URL member-scoped + expiring.
- [ ] a11y/perf verified; credits tests green in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file bugs for Claude/Lovable. Secrets in CI env.
No network tests (mock seam/export). `codex/credits-qa` → merge → delete. A wrong-credit
or non-owner-edit pass is a real bug — never weaken it.

## REFERENCES
- `src/integrations/cog/ledger.ts`; table `credit_ledger`
- `docs/prompts/L8-…credits-ledger.md`, `C8-…credits-ui.md`, `L7-…activity-versions.md`, `Q1-…ci-quality-gate.md`
- `docs/BUILD-PATHWAY.md`
