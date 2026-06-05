# F4 Canvas — Subtle UX Rubric (Static)

15 rows scored 0–10 from source reading. Codex re-scores after live runs.

| # | Row | Score | Evidence (path:line) | Fix |
|---|---|---|---|---|
| 1 | Tap latency | 7/10 | `CardShell.tsx:43-51` transition is 180 ms on transform | Move press feedback to 100 ms, defer the 180 ms settle to a second transition |
| 2 | Gesture forgiveness | 5/10 | `CardShell.tsx:108-129` no setPointerCapture; pan/drag disambiguated by `stopPropagation` only | F12 fix |
| 3 | Hit targets ≥44 px | 6/10 | Layer chips `min-h-8` `SongCanvasExperience.tsx:550`; close-panel `width:32` `:632`; action buttons inside cards `height:30` | Raise to 44 px, use icon-only when needed |
| 4 | Keyboard navigation | 7/10 | `CardShell.tsx:131-137` Enter/Space → onClick; layer chips are buttons (good); no `Escape` deselects | Add `Escape` on viewport → `setSelectedId(null)` |
| 5 | Reduced motion | 2/10 | No `@media (prefers-reduced-motion)` anywhere | F18 fix |
| 6 | Skeletons / loading | 4/10 | `SongCanvasPage.tsx:18-32` is a blank cream box; `:639` Suspense fallback is a flat gray block | Add shimmering card placeholders |
| 7 | Empty state | 8/10 | `FirstActionPrompt.tsx` is well-crafted, three clear chips | Add hover/focus rings on chips |
| 8 | Error state | 3/10 | No error boundary around the lazy chunks | Wrap `<SongCanvasExperience>` in an `ErrorBoundary` with retry CTA |
| 9 | Spatial orientation | 7/10 | ZoneLabels + divider; no mini-map; pan can clamp 120 px past edges `useGesture.ts:115-118` (good elastic) | Add a tiny zone-indicator chip showing "Ideas / Final" based on pan center |
| 10 | Undo discipline | 0/10 | `handleMoveToFinal` `:440-458` has no undo; `handleMoveToIdeas` is buggy (F4) | Add toast with Undo CTA, store last move in a ref for 8 s |
| 11 | Audio UX | 6/10 | `VoiceMemoCard.tsx:71-101` creates `new Audio()` per card; no preload; no scrubbing | Lazy-create on first play (already done), add seek handler on progress bar |
| 12 | Color contrast (WCAG AA 4.5:1 body) | 4/10 | `#999` on `#FFF` ≈ 2.85:1 (LyricCard `:115, :155`, all cards); `#CCC` ≈ 1.6:1 (footer text) | Tighten to `#6B6459` (warm gray token, 5.4:1) |
| 13 | Copy discipline | 8/10 | "Quick hum", "Move to Final" — clear, short | Replace `→ Final` arrows with text-only on screen readers via `aria-label` |
| 14 | Z-order discipline | 5/10 | Prompt z-50 over FAB z-40 (F16); work panel z-40 over canvas, no backdrop | Define a tokenized z scale: surface 0, content 10, selection 20, drag 50, overlay 60, modal 70 |
| 15 | Animation budget | 6/10 | `card-pulse-dot` runs forever on every unplayed voice + every hum (`HumCard.tsx:80`, `VoiceMemoCard.tsx:131`); transitions on box-shadow (F6) | Stop pulse after 30 s; F6 fix |

## Net subtle-UX score (static estimate)

`(7+5+6+7+2+4+8+3+7+0+6+4+8+5+6) / 150 = 78 / 150 = 52%`

Codex will refine after live runs. Target after P0+P1+P3 fixes: ≥ 120 / 150
(80%).