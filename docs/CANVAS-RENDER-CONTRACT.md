# CANVAS RENDER CONTRACT — CanvasStage (D1)

*v0.2 · D1 Steps 1–9 · the render surface D2/D3 mount into. Companion contracts:
`CANVAS-FEATURES-CONTRACT.md` (D2), `CANVAS-COLLAB-CONTRACT.md` (D3).*

## 1. Component boundary

```
SongCanvasExperience (host — composition root)
├─ header / status row / invite row            (page chrome, host-owned)
├─ <CanvasStage>                               (D1 — pixels only)
│   ├─ CanvasViewport (pan/zoom GPU transform, warm room-glow, keyboard nav)
│   │   ├─ CanvasViewportBridge → viewportApiRef
│   │   ├─ CanvasBranchConnectors (bezier SVG, aria-hidden)
│   │   ├─ SongRootCard · ZoneLabels · CanvasDivider (gold-glows on drag→Final)
│   │   ├─ SectionCluster nodes (collapsed dense sections)
│   │   ├─ CanvasCard[] = CardShell + typed face + uniform interaction layer
│   │   ├─ {featureLayers}   ← D2 slot (canvas-space)
│   │   └─ {collabLayers}    ← D3 slot (canvas-space, topmost)
│   └─ {overlay}             ← fixed chrome, NOT transformed (semantic nav + dock)
├─ work-panel sheet · D2 bars/sheets · D3 sheets · voice sheets · coach marks
```

### Card composition (Step 2)
`CanvasCard` (`src/components/canvas/CanvasCard.tsx`, `React.memo`) is the
orchestrator. It composes:
- **`CardShell`** — the shared frame (forwardRef): creator-color left stripe +
  tint, the three resting states (default / selected / dimmed), the merge keeper
  ring, the mount enter-spring, position, accessible button semantics.
- **A typed face** — `LyricCard` / `VoiceMemoCard` / `HumCard` / `ChordCard` /
  `NoteCard` (note+scripture). Presentational only (`cardFace.ts` =
  `{card,color,selected}`); each makes a card read as EXACTLY its type before a
  word is read (Playfair lyric, composed waveform, raw jagged hum, gold chord
  chips, ruled-paper note / book-icon scripture).
- **The uniform interaction layer** — arrangement #, listen-path #, merge ring,
  dim-reason label, the selected action row (Edit/Layers · →Final/←Ideas · ⋯),
  and the D3 `adornment`. Uniform while faces vary, so D2/D3 wiring is identical
  for every type.

The inline `CanvasCardEl` is deleted (`git grep` clean). Card keyframes
(`cog-card-enter`, `cog-card-pulse-dot`) are injected ONCE by CanvasStage.

## 2. Props (the full API)

| Prop | Type | Who feeds it |
|---|---|---|
| `songTitle` | `string` | host |
| `ideasCards` / `finalCards` | `CanvasBoardCard[]` | host — VISIBLE cards (collapsed-cluster members already excluded) |
| `clusters` | `SectionClusterData[]` | host — collapsed section stacks (flag from the store; see §6) |
| `onExpandCluster` | `(clusterId) => void` | host — fan a cluster open + frame it |
| `selectedId` | `string \| null` | host |
| `isDropActive` | `boolean` | host (extra divider-glow trigger; OR'd with the live drag zone) |
| `getCardInteractions` | `(card) => CanvasCardInteractions` | host — per-card callbacks from D2 hooks (§3) |
| `cardAdornment` | `(card) => ReactNode` | **D3 slot** — calm per-card marker inside the card |
| `viewportApiRef` | `MutableRefObject<ViewportCtx \| null>` | host — pan/zoom API out (§5) |
| `overlay` | `ReactNode` | fixed chrome above the canvas (semantic-nav pills, dock, first-run prompt) |
| `featureLayers` | `ReactNode` | **D2 slot** — canvas-space, above cards |
| `collabLayers` | `ReactNode` | **D3 slot** — canvas-space, topmost |
| `onCursorMove` | `(cx, cy) => void` | **D3 seam** — self cursor in canvas coords (throttled) |
| `initialZoom` / `initialPan` / `className` / `style` | | host layout |

`CanvasCardInteractions` (exported from `CanvasCard.tsx`, re-exported by
CanvasStage): `onSelect`, `onMove`, **`onCardDrop`** (§7), `onMoveToFinal/Ideas`,
`onOpenStack`, `onSuggestLine`, `onAddToListenPath`+`listenIndex`,
`onMergeSelect`+`mergeSelected`, `onEdit`, `onMore`, `finalOrder`,
`canCompare`/`onCompare`, `layerCount`.

## 3. Division of labor per card
- **CanvasCard decides HOW it looks**; the host's `getCardInteractions` decides
  **WHAT each callback does** (viewer gating, tree/type rules, D2 hooks).
  CanvasStage/CanvasCard never interpret a callback.
- Memo note: `getCardInteractions` returns fresh closures per host render, so
  `memo` skips only when the host hands stable callbacks (A4/store era). Drag
  stays 60fps regardless — the host doesn't re-render during a drag.

## 4. Geometry — single source of truth (`canvasGeometry.ts`)
Card footprints (`CARD_WIDTH`, `cardWidth(type)`, `CARD_MIN_HEIGHT`), the ROOT
box (`ROOT_LEFT/TOP/WIDTH/HEIGHT`), connector anchors (`ROOT_IDEAS_ANCHOR`,
`ROOT_FINAL_ANCHOR`, `CONNECTOR_VERT_SLACK`, `ideaArrival`, `finalArrival`),
`DRAG_THRESHOLD_PX`, and the wrapping column slots (`ideaColumnSlot` /
`finalColumnSlot`, `COLUMN_ROWS`, `SUBCOLUMN_STEP`). CardShell/CanvasCard,
SongRootCard, and CanvasBranchConnectors ALL import from here — no mirrored
dimensions. Nudging one value moves card + connector in lockstep (verified).
Past `COLUMN_ROWS` the feed wraps into the next sub-column so 40+ cards tile
inside their zone instead of running off the 3200px canvas.

## 5. Viewport API (`ViewportCtx`) + semantic navigation (Step 6)
`panTo` (center a point), **`animateTo`** (pan+zoom to explicit targets),
**`fitTo(box, viewW, viewH, padding?, ms?)`** (frame a canvas-space box),
`canvasToScreen`/`screenToCanvas`, live `zoom`/`panX`/`panY`. The host builds:
- **Fit-to-view** — frames root + every card.
- **Jump/frame Ideas / Final** — `fitTo` the zone's cards (Ideas includes root).
- **Frame a cluster** — `fitTo` its members on expand.

Semantic nav (Ideas / Final / Fit pills) is the PRIMARY mobile path; pinch/pan
is secondary. All single-pointer. **Keyboard:** the viewport is
`role="application"` + `tabIndex=0`; arrow keys pan, `+`/`-` zoom (via
`nudge`/`zoomBy`), Tab cycles cards, Enter/Space selects.

## 6. Section clusters (Step 8)
`SectionCluster` is a first-class stage node (stacked-shadow look, count badge,
first-3 mini previews, tap-to-expand). **WHICH sections cluster is the store's
flag** — `canvasBoardSource.clusterFlags(cards)` (interim A4 seam), NOT computed
by the render layer. The host maps the flag → `SectionClusterData`, hides member
cards from `ideas/finalCards`, and re-frames on expand. D2/D3 still see the full
card arrays (only the render hides clustered members). Marked
`data-canvas-nopan` so its tap isn't eaten by the pan gesture.

## 7. Drag protocol + drop seam (Steps 1, 7)
Per-frame drag writes go straight to the card element (`left`/`top`/`transform`);
React reconciles once on release. A press under `DRAG_THRESHOLD_PX` is a tap.
Lift = `scale(1.06) rotate(1.5deg)` + elevated shadow + z 50. The
**CanvasDivider glows gold** while a card is dragged over the Final zone
(CanvasStage owns the live `dragZone` state; cards report zone changes only).

**Drop meaning belongs to D2, not D1.** On a drop that crosses the divider into
the other tree, the card calls **`onCardDrop(cardId, zone, x, y)`** — D1 reports
the zone + position; the host routes it to D2 (`moveToFinal`/`moveToIdeas`, which
own placement + non-destructive semantics). A same-tree drop calls `onMove`. An
aborted drag (`pointercancel`) return-springs to origin. D1 mutates no
tree/status/meaning.

## 8. Store seam (Step 4) — `canvasBoardSource.ts` (interim, A4's lane)
The render layer owns NO hardcoded card array and touches card localStorage
nowhere directly. `initialBoard` / `writeBoard` / `hydrateBoard` (over the
existing `canvasLoader` adapter) + `clusterFlags` are the interim seam A4's
`useCanvasStore` replaces:
```ts
const board    = useCanvasStore(s => s.boardCards(songId));   // CanvasBoardCard[]
const clusters = useCanvasStore(s => s.clusterFlags(songId)); // CardCluster[]
const moveCard = useCanvasStore(s => s.moveCard);             // (id,x,y) => void
// hydration + persistence + cluster policy move INTO the store; the host loses
// initialBoard/writeBoard/hydrateBoard/clusterFlags entirely.
```
Demo cards live in `demoBoard.ts` and flow THROUGH the seam (never inline), so
dev renders populated though the backend returns no rows. A real song is a
private empty room until its owner adds the first idea.

## 9. Reduced-motion + accessibility (Step 9 — launch gate)
- `prefers-reduced-motion`: `panTo`/`animateTo`/`fitTo` jump instantly; card +
  cluster inline transitions neutralized to `0s` (CSS `!important` beats inline);
  enter/pulse animations off. No layout breakage.
- Every card: focusable `role="button"`, `aria-label = "<type> idea: <title> by
  <creator>"`. Connectors `aria-hidden`. Authorship always name + color (never
  color-only). Viewport keyboard controls per §5.
- Single-pointer alternative for every drag: →Final/←Ideas tap, overflow reorder,
  cluster expand-by-tap.

## 10. Rules for mounting into slots
1. Canvas-space children (featureLayers/collabLayers/cardAdornment/clusters)
   position with `position:absolute` in CANVAS coordinates; they inherit the
   viewport transform.
2. **Interactive overlay/canvas children work automatically** — `useGesture`
   bails on `button, a, input, [role=button|tab|slider], [data-canvas-card],
   [data-canvas-nopan]`, so their clicks are never eaten (Step 6 fix). Mark any
   bespoke interactive surface `data-canvas-nopan`.
3. Page-level sheets/bars stay host-composed siblings of CanvasStage (no portal
   slot needed; `sheetPortal` request declined).
4. `CanvasBoardCard` is consume-only for D1 (A2's lane).

## 11. Answers to the sibling contracts
- **D3 §4.1 presence/cursor layer** → `collabLayers` (canvas-space, topmost) +
  `onCursorMove` seam.
- **D3 §4.2 per-card pending marker** → `cardAdornment(card)` render prop.
- **D3 §4.3 `sheetPortal`** → declined; sheets already render above the stage.
- **D2 §4 drag-visual drop** → `onCardDrop(cardId, zone, position)` (§7); order
  model stays D2's.

## 12. Remaining seams / follow-ups for other agents
- **A4**: real `useCanvasStore` behind `canvasBoardSource` (kills the two
  localStorage keys + owns the cluster flag).
- **A2**: `@/types` barrel re-export of `CanvasBoardCard`.
- **A3/A4**: richer `hydrateBoard` (non-voice card types) as the schema grows.
- Pre-existing (not D1): the ~19 baseline type errors in
  roles/permissions/version-history/activity-feed/founder-code/voice-memo tests.
