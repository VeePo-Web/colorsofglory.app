# Step 1 — CanvasViewport
## In-Depth Build Plan
## Song Whiteboard Canvas · Feature 1 MVP
## 2026-06-04

---

## WHAT STEP 1 DELIVERS

A fully gesture-driven infinite canvas container that:
- Renders all canvas content (cards, divider, cursors) inside a single GPU-composited layer
- Responds to two-finger pan and pinch-to-zoom at 60fps with zero layout reflow
- Provides a context hook so child components can read viewport state
- Works identically on iOS Safari, Android Chrome, and desktop mouse

After Step 1, the canvas looks and moves exactly right. Cards are just placeholders — Steps 2–4 make them real.

---

## WHAT ALREADY EXISTS (do not replace)

| Existing component | What it does | Keep? |
|---|---|---|
| `SongCanvasPage.tsx` | Page shell, header, layer chips, SongTabBar | Keep, modify |
| `SongCanvasTrees.tsx` | Ideas/Final column layout (list-based) | Replace with canvas-positioned cards |
| `SongCanvasWorkLayers.tsx` | Lyrics/Voice/Chords layer panels | Keep as-is (sidebar panels) |
| `SongCanvasCollabLayers.tsx` | People/activity layer | Keep as-is |
| `CanvasCard` interface | Data shape | Extend, don't replace |

**The existing SongCanvasPage shell is good.** Step 1 replaces the inner `SongCanvasTrees` component with a proper infinite viewport, while keeping the header, layer chips, and work-layers sidebar intact.

---

## COMPONENT: `CanvasViewport.tsx`

**File:** `src/components/canvas/CanvasViewport.tsx`

### Responsibilities
1. Creates the fixed-size viewport container (full screen minus header)
2. Tracks `panX`, `panY`, `zoom` state
3. Applies `transform: translate(${panX}px, ${panY}px) scale(${zoom})` to the inner canvas layer
4. Handles all pointer events for pan and zoom
5. Exposes viewport state to children via `CanvasViewportContext`
6. Snaps content to prevent infinite empty canvas drift
7. Communicates cursor position for live collaboration via callback

### The transform architecture

```
<div class="viewport-container">         ← fixed, overflow:hidden, full screen
  <div class="canvas-layer">             ← transform: translate + scale, GPU composited
    <div class="ideas-zone">             ← absolute, x=0-half
    <div class="divider-line">           ← absolute, x=half
    <div class="final-zone">             ← absolute, x=half+
    {cards.map(card => (
      <CanvasCard style={{ left: card.x, top: card.y }} />
    ))}
    {collaborators.map(c => (
      <CursorDot style={{ left: c.x, top: c.y }} />
    ))}
  </div>
</div>
```

**Why this works at 60fps:**
- `transform` never triggers layout or paint — only composite
- `will-change: transform` on `.canvas-layer` promotes it to its own GPU layer
- No React re-render during pan — we write directly to DOM via ref
- Cards use `position: absolute` with fixed `left`/`top` — also layout-free during pan

### State shape

```typescript
interface ViewportState {
  panX: number;         // current pan offset X (px)
  panY: number;         // current pan offset Y (px)
  zoom: number;         // current scale (0.5 to 2.0)
  isDragging: boolean;  // true while user is actively panning
  canvasWidth: number;  // total canvas width (ideas + final)
  canvasHeight: number; // total canvas height
}

// Context provided to all children
interface CanvasViewportContextValue {
  viewportState: ViewportState;
  canvasToScreen: (x: number, y: number) => { x: number; y: number };
  screenToCanvas: (x: number, y: number) => { x: number; y: number };
  panTo: (x: number, y: number) => void;      // animate to position
  zoomTo: (scale: number, cx: number, cy: number) => void;
}
```

### Gesture handling — the exact implementation

**Pan (two-finger on mobile, click-drag on desktop):**

```typescript
// Track active pointers
const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

const handlePointerDown = (e: React.PointerEvent) => {
  e.currentTarget.setPointerCapture(e.pointerId);
  activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
};

const handlePointerMove = (e: React.PointerEvent) => {
  if (!activePointers.current.has(e.pointerId)) return;
  
  const prev = activePointers.current.get(e.pointerId)!;
  const current = { x: e.clientX, y: e.clientY };
  
  const pointers = Array.from(activePointers.current.values());
  
  if (pointers.length === 1) {
    // Single touch/drag: pan only if NOT touching a card
    if (!isDraggingCard.current) {
      panX.current += current.x - prev.x;
      panY.current += current.y - prev.y;
      applyTransform();
    }
  } else if (pointers.length === 2) {
    // Two-finger: pan + pinch zoom
    const [p1, p2] = [...activePointers.current.values()];
    const newMidX = (p1.x + p2.x) / 2;
    const newMidY = (p1.y + p2.y) / 2;
    const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    
    if (prevTwoFingerMid.current && prevTwoFingerDist.current) {
      // Pan by midpoint delta
      panX.current += newMidX - prevTwoFingerMid.current.x;
      panY.current += newMidY - prevTwoFingerMid.current.y;
      
      // Zoom around midpoint
      const scaleDelta = newDist / prevTwoFingerDist.current;
      const newZoom = clamp(zoom.current * scaleDelta, MIN_ZOOM, MAX_ZOOM);
      
      // Adjust pan so zoom centers on the midpoint
      const midCanvasX = (newMidX - panX.current) / zoom.current;
      const midCanvasY = (newMidY - panY.current) / zoom.current;
      panX.current = newMidX - midCanvasX * newZoom;
      panY.current = newMidY - midCanvasY * newZoom;
      
      zoom.current = newZoom;
    }
    
    prevTwoFingerMid.current = { x: newMidX, y: newMidY };
    prevTwoFingerDist.current = newDist;
    
    applyTransform();
  }
  
  activePointers.current.set(e.pointerId, current);
};

const handlePointerUp = (e: React.PointerEvent) => {
  activePointers.current.delete(e.pointerId);
  if (activePointers.current.size < 2) {
    prevTwoFingerMid.current = null;
    prevTwoFingerDist.current = null;
  }
};
```

**The key insight:** We use `useRef` (not `useState`) for `panX`, `panY`, `zoom` during active gestures, and write directly to the DOM via `applyTransform()`. This bypasses React's render cycle entirely during pan — achieving native-feel 60fps.

```typescript
const applyTransform = useCallback(() => {
  if (!canvasLayerRef.current) return;
  canvasLayerRef.current.style.transform =
    `translate(${panX.current}px, ${panY.current}px) scale(${zoom.current})`;
}, []);
```

We only call `setState` when the gesture ENDS (to persist final values to React state for card position calculations).

### Clamp / bounds

```typescript
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const CANVAS_WIDTH = 2400;   // total canvas width (ideas zone + final zone)
const CANVAS_HEIGHT = 3200;  // total canvas height

function clampPan(x: number, y: number, zoom: number, viewW: number, viewH: number) {
  // Prevent panning so far that the canvas is entirely out of view
  // Allow at least 200px of canvas to remain visible
  const margin = 200;
  const minX = viewW - CANVAS_WIDTH * zoom - margin;
  const maxX = margin;
  const minY = viewH - CANVAS_HEIGHT * zoom - margin;
  const maxY = margin;
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}
```

### The divider line

The center divider separates Ideas Zone from Final Zone. It's an absolutely positioned element inside the canvas layer:

```tsx
<div
  style={{
    position: 'absolute',
    left: CANVAS_WIDTH / 2,
    top: 0,
    width: 1,
    height: CANVAS_HEIGHT,
    background: 'linear-gradient(to bottom, transparent, rgba(181,147,90,0.25) 10%, rgba(181,147,90,0.25) 90%, transparent)',
    pointerEvents: 'none',
  }}
/>
```

When a card is being dragged across it, the divider glows:
```tsx
// During drag: pulse gold glow on the divider line
border: isDraggingCard ? '1px dashed rgba(181,147,90,0.60)' : 'none'
```

### Zone labels

Fixed labels for Ideas Tree and Final Song float at the top of each zone:

```tsx
// Ideas zone label (left of divider)
<div style={{ position: 'absolute', left: CANVAS_WIDTH/2 - 300, top: 24 }}>
  <p style={{ color: '#999', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
    Ideas Tree
  </p>
  <p style={{ color: '#1A1A1A', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
    Every idea, unfiltered
  </p>
</div>

// Final zone label (right of divider)  
<div style={{ position: 'absolute', left: CANVAS_WIDTH/2 + 24, top: 24 }}>
  <p style={{ color: '#999', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
    Final Song
  </p>
  <p style={{ color: '#1A1A1A', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
    Ready to worship
  </p>
</div>
```

### Dot grid background

The dot grid is painted on the canvas layer, not the viewport. This ensures dots move with the canvas during pan (correct perspective):

```css
.canvas-layer {
  background-image: radial-gradient(circle at 1px 1px, rgba(181,147,90,0.10) 1.5px, transparent 0);
  background-size: 32px 32px;
  width: 2400px;
  height: 3200px;
}
```

### Initial position (center the canvas on first load)

```typescript
useEffect(() => {
  // Center the canvas viewport on the Ideas zone midpoint
  const viewW = containerRef.current?.clientWidth ?? 375;
  const viewH = containerRef.current?.clientHeight ?? 700;
  
  panX.current = viewW / 2 - (CANVAS_WIDTH / 4);  // center on Ideas zone
  panY.current = viewH / 2 - 400;                  // vertical center with offset
  zoom.current = 1.0;
  
  applyTransform();
}, []);
```

### Minimap (V2 — not in Step 1)

A small thumbnail showing position on the full canvas. Deferred to Step 10.

---

## CONTEXT HOOK: `useCanvasViewport.ts`

```typescript
// src/hooks/useCanvasViewport.ts

export const CanvasViewportContext = createContext<CanvasViewportContextValue | null>(null);

export function useCanvasViewport(): CanvasViewportContextValue {
  const ctx = useContext(CanvasViewportContext);
  if (!ctx) throw new Error('useCanvasViewport must be inside CanvasViewport');
  return ctx;
}
```

Children use this to:
- Convert between screen coordinates and canvas coordinates (for placing cards where user taps)
- Programmatically pan to a specific card
- Read current zoom level (to scale cursor dot sizes)

---

## INTEGRATION INTO `SongCanvasPage.tsx`

The existing `SongCanvasPage` renders `SongCanvasTrees` in the right column of a grid. Step 1 replaces this section with `CanvasViewport` containing both Ideas and Final zones:

### Before (current):
```tsx
<div className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.72fr)]">
  <SongCanvasWorkLayers activeLayer={activeLayer} />
  <SongCanvasTrees ideas={ideas} finalCards={finalCards} ... />
</div>
```

### After (Step 1):
```tsx
{/* Full-screen canvas viewport — replaces the tree column */}
<CanvasViewport
  cards={cards}
  onCardMove={handleCardMove}
  onCardDrop={handleCardDrop}
  onHumCapture={handleHumCapture}
  onFirstAction={handleFirstAction}
  collaborators={collaborators}
  className="w-full"
  style={{ height: 'calc(100vh - 160px)' }}
/>

{/* Work layers panel becomes a slide-in drawer, not a grid column */}
{activeLayer !== 'ideas' && activeLayer !== 'room' && (
  <WorkLayerDrawer activeLayer={activeLayer} onClose={() => setActiveLayer('room')} />
)}
```

The `SongCanvasWorkLayers` (Lyrics/Voice/Chords panels) moves into a slide-up drawer triggered by the layer chips at the top. This gives the canvas full screen.

---

## PERFORMANCE CHECKLIST

- [ ] `will-change: transform` set on `.canvas-layer` during active gesture, cleared after
- [ ] `transform-origin: 0 0` — zoom happens from top-left (correct for coordinate math)
- [ ] `touch-action: none` on the viewport container (prevents scroll interference)
- [ ] `user-select: none` on the canvas layer (prevents text selection during pan)
- [ ] All pointer tracking uses `useRef`, not `useState`
- [ ] `applyTransform()` is the ONLY DOM write per gesture frame
- [ ] `requestAnimationFrame` gate if multiple events fire per frame (optional optimization)
- [ ] `React.memo` on every card component (prevent cascade re-renders on state change)

---

## ACCESSIBILITY

- Canvas has `role="application"` and `aria-label="Song canvas"`
- Each card is a `<button>` with `aria-label` from its title
- Skip link: `<a href="#canvas-toolbar">Skip to canvas controls</a>` at top
- Keyboard: `Tab` cycles through cards; `Space/Enter` selects; `Arrow keys` move selected card 8px

---

## COMPLETE FILE LIST FOR STEP 1

```
NEW:
  src/components/canvas/CanvasViewport.tsx    ← the pan/zoom container
  src/components/canvas/CanvasDivider.tsx     ← center line with drag state
  src/components/canvas/ZoneLabel.tsx         ← "Ideas Tree" / "Final Song" headers
  src/hooks/useCanvasViewport.ts              ← context hook
  src/hooks/useGesture.ts                     ← pan + pinch gesture logic (isolated)

MODIFIED:
  src/pages/SongCanvasPage.tsx                ← replace tree grid with CanvasViewport
  src/components/cog/SongCanvasWorkLayers.tsx ← convert to slide-in drawer

UNCHANGED (Step 1 does not touch these):
  src/components/cog/SongCanvasTrees.tsx      ← kept as fallback during transition
  src/components/cog/SongCanvasCollabLayers.tsx
  src/lib/pricing/pricingApi.ts
  All pages except SongCanvasPage
```

---

## STEP 1 ACCEPTANCE CRITERIA

- [ ] Canvas opens at `/songs/:id/canvas` with the two-zone layout visible
- [ ] Two-finger pan moves the canvas at 60fps (Chrome DevTools performance panel shows no layout/paint during pan)
- [ ] Pinch-to-zoom works between 0.5× and 2.0×
- [ ] Zoom centers correctly on the pinch midpoint (content doesn't jump)
- [ ] Canvas clamps — you can't pan so far that the canvas disappears
- [ ] The dot grid moves with the canvas during pan
- [ ] Center divider is visible, correctly positioned between zones
- [ ] Zone labels ("Ideas Tree" / "Final Song") are visible and correctly positioned
- [ ] On first load, canvas centers on the Ideas zone at 1.0× zoom
- [ ] Keyboard users can Tab through all canvas controls
- [ ] Existing cards (INITIAL_CARDS) appear as positioned elements on the canvas

---

*Step 1 build time estimate: 4 hours*
*Step 2 begins immediately after Step 1 passes acceptance criteria*
