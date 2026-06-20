<!-- RECONCILED TO READ-ONLY CODEX -->
> **⚠️ Codex is READ-ONLY** — see [`../CODEX-READONLY-QA-PLAN.md`](../CODEX-READONLY-QA-PLAN.md)
> (§17 Conflict Rule overrides this file). Codex does **not** write tests, CI, scripts, or
> commits. Treat the sections below as the **QA scope** for this feature; Codex delivers it
> as an **audit report** (templates §14; owner + severity per §9–§10), and the tests / CI /
> harness described are **implemented by Claude (frontend) or Lovable (backend)** when they
> build — never by Codex. The "Lane: `codex/*`" header is superseded: Codex has no branch by
> default and reports to `docs/codex-reports/` or `docs/codex-feature-audits/`.

# Q2 — CODEX: Capture Mode QA (the mic, end to end)
## Cluster 1 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Capture is built and hardened; lock it in with real coverage so
> it never regresses. Codex lane only: tests, perf, a11y, QA reports. Do not change
> capture features or UI; file bugs for Claude.

---

## YOUR ROLE (do not overstep)
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI changes
(Claude), no schema (Lovable). `docs/BUILD-PATHWAY.md`.

---

## CONTEXT
Capture is the most-developed, hardened feature (mic engine, tap-to-record,
interruption auto-save, permission/secure-context diagnosis, failed-upload retry,
review player). Current coverage is thin for the *flow*:
- Hook test: `src/hooks/useVoiceRecorder.test.ts` (6 tests).
- Lib tests: `src/test/capture/acousticSplits`, `sectionKeywords`, `sectionKeywordsFuzzy`.
- **No component/integration test** for the real capture → review → commit flow.
- 18 components in `src/components/capture/*`.
Run Q1 first (CI must exist to enforce these).

---

## OBJECTIVE
Comprehensive, deterministic capture QA proving the mic works across devices and the
full flow is reliable — turning the hand-built hardening into enforced guarantees.

## TASKS
1. **Device matrix (documented):** verify/record behavior on iOS Safari (primary),
   Android Chrome, desktop Chrome/Safari — `getUserMedia`, `webkitAudioContext`
   resume, `MediaRecorder` mp4 vs webm, no-timeslice flush, secure-context/iframe.
   Produce a pass/fail matrix (some rows are manual-device — mark them clearly).
2. **Failure-mode tests** (extend `useVoiceRecorder.test.ts`): denial,
   NotReadable/busy, empty capture, interruption auto-save (track ended),
   max-duration ceiling, page-hidden save, insecure-context + iframe diagnosis. (Some
   already exist — fill the gaps.)
3. **Flow integration tests:** BigMic tap → records (mocked media) → stop → review
   opens → commit path. Cover the failed-upload retain+retry and the recovery notice.
4. **Performance:** confirm the waveform/amplitude is RAF-driven (no React re-render
   storms during recording); no main-thread jank; lazy chunks intact.
5. **Accessibility:** mic button `aria-pressed`/labels, `aria-live` timer, keyboard
   operability, reduced-motion, 44×44 targets — assert in tests where feasible.
6. **Regression hooks:** add capture to the reusable QA checklist; ensure CI runs all
   capture tests in the gate.

## DELIVERABLES
1. `docs/codex-qa-gate/capture-device-matrix.md` (cross-device results).
2. Expanded `useVoiceRecorder` failure-mode tests + a capture-flow integration test.
3. Perf + a11y findings (bugs filed to Claude if any).
4. Capture section added to the QA checklist; capture tests wired into CI.

## ACCEPTANCE CRITERIA
- [ ] Capture flow has component/integration coverage (tap → review → commit), green + deterministic.
- [ ] All recorder failure modes are tested.
- [ ] Device matrix documented (automated where possible, manual rows flagged).
- [ ] Perf (RAF, no re-render storms) and a11y verified; any bugs filed, not fixed here.
- [ ] All capture tests run in CI (Q1 gate).

## CONSTRAINTS
Codex lane only — no capture feature/UI edits. File product bugs for Claude. No
network-dependent tests. `codex/capture-qa` → merge → delete. Never weaken a gate.

## REFERENCES
- `src/hooks/useVoiceRecorder.ts` + `.test.ts`, `src/components/capture/*`, `src/test/capture/*`
- `docs/prompts/Q1-codex-ci-quality-gate.md`, `docs/codex-qa-gate/`, `docs/BUILD-PATHWAY.md`
