# F4 Canvas — Component Inventory

Static map of every file the canvas route touches at runtime. Use this when
wiring fixes so you don't break a sibling.

## Route entry

| File | LOC | Purpose | Lazy? |
|---|---|---|---|
| `src/pages/SongCanvasPage.tsx` | 42 | Route wrapper, lazy-loads experience | parent of lazy |
| `src/components/canvas/SongCanvasExperience.tsx` | 655 | Page shell, state, render loop | lazy chunk |

## Canvas primitives (`src/components/canvas/`)

| File | LOC | Memoized | Props | Notes |
|---|---|---|---|---|
| `CanvasViewport.tsx` | 178 | No (provider) | children, overlay, callbacks | DOM-direct transform, will-change toggling |
| `CardShell.tsx` | 135 | Yes | color, state, isNew, onPointerDown, onClick | Injects `<style>` per render (F5) |
| `CanvasDivider.tsx` | 30 | No | isDropActive | Animated box-shadow + gradient |
| `ZoneLabel.tsx` | 110 | No | — | Static labels in canvas space |
| `FirstActionPrompt.tsx` | 135 | No | onHum, onLyric, onChords | Overlay, z-50, blocks FAB (F16) |
| `LyricCard.tsx` | 234 | Yes | card, selected, isDragging, isNew, callbacks | Playfair body |
| `HumCard.tsx` | 131 | Yes | card, selected, isDragging, isNew, callbacks | 8-bar waveform |
| `VoiceMemoCard.tsx` | 302 | Yes | card, selected, isDragging, isNew, callbacks | 20-bar waveform, Audio element |
| `ChordCard.tsx` | 146 | Yes | card, selected, isDragging, isNew, callbacks | Chord chip rows |
| `NoteCard.tsx` | 120 | Yes | card, selected, isDragging, isNew, callbacks | Ruled-paper gradient bg |
| `SectionCluster.tsx` | 244 | Yes | cluster, onExpand | Stack-of-3 cards, hover lift |

## Hook + lib

| File | LOC | Purpose |
|---|---|---|
| `src/hooks/useGesture.ts` | 305 | Pan/zoom/pinch via refs + rAF, wheel debounce |
| `src/lib/canvas/creatorColors.ts` | 48 | Deterministic aurora color per contributor |
| `src/lib/canvas/waveformSeed.ts` | 40 | Deterministic Math.sin-based bar heights |

## Render path (current)

```
SongCanvasExperience
├─ <header> (back, title, layer chips)
├─ <CanvasViewport overlay={FirstActionPrompt + FAB}>
│   ├─ <ZoneLabels/>
│   ├─ <CanvasDivider isDropActive/>
│   └─ [...ideasCards, ...finalCards].map(<CanvasCardEl/>)   ← UN-MEMOIZED, inline styles (F2)
├─ {showWorkPanel && <Suspense><SongCanvasWorkLayers/></Suspense><Suspense><SongCanvasCollabLayers/></Suspense>}
└─ <SongTabBar activeTab="canvas"/>
```

The dedicated memoized cards (`LyricCard`, `HumCard`, …) **exist but are not
rendered** from `SongCanvasExperience`. They are reachable only via
`SongCanvasWorkLayers` / `SongCanvasCollabLayers` panels. The canvas surface
itself renders the legacy `CanvasCardEl` defined inline at
`SongCanvasExperience.tsx:192`. This is the single biggest perf finding (F2).

## Lazy boundaries

- `SongCanvasPage` → lazy(`SongCanvasExperience`) → ok.
- `SongCanvasExperience` → lazy(`SongCanvasWorkLayers`) + lazy(`SongCanvasCollabLayers`).
  Two parallel lazy fetches behind a single Suspense → flash on first layer tap (F9).

## Card data shape used on the canvas

`CanvasCard { id, tree, type, title, body, meta, section, contributor, status, accent, x, y, isDimmedReference? }`

Initial set: 6 cards (3 in Ideas, 2 in Final, plus one scripture). All
positions in canvas coordinates (canvas is 2400×3200, divider at x=1200).