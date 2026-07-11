# WEAVE — build progress ledger

Charter: 10 steps, D2-lead. Contract: `docs/WEAVE-CONTRACT.md`.

| Step | What | Status | Notes |
|---|---|---|---|
| 1 | Baseline audit + contract | ✅ | Charter toolkit partially stale: `rhyme.ts`/`syllables.ts` real (signatures exact); `rhymeSuggest.ts` + `RhymeSchemer.tsx` DID NOT EXIST — built fresh / fresh ribbon. Entry point = final-tree section card → More → "Weave lines into this section". |
| 2 | Fit-scoring engine | ✅ | `src/lib/canvas/weave.ts` pure + `weave.test.ts`. Rhyme .5 / meter .3 / theme .2; empty-section uniform faint; tiers strong/warm/faint; human `reason` per glow. |
| 3 | Weave mode entry + glow | ✅ | `useWeave` computes; `WeaveCardFace` renders; non-candidates fade (still tappable); viewport frames Ideas on enter. |
| 4 | Tap-to-place | ✅ | Append to target body via existing `updateCanvasCard` write path; source dims "used" (`cog:weave-used-<songId>`); toast + Undo; un-place restores. |
| 5 | Rhyme ribbon | ✅ | `rhymeScheme` → letter chips on `WeaveTargetFace`; 3 calm tones cycled, never rainbow. |
| 6 | Syllable meter | ✅ | Per-line counts + median-drift flag (amber dotted underline); guidance only, never a gate. |
| 7 | Line Lab | ✅ | `rhymeSuggest.ts` (Datamuse + cache) + `LineLabSheet`; syllable-matched badges; corpus fallback offline ("from your own ideas"); last-word swap only. |
| 8 | Invariant audit | ✅ | Two independent adversarial reviews. Fixed: snapshot→OPERATIONAL undo (a stacked Undo could wipe a later placement/co-writer line); per-target used keys (a line used in Verse 1 no longer gates the Chorus); chord-aware `swapLastWord` (no more swapping the `[C]` letter); orphaned-lab-index guard; create-spine race closed (body write resolves the server id inside the queued closure + `weave.renameCard` rides `swapCardId`); used-map GC on entry; clusters yield while weaving. Verified holding: tap-to-place (no drag, no pointer-capture retarget), D2-computes/D1-renders, source cards never written, Escape layering. |
| 9 | Sheet payload + a11y + perf | ✅ | Payload = the `canvas_cards` row itself (C3's agreed seeding source — see contract §8; no fake sheet events). A11y: line rows are real buttons labeled with the WHY; `role=group` containers (no listitem-on-button); Line Lab focuses its dialog on open, traps, returns; lens toggles use aria-pressed; used rows warm-gray (AA); 44px floors; shell drops its button role while faces are button panels. Reduced-motion: color stays, pulses drop. Perf: memoized glow map, handlers on apisRef, corpus gated on lab-open. |
| 10 | E2E verify + publish | ✅ | 390px Playwright journey 12/12: enter → glow w/ reasons → place → OPERATIONAL undo → re-place → ribbon group A + meter → Line Lab (real Datamuse swap face→base, meter-keeping ring) → Done → source body untouched. tsc/eslint clean, 663/671 (8 pre-existing other-lane), build green. Contract published. |
