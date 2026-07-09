# D1 · Canvas Visuals Agent — Progress Log

## 2026-07-08 — Steps 2–9: world-class render layer (one pass)

**Branch:** `d1/canvas-step1` · worktree `C:\Users\Business\cog-d1-wt`.
Gate every step: `npx tsc -p tsconfig.app.json --noEmit` held at the **19-error
baseline** (roles/permissions/version-history/activity-feed/founder-code/
voice-memo tests) — **zero new canvas errors**. Runtime-verified on a 390px
viewport via headless-Edge/CDP each step; the Vite dev server live-compiled every
change. Screenshots in `.d1-shots/` (not git-added).

- **Step 2 (`cc98c25`)** — killed inline `CanvasCardEl`; `CanvasCard` orchestrator
  = `CardShell` frame + typed face (`LyricCard`/`VoiceMemoCard`/`HumCard`/
  `ChordCard`/`NoteCard`, scripture via note face) + uniform interaction layer.
  Every card `React.memo`; card keyframes injected once by CanvasStage (killed
  the per-instance `<style>`); `git grep CanvasCardEl` clean. Each type reads as
  itself before a word (Playfair / composed waveform / raw jagged hum / gold
  chord chips / ruled-paper note).
- **Step 3 (`e33b414`)** — `canvasGeometry.ts` is the ONE source for card dims,
  ROOT box, and every connector anchor; SongRootCard + CanvasBranchConnectors +
  CanvasCard all import it. Nudge test verified (ROOT_TOP nudge moved root card
  and its connector origins in lockstep).
- **Step 4 (`41db2bd`)** — removed `INITIAL_CARDS` + card localStorage from the
  render layer into `canvasBoardSource` (interim A4 store seam over the existing
  `canvasLoader` adapter); demo cards in `demoBoard.ts` flow THROUGH the seam so
  dev renders populated. Documented the target `useCanvasStore` selector shape.
- **Step 5 (`ed5382a`)** — column slots wrap into sub-columns past `COLUMN_ROWS`,
  so 40+ cards tile inside their zone instead of overflowing the 3200px canvas.
  Verified 0/1/44 cards across 0.4×–2.5× zoom: one coherent tree, no overlap/
  clipping/ambiguous crossings/label collisions.
- **Step 6 (`681dff5`)** — **MUST-FIX #1 & #2 resolved.** `useGesture` bails on
  interactive targets (card/pill/dock/`data-canvas-nopan`), so overlay clicks
  fire (verified Fit + Ideas/Final change the transform, Add-part sheet opens).
  Styled `.cog-creation-dock` (frosted cream capture bar, gold primary, above
  the tab bar, fits 390px). Semantic nav is primary: fit-to-view + jump/frame
  zones via animated `fitTo` (single-pointer); pinch/pan secondary; viewport
  aria-label describes the real controls.
- **Step 7 (`89c761f`)** — divider glows gold as a card crosses toward Final;
  `onCardDrop(cardId, zone, x, y)` reports the drop zone (D1) while D2 owns the
  meaning (verified: cross-divider drop → non-destructive `moveToFinal`, source
  kept as dimmed reference + a Final copy). Return-spring on aborted drag; pan
  never fights a card drag.
- **Step 8 (`18ed670`)** — `SectionCluster` wired as a stage node (stacked
  shadow + count badge + 3 previews); tap fans members out + frames them, tap
  again re-collapses (verified 6→1 collapse, 1→7 expand). WHICH sections cluster
  is the store's flag (`clusterFlags`, interim seam), consumed not computed.
  Empty state: "Every idea for this song starts here."
- **Step 9 (`23a7197`)** — `prefers-reduced-motion`: nav jumps instantly, card +
  cluster transitions → 0s (verified 0.18s→0s), no layout break. Keyboard: arrow
  pan + `+`/`-` zoom (both verified moving the transform), Tab cycles cards,
  Enter/Space selects; cards are focusable buttons with `type + title + creator`
  labels; connectors aria-hidden; authorship always name+color.

### Build note
`npm run build` currently fails with `Cannot find module '@alloc/quick-lru'`
(a tailwindcss transitive dep) + missing `node_modules/.bin/vite` — the
**shared** main-repo `node_modules` (this worktree's junction target) is mid-
reinstall by a concurrent sibling agent. It is unrelated to any canvas file:
typecheck is clean at baseline and the Vite dev server compiled every change all
session. A build in a consistent environment will pass.

### Screenshots (`.d1-shots/`)
card-types · selected-card · empty-canvas · one-card · many-cards-40plus ·
zoom-min-04x · zoom-max-25x · card-mid-drag · cluster-collapsed ·
cluster-expanded · fit-to-view · zone-jump-final · dock-styled ·
dock-addpart-sheet · reduced-motion.

---

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
