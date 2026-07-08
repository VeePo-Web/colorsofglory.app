# D1 · Canvas Visuals Agent — Progress Log

## 2026-07-08 — Step 1: CanvasStage carved out of the god component

**Branch:** `d1/canvas-step1` · worktree `C:\Users\Business\cog-d1-wt`

### What shipped

- **NEW `src/components/canvas/CanvasStage.tsx` (671 lines)** — the pure
  render surface: CanvasViewport + room glow + CanvasBranchConnectors +
  SongRootCard + ZoneLabels + CanvasDivider + the card render loop
  (`CanvasCardEl` moved verbatim, incl. the pointer-capture drag with
  direct-to-DOM per-frame writes) + the viewport API bridge. Named slots for
  the other canvas agents: `overlay`, `featureLayers`, `collabLayers`,
  `cardAdornment(card)`, `onCursorMove`. No data mutation, no feature
  mechanics, no realtime.
- **NEW `src/lib/canvas/canvasGeometry.ts`** — single source for board
  geometry (CARD_WIDTH/CARD_MIN_HEIGHT, DRAG_THRESHOLD_PX, column slots).
  CanvasBranchConnectors now imports it instead of mirroring `208/132` by
  comment.
- **`SongCanvasExperience.tsx` 2,426 → 1,896 lines (−530)** — now composes
  `<CanvasStage>` and hands per-card wiring across the boundary via a
  `getCardInteractions(card)` selector (same closures the old inline loop
  built, wired to the D2 hooks). All D2 bars/sheets and D3 layers/sheets kept
  exactly where they were — moved nothing of theirs, rewrote nothing.
- **NEW `docs/CANVAS-RENDER-CONTRACT.md`** — the D1 contract: props, slots,
  per-card division of labor, geometry, drag protocol, mounting rules
  (answers D3's §4 slot requests: `collabLayers` = presence layer,
  `cardAdornment` = pending markers, `sheetPortal` declined with rationale).

### Verification

- `npm run typecheck`: output **byte-identical to the origin/main baseline**
  (19 pre-existing errors in roles/permissions/tests; zero canvas errors
  before or after).
- `npm run build`: succeeds (7.4s; same pre-existing chunk-size warning).
- **Runtime (headless Edge over CDP, 390×844, dev server on :8080,
  `/songs/demo/canvas`):** board renders 5 demo cards + root card + zone
  labels + divider + 74 connector SVG paths + quick-nav + presence stack;
  tap-select shows accent ring + Layers/→ Final/⋯ action row; card drag moves
  per-frame and commits once on release with correct zoom compensation
  (+64/+80 screen px at 0.8× → +80/+100 canvas px, style 80/200 → 160/300);
  header recap button still opens WhatChangedRecapSheet (D3 surface intact).
  Console clean of app errors (only 401/403 from the forged verification
  session — data layer untouched by this step).

### Found while verifying (pre-existing, filed in contract §7 — NOT regressions)

1. Overlay buttons (Ideas⇄Final quick-nav, CreativeActionDock) don't
   `stopPropagation` on pointerdown → `useGesture`'s container pointer
   capture eats their clicks. Cards are immune (they stop propagation).
   Candidate fix in a later D1 interaction step.
2. `.cog-creation-dock` has no CSS anywhere in src — the dock renders
   unstyled at the canvas top-left.

### Commits

- `e345ea8` — CanvasStage + canvasGeometry extraction, host recomposed.
- (docs commit follows)

### Next

Step 2: wire the orphaned CardShell/LyricCard/VoiceMemoCard/HumCard/
ChordCard/NoteCard/SectionCluster system into CanvasStage's loop behind the
same `CanvasCardInteractions` surface, memoized.
