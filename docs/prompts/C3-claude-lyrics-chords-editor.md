# C3 — CLAUDE: Lyrics + Chords Editor
## Cluster 4 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. The lyric/chord editing experience is where the song takes
> shape in words. Mobile-first; tokens only; seam only; meet `MOBILE-UX-BENCHMARK.md`.

## YOUR ROLE
Claude: all `src/` UI. Seam only; no schema/auth/tests. `docs/BUILD-PATHWAY.md`.

## CONTEXT
Lyrics + chords are edited as a canvas layer today (`/songs/:id/lyrics` and `/chords`
redirect to `/canvas?layer=…`). Components: `src/components/canvas/LyricCard.tsx`,
`ChordCard.tsx`, plus the capture `ChordPicker.tsx` (Nashville system — excellent,
reuse it). Spec + images:
- `…/3. System operations/COG_Feature_17_Lyrics_and_Chords_Editor_Shape_Arrange_UX_Build_Handoff.pdf`
- `…/COG_Feature_18_Section_Nodes_and_Custom_Section_Labels_UX_Implementation_Plan.pdf`
- reference image `download (18).webp` (lyrics+chords: serif title, "Verse 1", chord
  chips C/G/Am above lyric lines, embedded voice memo, "Add section"/"Record idea")

## OBJECTIVE
A focused, beautiful, mobile-first lyrics+chords editor: type/edit lyrics by section,
place chord chips above lyric lines, reuse the ChordPicker, with a voice memo
attachable per section — matching `download (18).webp` at capture-level craft.

## PHASE 0 — SPEC
Read F17 + F18 + `download (18).webp`. State the one moment: *the songwriter sees
lyrics by section with chords sitting exactly above the words, and can edit either
without friction.* The reference image wins on conflict.

## PHASE 2 — AUDIT (7 lenses)
Audit `LyricCard`/`ChordCard` + the lyrics layer vs the mockup + benchmark. Note where
it depends on C1's unified data model (don't fork it). Check chord-above-word alignment,
section labels, mobile keyboard behavior, tap targets, empty state.

## PHASE 4 — BUILD
1. **Section-organized lyrics:** serif section labels (Verse 1, Chorus…), editable lyric
   lines, smooth mobile text editing (correct keyboard, no zoom, autosave via seam).
2. **Chord chips above lyric lines:** gold `--cog-gold-pale` chips positioned over the
   right syllable; tap a chip to edit via the **reused `ChordPicker`** (Nashville,
   letters/numbers toggle). Key/BPM header.
3. **Per-section voice memo:** show/attach the section's memo inline (reuse capture player).
4. **Add section / record idea** actions per the mockup.
5. **One data model:** consume C1's unified canvas/section types + the seam; persist via
   `song_lyrics`/`chord_progressions`/`song_sections` through `cog/*`.
6. Mobile-first polish: 44×44, reduced-motion, tokens, motion system, calm empty state.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk happy path + empty + offline. Evidence.

## ACCEPTANCE CRITERIA
- [ ] Lyrics edit by section; chords sit above the correct words; ChordPicker reused.
- [ ] Persists via the seam (no sessionStorage source of truth); one data model with C1.
- [ ] Matches `download (18).webp`; meets the mobile benchmark; no component > ~250 lines.
- [ ] `tsc`+`build`+tests green; 7-lens pass.

## DEPENDENCIES
- **C1** (unified canvas/section data model + seam access) · **L1/L3** (lyrics/chords/
  sections persistence). Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/lyrics-chords-editor` → merge → delete.

## REFERENCES
- `src/components/canvas/LyricCard.tsx`, `ChordCard.tsx`, `src/components/capture/ChordPicker.tsx`
- F17/F18 PDFs + `download (18).webp`
- `docs/prompts/C1-claude-canvas-cleanup.md`, `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`
