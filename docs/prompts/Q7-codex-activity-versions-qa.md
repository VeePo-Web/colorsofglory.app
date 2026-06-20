<!-- RECONCILED TO READ-ONLY CODEX -->
> **⚠️ Codex is READ-ONLY** — see [`../CODEX-READONLY-QA-PLAN.md`](../CODEX-READONLY-QA-PLAN.md)
> (§17 Conflict Rule overrides this file). Codex does **not** write tests, CI, scripts, or
> commits. Treat the sections below as the **QA scope** for this feature; Codex delivers it
> as an **audit report** (templates §14; owner + severity per §9–§10), and the tests / CI /
> harness described are **implemented by Claude (frontend) or Lovable (backend)** when they
> build — never by Codex. The "Lane: `codex/*`" header is superseded: Codex has no branch by
> default and reports to `docs/codex-reports/` or `docs/codex-feature-audits/`.

# Q7 — CODEX: Activity + Versions QA
## Cluster 7/8 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Two high-trust guarantees to prove: the recap is **honest + calm**,
> and **no version is ever lost**. Codex lane only: tests, perf, a11y, QA docs. No
> feature/UI changes; file bugs.

## YOUR ROLE
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI/schema. Run
after Q1 (CI) + L7 + C6/C7. `docs/BUILD-PATHWAY.md`.

## CONTEXT
L7 backs activity (`song_activity`, deduped "since you left" digest, mark-seen) and
versions (`song_versions`, non-destructive restore, protected original). C6 = activity
feed, C7 = version timeline. Surfaces: `src/integrations/cog/activity.ts` + versions seam.

## OBJECTIVE
Prove the digest summarizes honestly and calmly, and that version restore is provably
non-destructive — at scale, member-scoped, accessible.

## TASKS — ACTIVITY
1. **Digest correctness:** given a stream of events, `getSinceYouLeft` returns the
   **deduped/aggregated** summary (10 edits of Verse 2 → one line; counts correct) and
   only events **since the user's last-seen**.
2. **Mark-seen:** after `markSeen`, the recap resets (no stale "new" items); concurrent
   viewers tracked independently.
3. **Calm guarantee:** no event-firehose leaks to the UI; "needs review" is a count, not
   spam; member-scoped (a non-member sees nothing).

## TASKS — VERSIONS
4. **Non-destructive restore (Critical):** restoring version N creates a **new** version
   from N; the prior current state still exists as its own version; history length grows,
   never shrinks. Test it explicitly.
5. **Protected original:** the first snapshot can't be deleted/overwritten; always present.
6. **Snapshot integrity:** a snapshot round-trips full song state (lyrics/sections/chords/
   arrangement/memo refs) — preview matches what was saved; diff summary is accurate.
7. **RLS:** only members read/restore a song's versions/activity.

## TASKS — SHARED
8. **Perf:** long activity lists + many versions render without thrash (virtualize/cheap).
9. **a11y:** feed + timeline keyboard-operable, labeled, reduced-motion, ≥44px.
10. **CI:** wire activity + versions tests into the Q1 gate.

## DELIVERABLES
1. Digest dedup/aggregation + since-last-seen tests. 2. Mark-seen reset tests.
3. Non-destructive-restore + protected-original tests (the headline). 4. Snapshot
round-trip + diff-accuracy tests. 5. RLS membership tests. 6. Perf + a11y. 7. CI wiring.

## ACCEPTANCE CRITERIA
- [ ] Digest is deduped/aggregated + scoped to since-last-seen; mark-seen resets it.
- [ ] Restore is proven non-destructive (history only grows); original is protected.
- [ ] Snapshot round-trips full state; diff summary accurate; member-scoped RLS holds.
- [ ] Perf + a11y verified; all activity/versions tests green in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file bugs for Claude/Lovable. No network tests
(mock the seam). `codex/activity-versions-qa` → merge → delete. A failing "version lost"
test is a release-blocking bug — never weaken it.

## REFERENCES
- `src/integrations/cog/activity.ts` + versions seam; tables `song_activity`, `song_versions`
- `docs/prompts/L7-…activity-versions.md`, `C6-…activity-feed.md`, `C7-…version-history.md`, `Q1-…ci-quality-gate.md`
- `docs/BUILD-PATHWAY.md`
