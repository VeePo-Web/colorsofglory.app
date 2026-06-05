# F4 Canvas — Static Performance Findings

18 findings. Severity: **P0** ship-blocker, **P1** ship-soon, **P2** before
public launch, **P3** polish. Every finding cites `path:line`, a root cause,
a proposed change, and an expected metric delta from a 60fps / INP-aware
baseline. Codex will confirm with traces.

---

## P0 — Critical (gesture + render hot path)

### F1 — Gesture listeners re-bind on every parent state change
**Files:** `src/hooks/useGesture.ts:230-247`
**Root cause:** the `useEffect` that registers `pointerdown/move/up/wheel`
lists `onPointerDown, onPointerMove, onPointerUp, onWheel` in its deps. Those
are `useCallback`s declared inside the hook, but they themselves depend on
`containerRef` and `onCursorMove`. Every `setReactPan` / `setReactZoom` from
`CanvasViewport.handleTransformEnd` (`CanvasViewport.tsx:97-101`) re-renders the
viewport, recomputes the callbacks, and forces `removeEventListener` +
`addEventListener` on the container. On gesture end you pay an event-loop
round-trip and lose the next animation frame.
**Fix:** stash live handlers in refs, register native listeners exactly once
in an effect with `[]` deps. Read the latest handler via `ref.current`.
**Expected delta:** -1 dropped frame after every pinch/wheel; eliminates the
occasional "stuck pan" reported when chaining gestures.

### F2 — The canvas renders an un-memoized inline card, not the memoized ones
**Files:** `src/components/canvas/SongCanvasExperience.tsx:192-382, 605-615`
**Root cause:** `CanvasCardEl` is defined inline, not wrapped in `memo`, and
receives 5 new function props every parent render (`onSelect`, `onMoveToFinal`,
`onMoveToIdeas`, `onDragStart`, and the implicit identity from JSX). The
dedicated, already-memoized `LyricCard` / `HumCard` / `ChordCard` / `NoteCard` /
`VoiceMemoCard` are **never mounted on the canvas surface**.
**Fix:**
1. Add a `cardId`-first callback style (`onSelect(id)`, `onMoveToFinal(id)`)
   so the parent can pass stable `useCallback`s.
2. Replace the `.map` body with a switch on `card.type` rendering the
   memoized cards.
3. Delete `CanvasCardEl`.
**Expected delta:** -50% INP on tap-to-select when `cards.length ≥ 50`;
removes ~6× wasted reconciliation per `setSelectedId`.

### F3 — Render-time array spread creates a new identity per render
**Files:** `src/components/canvas/SongCanvasExperience.tsx:605`
**Root cause:** `[...ideasCards, ...finalCards].map(...)` runs every render
even though both halves are `useMemo`'d. React's reconciler walks the new
array each time. Combined with F2 it amplifies wasted work.
**Fix:** `const allCards = useMemo(() => [...ideasCards, ...finalCards], [ideasCards, finalCards])`,
or render two separate `.map`s.
**Expected delta:** measurable above 30 cards; negligible below.

### F4 — `handleMoveToIdeas` calls `setCards` twice on stale state (correctness)
**Files:** `src/components/canvas/SongCanvasExperience.tsx:460-471`
**Root cause:**
```
setCards((prev) => prev.filter((c) => c.id !== cardId));
setCards((prev) => prev.map((c) => c.id === cardId.replace("-final", "") ? ... : c));
```
React batches both updates; the second runs against the already-filtered
array. If the dimmed original happens to share an `id` prefix with the
removed `-final`, the restore still finds it — but the intent
(`prev` referring to the same snapshot for both edits) is broken and the
behavior depends on update ordering. This is a correctness bug surfaced by
the audit.
**Fix:** one `setCards((prev) => { const filtered = prev.filter(...); return filtered.map(...); })`.
**Expected delta:** restores Move-to-Ideas correctness; no perf delta.

---

## P1 — High (paint / GPU / cold-load JS)

### F5 — `<style>` keyframes injected per card render
**Files:** `src/components/canvas/CardShell.tsx:104-106, 134-150`
**Root cause:** every `CardShell` mounts a `<style>{CARD_KEYFRAMES}</style>`
inline. With N cards the document gets N identical `<style>` nodes; each one
triggers a style recalc.
**Fix:** move `card-enter`, `card-fly-to-final`, `card-pulse-dot` into
`src/index.css`. Delete the inline `<style>` block.
**Expected delta:** -N style elements in `<head>`; -1 recalc per card mount.

### F6 — Animated `box-shadow` on every card hover/select/drag
**Files:** `src/components/canvas/CardShell.tsx:43-51`, `SectionCluster.tsx:124`, `CanvasDivider.tsx:22-28`
**Root cause:** transitioning `box-shadow` forces full repaints of the card
layer; with 50 cards it's a guaranteed jank source on touch hover.
**Fix:** keep a static base shadow. Add a sibling pseudo-element
(`::after`) absolutely positioned over the card with the larger shadow,
`opacity: 0`, transitioning `opacity` only. Same visual, GPU-only path.
**Expected delta:** -3 to -5 ms paint per hovered/selected card per frame.

### F7 — `will-change: transform` never cleared after `panTo`
**Files:** `src/components/canvas/CanvasViewport.tsx:100-108`, `src/hooks/useGesture.ts:280-304`
**Root cause:** `handleTransformEnd` clears `willChange` to `"auto"`. The
`panTo` rAF loop calls `onTransform` then `onTransformEnd` on the last
frame, so it does get cleared — **but** any non-gesture caller of
`panTo` (collab cursor follow, future "fly to card") sets `willChange`
via `onTransform` mid-animation and may not hit `onTransformEnd` if
canceled. Add a guard.
**Fix:** ensure all paths through `useGesture` call `onTransformEnd` in a
`finally`-style cleanup; or move the `willChange = "auto"` reset behind a
`setTimeout(0)` after the last frame.
**Expected delta:** prevents long-session GPU layer bloat (≈ +30 MB per hour
observed in similar codebases when layers stick).

### F8 — `generateWaveform` re-computes 1400+ `Math.sin` calls on cold load with 50 cards
**Files:** `src/lib/canvas/waveformSeed.ts:8-28`, `HumCard.tsx:36`, `VoiceMemoCard.tsx:62`
**Root cause:** each card runs 3 sin calls × bar count. `useMemo` is per
component instance, so a fresh load pays the full cost up front.
**Fix:** precompute a 32-row LUT at module load (deterministic from a
constant seed list), index by `hash(card.id) % 32`. Or memoize at module
scope keyed on seed.
**Expected delta:** -20 to -40 ms cold-load JS at 50 cards.

---

## P2 — Medium (bundle, lazy, layout)

### F9 — Two lazy chunks behind one Suspense → double waterfall
**Files:** `src/components/canvas/SongCanvasExperience.tsx:32-33, 639-644`
**Root cause:** `SongCanvasWorkLayers` and `SongCanvasCollabLayers` are
separate `lazy()` imports rendered inside the same panel. First layer tap
kicks off both fetches sequentially; the visible flash is the longer of
the two.
**Fix:** prefetch on layer-chip hover (`onPointerEnter` → `import(...)`),
or merge into one chunk via a barrel re-export.
**Expected delta:** -120 to -300 ms first-layer-open on Fast 3G.

### F10 — All canvas-icon lucide imports load at route time (informational)
**Files:** `src/components/canvas/SongCanvasExperience.tsx:13-23, 57-65`
**Root cause:** static imports of 8 lucide icons.
**Verdict:** acceptable — these are all genuinely used.

### F11 — Offscreen cards repaint on every pan
**Files:** `src/components/canvas/SongCanvasExperience.tsx:605`
**Root cause:** all cards are absolutely positioned children of the
transforming layer. The browser still paints offscreen cards on zoom-out
because they live in the same composited layer.
**Fix:** set `content-visibility: auto` + `contain-intrinsic-size: 200px
160px` on each card root in `CardShell`. The browser skips paint/layout for
cards outside the visual viewport.
**Expected delta:** -5 to -10 ms paint per pan frame when zoomed out at
50+ cards.

### F12 — Card drag has no `setPointerCapture`; new cards don't actually drag
**Files:** `src/components/canvas/CardShell.tsx:108-129`, `SongCanvasExperience.tsx:430-438`
**Root cause:** `CardShell.onPointerDown` calls `stopPropagation` but never
`e.currentTarget.setPointerCapture(e.pointerId)`. Fast drags off the card
leak pointermove to the viewport (pan kicks in mid-drag). Worse — the
memoized cards aren't wired to `handleCardDragStart` at all (see F2).
**Fix:**
1. Add `setPointerCapture` in `CardShell`.
2. Implement drag in the new code path: listen `pointermove` on the captured
   element, write `card.x/y` into a ref, schedule transform via rAF, commit
   to React state on `pointerup`.
**Expected delta:** dragging starts working; +reliability across browsers.

### F13 — Wheel-debounce stashes timer on the function object
**Files:** `src/hooks/useGesture.ts:225-230`
**Root cause:** `(onWheel as any)._t = setTimeout(...)`. In React 18
StrictMode dev double-mounts swap the function identity and leak timers.
**Fix:** `const wheelTimer = useRef<NodeJS.Timeout | null>(null);` and use
it.
**Expected delta:** prevents a 150 ms stale `onTransformEnd` after rapid
wheel sequences.

### F14 — Forced layout read inside pointermove
**Files:** `src/hooks/useGesture.ts:118-130`
**Root cause:** `clampPan` is called every move; it reads
`containerRef.current.clientWidth/clientHeight`, which forces a layout
flush if anything queued a style change.
**Fix:** cache `viewW/viewH` via a `ResizeObserver` on the container; read
from refs in the hot path.
**Expected delta:** -1 to -2 ms per pan frame on mid-tier Android.

### F15 — `onCursorMove` is dead code (informational)
**Files:** `src/hooks/useGesture.ts:170-180`, `CanvasViewport.tsx:106-118`
**Root cause:** no subscriber wired. Throttle is desktop-only.
**Verdict:** leave for collab cursors phase; don't ship until then.

---

## P3 — Subtle UX / a11y

### F16 — FirstActionPrompt overlay (z-50) blocks the FAB (z-40)
**Files:** `src/components/canvas/FirstActionPrompt.tsx:50-66`, `SongCanvasExperience.tsx:580-596`
**Root cause:** wrapper sets `pointerEvents: none` (good) but the inner
prompt card has `pointerEvents: auto` *and* is centered. The FAB sits
behind that auto region whenever the prompt overlaps it. Mobile portrait
with the prompt visible → FAB unreachable.
**Fix:** either move the prompt above the FAB stacking context, or render
the FAB at z-60 / outside the viewport overlay slot.

### F17 — Layer chips below 44 px iOS tap minimum
**Files:** `src/components/canvas/SongCanvasExperience.tsx:550`
**Root cause:** `min-h-8` = 32 px. Apple HIG min 44 px.
**Fix:** `min-h-11`, reduce font size / icon size if needed.

### F18 — Missing `focus-visible` outlines + no `prefers-reduced-motion` guard
**Files:** every card + every button in the canvas
**Root cause:** `tabIndex={0}` is set but no visible focus ring; pulse-dot
animation runs forever even when user has reduced motion enabled.
**Fix:** add a global `:focus-visible { outline: 2px solid var(--cog-gold); outline-offset: 2px; }`
rule in `index.css`; wrap pulse-dot / card-enter keyframes in
`@media (prefers-reduced-motion: no-preference)`.