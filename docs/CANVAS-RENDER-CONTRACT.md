# CANVAS RENDER CONTRACT — CanvasStage (D1)

*v0.1 · D1 Step 1 · the render surface D2/D3 mount into. Companion contracts:
`CANVAS-FEATURES-CONTRACT.md` (D2), `CANVAS-COLLAB-CONTRACT.md` (D3).*

## 1. Component boundary

```
SongCanvasExperience (host — composition root, ~1.9k lines)
├─ header / status row / invite row            (page chrome, host-owned)
├─ <CanvasStage>                               (D1 — pixels only)
│   ├─ CanvasViewport (pan/zoom GPU transform, warm room-glow)
│   │   ├─ CanvasViewportBridge → viewportApiRef
│   │   ├─ CanvasBranchConnectors (bezier SVG)
│   │   ├─ SongRootCard · ZoneLabels · CanvasDivider
│   │   ├─ card render loop (CanvasCardEl: pixels + pointer-capture drag visuals)
│   │   ├─ {featureLayers}   ← D2 slot (canvas-space)
│   │   └─ {collabLayers}    ← D3 slot (canvas-space, topmost)
│   └─ {overlay}             ← fixed chrome, NOT transformed
├─ work-panel bottom sheet (SongCanvasWorkLayers + SongCanvasCollabLayers)
├─ D2 bars: MergeActionBar · ListenPathBar · FinalArrangementBar · CompareModeSheet
├─ D3 sheets: WhatChangedRecapSheet · CanvasRecapGate · OwnerReviewQueueSheet
└─ voice sheets, coach marks, card edit/actions sheets
```

`CanvasStage` (`src/components/canvas/CanvasStage.tsx`) is a **pure render
surface**: it receives render inputs as props/selectors and emits pixels. It
never mutates data, never runs feature mechanics (D2), never touches realtime
(D3). All feature/collab wiring stays in the host and crosses the boundary via
the props below.

## 2. Props (the full API)

| Prop | Type | Who feeds it |
|---|---|---|
| `songTitle` | `string` | host (`useSongTitle`) |
| `ideasCards` / `finalCards` | `CanvasBoardCard[]` | host card state (A4-to-be), already split by tree, stack layers excluded |
| `selectedId` | `string \| null` | host selection state |
| `isDropActive` | `boolean` | divider gold glow during a toward-Final drag |
| `getCardInteractions` | `(card) => CanvasCardInteractions` | host derives per-card callbacks/badges from D2 hooks — see §3 |
| `cardAdornment` | `(card) => ReactNode` | **D3 slot** — calm per-card marker rendered inside the card (answers COLLAB-CONTRACT §4.2) |
| `viewportApiRef` | `MutableRefObject<ViewportCtx \| null>` | host; exposes `panTo`/`screenToCanvas`/`canvasToScreen` for fly-to-card & presence-jump |
| `overlay` | `ReactNode` | fixed chrome above the canvas, not transformed (quick-nav pills, FirstActionPrompt, CreativeActionDock) |
| `featureLayers` | `ReactNode` | **D2 slot** — canvas-space surfaces inside the transforming layer, above cards |
| `collabLayers` | `ReactNode` | **D3 slot** — canvas-space surfaces, topmost (live cursors, presence ghosts; answers §4.1 — children receive the pan/zoom transform automatically) |
| `onCursorMove` | `(cx, cy) => void` | **D3 seam** — self cursor position in canvas coords, throttled ~100ms by the viewport |
| `initialZoom` / `initialPan` | number / point | host (currently `0.8`) |
| `className` / `style` | — | layout sizing (host passes `w-full h-full`) |

`CanvasCardInteractions` = everything `CanvasCardEl` takes except `card`,
`selected`, `adornment` (exported from CanvasStage.tsx): `onSelect`, `onMove`,
`onMoveToFinal/Ideas`, `onOpenStack`, `onSuggestLine`, `onAddToListenPath` +
`listenIndex`, `onMergeSelect` + `mergeSelected`, `onEdit`, `onMore`,
`finalOrder`, `canCompare`/`onCompare`, `layerCount`.

## 3. Division of labor per card

- **CanvasStage decides HOW it looks**: selection ring, merge ring, dim state
  + reason label, lift/drag visuals, waveform, contributor stripe/avatar,
  listen-path badge, arrangement number.
- **The host decides WHAT it does**: which callbacks a card gets (viewer
  gating, tree/type rules) — computed in `getCardInteractions`, wired to the
  D2 hooks (`useFinalArrangement`, `useListenPath`, `useMergeSplice`, …).
  CanvasStage never interprets a callback.

## 4. Geometry — single source of truth

`src/lib/canvas/canvasGeometry.ts` (D1-owned): `CARD_WIDTH 208`,
`CARD_MIN_HEIGHT 132`, `DRAG_THRESHOLD_PX 7`, `COLUMN_TOP 272`,
`COLUMN_GAP 156`, `IDEAS_COLUMN_X 80`, `FINAL_COLUMN_X DIVIDER_X+80`,
`ideaColumnSlot(i)` / `finalColumnSlot(i)`. Consumed by CanvasStage,
CanvasBranchConnectors, and the host's placement logic (add card, record,
`useFinalArrangement`'s `finalSlot`). Canvas size stays in
`canvasConstants.ts` (2400×3200, divider at 1200, zoom 0.4–2.5).

## 5. Drag protocol (per-frame, no re-renders)

Card drag is pointer-capture on the card element; per-frame positions are
written straight to that element's `style.left/top` (zoom-compensated via
`screenToCanvas`), and React state is reconciled **once** on pointer-up via
`onMove(id, x, y)`. A press under `DRAG_THRESHOLD_PX` is a tap → `onSelect`.
Same architecture as the viewport's direct-to-DOM transform writes — do not
introduce per-frame setState on this path.

## 6. Rules for mounting into slots

1. Canvas-space children (featureLayers/collabLayers/cardAdornment) position
   with `position:absolute` in **canvas coordinates**; they inherit the
   viewport transform. Keep them `pointerEvents:"none"` unless interactive.
2. **Interactive overlay/canvas children MUST `stopPropagation()` on
   `pointerdown`** — the viewport's pan gesture (`useGesture`) captures the
   pointer at the container on pointerdown, which eats the child's click.
   Cards do this; see Known Issues for surfaces that currently don't.
3. Page-level sheets/bars (recap, review queue, listen path, merge, compare)
   stay host-composed **siblings** of CanvasStage — no portal slot needed
   (COLLAB-CONTRACT §4.3 `sheetPortal`: declined, sheets already render above
   the stage; z-inventory in FEATURES-CONTRACT §4 still applies).
4. `CanvasBoardCard` is consume-only for D1 (A2's lane via canvasTypes.ts).

## 7. Known issues observed at the surface (pre-existing, not Step-1 regressions)

- **Overlay buttons don't stop pointer propagation**: the Ideas⇄Final
  quick-nav pills and CreativeActionDock buttons sit in `overlay` inside the
  gesture container without `stopPropagation` on pointerdown → the container
  captures the pointer and their `onClick` never fires (verified via CDP on
  the running app; header buttons outside the viewport work fine). Fix
  belongs to a later D1 step (render-surface interaction), not behavior-
  preserving Step 1.
- **`.cog-creation-dock` has no CSS anywhere in src/** — CreativeActionDock
  renders unstyled at the container's top-left (A1 tokens lane or lost in the
  earlier tree reset).

## 8. Roadmap seams (next steps)

- **Step 2**: swap `CanvasCardEl` for the orphaned CardShell/LyricCard/
  VoiceMemoCard/HumCard/ChordCard/NoteCard system behind the same
  `CanvasCardInteractions` surface (memoized cards; kills the inline-styles
  hot path flagged in the codex F4 audit).
- **D2 drag-to-final**: the on-canvas drag visual will call a drop callback
  into `useFinalArrangement` (order model stays D2's) and drive
  `isDropActive` from proximity to the divider.
- **A4**: when `useCanvasStore` lands, the host's `getCardInteractions`
  rewires to store actions; CanvasStage is untouched.
