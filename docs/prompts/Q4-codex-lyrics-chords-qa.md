# Q4 — CODEX: Lyrics + Chords QA + Accessibility
## Cluster 4 · Lane: `codex/*` · Owner: Codex (the quality gate)

> Paste into Codex. Gate C3's lyrics+chords editor. Codex lane only: tests, perf, a11y,
> QA docs. No feature/UI changes; file bugs for Claude. Run after Q1 (CI).
> Songwriter truth: **a chord must sit on the exact syllable, and a typed line must never
> be lost.** Those two are the highest-severity things to prove here.

## YOUR ROLE
Codex: `src/test/*`, perf, a11y, regression, `docs/codex-*`. No feature/UI/schema.
`docs/BUILD-PATHWAY.md`.

## CONTEXT
C3 builds the lyrics+chords editor (section-organized lyrics, chord chips above lyric
lines, reused Nashville `ChordPicker`, per-section voice memo). Surfaces:
`src/components/canvas/LyricCard.tsx`, `ChordCard.tsx`,
`src/components/capture/ChordPicker.tsx`, the lyrics/chords layer. Existing tests:
`src/test/capture/...` and `src/test/chords-nashville.test.ts` (Nashville logic — extend).
Data persists via the seam (`song_lyrics`, `chord_progressions`, `song_sections`).

## OBJECTIVE
Prove lyric editing + chord placement are correct, never lose data, and are accessible
and smooth on mobile — at the standard of a tool a real songwriter would trust.

## TASKS
1. **Chord-above-word alignment (Critical):** a chord chip maps to the intended
   syllable/character position and **stays aligned** across edits, wrapping, and
   re-render. Test the mapping model (char index ↔ chip) directly.
2. **No-data-loss autosave (Critical):** rapid edits, section switches, backgrounding,
   and offline don't drop a lyric line or a chord. Test debounce/flush + the seam write
   path; confirm an interrupted edit is recoverable.
3. **Nashville correctness:** extend `chords-nashville.test.ts` — diatonic/borrowed,
   quality/extension/slash, letters↔numbers toggle, key/mode changes re-render chords
   correctly.
4. **Section ops:** add/rename/reorder/delete sections keeps lyrics + chords attached to
   the right section; ordering stable.
5. **Mobile + a11y:** correct mobile keyboard (`inputMode`, no iOS zoom — 16px+),
   ≥44px controls, editable regions labeled, keyboard-operable, reduced-motion.
6. **Perf:** editing a long lyric set doesn't thrash; chord chips render cheaply.
7. **CI:** wire all lyrics/chords tests into the Q1 gate.

## DELIVERABLES
1. Chord-alignment tests (chip ↔ syllable mapping, stable across edits/wrap).
2. Autosave/no-loss tests (rapid edit, switch, offline, interrupt).
3. Extended Nashville tests. 4. Section-ops tests. 5. a11y + mobile-keyboard assertions.
6. Perf note (`docs/codex-qa-gate/lyrics-perf.md`). 7. Tests in CI.

## ACCEPTANCE CRITERIA
- [ ] Chord chips stay on the correct syllable across edits/wrapping (tested).
- [ ] No lyric/chord loss under rapid edit / switch / offline / interrupt (tested).
- [ ] Nashville logic fully covered; section ops keep content attached + ordered.
- [ ] Mobile keyboard correct (no zoom), ≥44px, a11y verified; perf documented.
- [ ] All lyrics/chords tests green in CI.

## CONSTRAINTS
Codex lane only — no feature/UI edits; file product bugs for Claude. No network tests
(mock the seam). `codex/lyrics-chords-qa` → merge → delete. Never weaken a gate.

## REFERENCES
- `src/components/canvas/LyricCard.tsx`, `ChordCard.tsx`, `src/components/capture/ChordPicker.tsx`
- `src/test/chords-nashville.test.ts`, `src/lib/chords/*`
- `docs/prompts/C3-claude-lyrics-chords-editor.md`, `Q1-…ci-quality-gate.md`, `docs/BUILD-PATHWAY.md`
