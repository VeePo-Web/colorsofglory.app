
# Song Canvas — Layout Plan

Scope: layout only — z-order, regions, spacing, gestures, responsive behavior. No new features, no data model changes. Owned by Claude (frontend). Lovable + Codex untouched.

## 1. Layout regions (390px mobile, top → bottom)

```text
┌───────────────────────────────────────────┐  z:30 (sticky, no scroll)
│  ◀ Songs    [CogMark]              ⋯      │  56 px  HEADER ROW 1
│             Song Title (serif, 17px)      │
├───────────────────────────────────────────┤
│  Canvas · Ideas · Final · Compare   🔍−+ │  44 px  MODE BAR   (z:29)
├───────────────────────────────────────────┤
│                                           │
│                                           │
│         CANVAS VIEWPORT (flex-1)          │  z:0  pan/zoom layer
│         · dot-grid background             │
│         · ZoneLabels (Ideas / Final)      │
│         · CanvasDivider (vertical)        │
│         · Cards (memoized)                │
│                                           │
│   ┌──────────────────┐                    │
│   │ FirstActionPrompt│  (one-time, z:20)  │
│   └──────────────────┘                    │
│                                           │
│                                  ╭─────╮  │  z:40  MIC FAB (64px)
│                                  │  🎙 │  │  bottom-right, 16+safe
│                                  ╰─────╯  │
├───────────────────────────────────────────┤
│  Lyrics  Voice  Chords  Notes  People    │  60 px  SongTabBar (z:30)
└───────────────────────────────────────────┘
```

Total chrome: 56 + 44 + 60 = **160 px**. Canvas viewport claims the remaining ~540 px on a 390×700 device.

## 2. Z-order contract (single source of truth)

| Layer | z-index | Notes |
|---|---|---|
| Canvas dot-grid + cards (transformed layer) | 0 | inside `CanvasViewport` |
| Divider + ZoneLabels | 1 | in canvas space |
| Selected card halo | 2 | sibling of selected card |
| Drag-ghost / drop target | 5 | overlay during card drag |
| ModeBar (Canvas/Ideas/Final/Compare + zoom) | 29 | fixed below header |
| Header (back + title) | 30 | fixed top |
| SongTabBar | 30 | fixed bottom |
| FirstActionPrompt | 20 | dismissable, **never** above FAB |
| Mic FAB | 40 | always on top of overlay (fixes F16) |
| Recording / review sheets | 50 | full-screen modal layer |
| Toasts | 60 | sonner default |

Rule: nothing above 40 except modals and toasts. FirstActionPrompt drops from 50 → 20.

## 3. Header (row 1) — 56 px

- Left: `◀ Songs` text + chevron, 44 px hit-target.
- Center: stacked `CogMark` (16 px) + truncated song title (serif 17/22, max 60% width).
- Right: `⋯` overflow (versions, activity, credits, share). Currently absent — reserve the slot now.
- Background: `--cog-cream` with 1 px bottom hairline `--cog-border` only when canvas is scrolled/panned past origin.

## 4. Mode bar (row 2) — 44 px

Replaces the current 6-chip "Canvas/Lyrics/Voice/Chords/Notes/People" strip in the header. Splits responsibilities:

- **Mode chips (left, scrollable)**: `Canvas · Ideas · Final · Compare`. Each 44×32, gold underline when active.
- **Zoom cluster (right)**: `−  100%  +  ⤢fit`. 32 px tap-targets joined into one pill.
- Live region announces zoom + mode for SR.

The 5 work-panel layers (Lyrics/Voice/Chords/Notes/People) move out of the header and into the existing **SongTabBar** at the bottom — one canonical home, kills the duplication.

## 5. Canvas viewport

- Fills `flex-1`, `overflow: hidden`, `touch-action: none`.
- Internal canvas space: 2400 × 3200, divider at x = 1200 (unchanged).
- Initial centering: pan so Ideas zone is centered horizontally, y offset = -400 (matches current `CanvasViewport.tsx:130`).
- **Safe insets**: cards spawn with margin `≥ 96 px` from the divider and `≥ 64 px` from canvas edges so the FAB and SongTabBar never occlude a freshly-added card. Cards added in Final zone respect a 96 px right margin.
- Background: existing 32 px radial dot grid + a single subtle radial glow at canvas y=2400 (the COG warmth signature, behind everything, no animation).

## 6. Cards (size + spawn grid)

- Mobile card: 220 × 132 (was 210 × 132). Bump width so 18px serif + 13px meta fits without ellipsis on Verse labels.
- Spawn algorithm: 3-col Ideas grid (col widths 220 + 36 gutter), origin x=80, y=200. Final zone mirrors at x=DIVIDER_X+80. Replaces the current `Math.random()` jitter in `addCard` and `handleMoveToFinal` (visual stability — eliminates collision repaints).
- Selected card: 2 px gold border + 12 px lift via `transform: translateY(-2px)`, no shadow animation (per F6 finding).

## 7. FirstActionPrompt placement

- Anchored bottom-center, 24 px above SongTabBar, 320 × auto.
- Width capped at `min(320px, 100vw - 32px)`.
- Dismiss on: first card add, FAB tap, or 8 s idle after first paint.
- Never overlaps the FAB (FAB owns the right rail, prompt owns the bottom-center; FAB has z:40, prompt z:20).

## 8. Mic FAB

- 64 × 64, fixed `bottom: calc(60px + 16px + env(safe-area-inset-bottom))`, `right: 16 px`.
- Press: `scale(0.95)` 150 ms. Hold (≥ 250 ms): triggers `useVoiceRecorder.startRecording()` and opens RecordingSheet (z:50).
- Disabled state while `recordingFlow !== "idle"`: opacity 0.5, pointer-events none.

## 9. Recording + review sheets

- Bottom sheet, 100% width, max-height 88dvh, rounded-top 24 px.
- Backdrop blur 8 px on overlay.
- Drag-to-dismiss disabled while recording (prevents accidental cancel).

## 10. Responsive breakpoints

| Width | Layout change |
|---|---|
| ≤ 430 px (default mobile) | Spec above. SongTabBar visible. |
| 431–767 px (large phone / small tablet) | Header gains right-side action group (Activity ⏱, Share ↗) inline; mode bar unchanged. |
| ≥ 768 px (tablet/desktop) | Header max-width 1180 px, mode bar centers. SongTabBar becomes a left rail (60 px wide) instead of bottom bar. Canvas fills remaining width. |

## 11. Reduced-motion + a11y guardrails

- Add `@media (prefers-reduced-motion: reduce)` block in `index.css` that disables card entrance translate, FAB pulse, divider glow transition, and FirstActionPrompt fade.
- All bar/chip buttons get visible `:focus-visible` ring (`outline: 2px solid var(--cog-gold)`, offset 2 px).
- `role="application"` stays on viewport; mode bar gets `role="tablist"` + `aria-controls="canvas-viewport"`.

## 12. Files this layout plan will touch (build phase)

- `src/components/canvas/SongCanvasExperience.tsx` — header restructure, mode bar extraction, spawn grid, FAB position, prompt z-index, remove layer chips.
- `src/components/canvas/CanvasModeBar.tsx` — **new**, 80 LOC.
- `src/components/canvas/CanvasViewport.tsx` — initial centering unchanged; add zoom-cluster callbacks.
- `src/components/canvas/FirstActionPrompt.tsx` — width cap + z:20 + auto-dismiss timer.
- `src/components/cog/SongTabBar.tsx` — add Canvas tab as default active state when on `/canvas`.
- `src/index.css` — reduced-motion block + focus-visible token.

## 13. Out of scope (do not bundle)

- Memoized-card refactor (F2) — separate Codex-driven fix, already planned in `docs/codex-audit-artifacts/f4/03-prioritized-fixes.md`.
- Drag-card pointer capture (F12) — depends on F2.
- New routes, new data shapes, new backend.

## 14. Acceptance criteria

1. At 390 × 700 the canvas viewport reports ≥ 540 px of vertical room (devtools).
2. Mic FAB tappable above FirstActionPrompt without dismissing it first.
3. No header chip overflow on 360 px width (verified by Lighthouse/axe + manual).
4. Reduced-motion run shows zero card translate, zero FAB pulse.
5. New cards never spawn within 16 px of FAB, SongTabBar, header, or divider.
6. Mode + zoom announced to screen readers on change.
