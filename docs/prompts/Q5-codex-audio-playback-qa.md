# Q5 — CODEX: Audio Playback & Capture-Intelligence QA
## Cluster 5 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Gate the voice-memo list/player + the AI enrichment states. Codex
> lane only: tests, perf, a11y, QA docs. No feature/UI changes; file bugs for Claude.

## YOUR ROLE
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI/schema.
Run after Q1 (CI). `docs/BUILD-PATHWAY.md`.

## CONTEXT
Voice playback is core. Surfaces: `ReviewAudioPlayer`, `VoiceMemoCard`, the voice layer,
backed by L5 (storage/waveform/signed URLs) + LX (enhancement/transcription/analysis).
Existing audio tests: `useVoiceRecorder.test.ts`, capture lib tests.

## OBJECTIVE
Prove playback is fast, smooth, accessible, and that AI states degrade gracefully — at
scale, on mobile.

## TASKS
1. **Playback correctness:** start/pause/seek/ended; only one memo plays at a time;
   signed-URL expiry handled; cleanup of `<audio>` on unmount (no leaks).
2. **Layered takes:** layers play in sync; "record over" path doesn't corrupt the memo.
3. **Waveform perf:** renders from L5 peak data without full-file decode; scrubber is
   RAF/transform-only; no re-render storms during playback; smooth on mid-tier mobile.
4. **AI state handling:** UI degrades gracefully for pending/failed/unavailable
   enhancement/transcription/analysis (no spinners-of-death, no crash on missing data).
5. **Accessibility:** play/pause labels, scrubber keyboard-operable + ARIA, reduced-motion,
   44×44 — assert where feasible.
6. **Regression + CI:** add playback + state-handling tests; wire into the Q1 gate;
   document a quick mobile playback latency check.

## DELIVERABLES
1. Playback unit/integration tests (start/seek/ended/single-active/cleanup).
2. Layered-take sync test. 3. Waveform-perf report (`docs/codex-qa-gate/audio-perf.md`).
4. AI-state degradation tests. 5. a11y assertions. 6. Tests wired into CI.

## ACCEPTANCE CRITERIA
- [ ] Playback: deterministic tests for start/seek/ended/single-active/no-leak.
- [ ] Layered takes stay in sync; "record over" preserves the memo.
- [ ] Waveform/scrubber perf documented (RAF/transform-only, smooth mobile).
- [ ] Pending/failed/unavailable AI states handled gracefully (tested).
- [ ] a11y verified; all audio tests green in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file bugs for Claude. No network-dependent tests
(mock signed URLs/providers). `codex/audio-qa` → merge → delete. Never weaken a gate.

## REFERENCES
- `src/components/capture/ReviewAudioPlayer.tsx`, `src/components/canvas/VoiceMemoCard.tsx`, `src/components/voice/*`, `src/hooks/useVoiceRecorder*`
- `docs/prompts/L5-…voice-memo-storage-analysis.md`, `LX-…capture-ai-intelligence.md`, `Q1-…ci-quality-gate.md`
- `docs/BUILD-PATHWAY.md`
