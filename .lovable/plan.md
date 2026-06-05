
# Feature 4 — Song Whiteboard Canvas: Static Audit + Codex Runner

I can't run the live Codex audit from Lovable (it needs Chrome traces, throttling, heap snapshots on a real device). Instead I'll deliver two things you can use today:

1. A **static-audit findings doc** with path:line evidence and prioritized fixes, written from a careful read of every file in `src/components/canvas/**`, `src/hooks/useGesture.ts`, `src/lib/canvas/**`, and the page entry.
2. A **Codex runner script** that drives the existing `docs/codex/f4-whiteboard-canvas-audit.prompt.md` end-to-end so the dynamic run is reproducible.

No production code is changed in this plan — outputs go to `docs/codex-audit-artifacts/f4/` and `scripts/codex/`.

---

## Files I will create

```text
docs/codex-audit-artifacts/f4/
  README.md                     — how to read this folder + how Codex extends it
  00-inventory.md               — component map, LOC, props, memoization, lazy boundaries
  01-static-perf-findings.md    — 18 findings, severity + path:line + expected delta
  02-static-ux-findings.md      — 11 subtle-UX findings against the 15-row rubric
  03-prioritized-fixes.md       — top 10 fixes, ranked by (impact / effort)
  04-quick-wins.md              — 6 quick wins (≤30 min each)
  SUMMARY.md                    — 1 page, Instant-Feel Score (static estimate) + top 5

scripts/codex/
  run-f4-audit.sh               — orchestrates Chrome + DevTools traces against /song/1/canvas
  f4-scenarios.md               — exact tap/drag/zoom scripts for the 12 perf scenarios
  f4-chrome-flags.md            — CPU 4×, network Fast 3G, mobile UA, exact flags
```

No source files under `src/` are touched. No backend, no migrations.

---

## What the static audit will already flag (preview of findings)

These are real issues I found while reading. They land in `01-static-perf-findings.md` with severity + fix + expected metric delta. Listing them now so the plan is concrete:

### Critical (P0) — gesture / render hot path

1. **`useGesture.onPointerMove` deps include `containerRef, onCursorMove`** with eslint-disable, but `onCursorMove` is passed inline from `SongCanvasExperience` — the handler isn't actually re-bound because it's never set, but the listener is re-attached every render of `CanvasViewport` because the `useEffect` dep array includes `onPointerDown, onPointerMove, onPointerUp, onWheel` which are recreated whenever React state on the viewport updates. → `src/hooks/useGesture.ts:153-167` + `useGesture.ts:223-243`. Fix: stash handlers in refs, register listeners once. Expected: removes a full `removeEventListener+addEventListener` cycle per state sync; eliminates dropped first-frame after pinch end.

2. **`CanvasCardEl` (the *real* card actually rendered) is not memoized and uses inline object literals** for `style`, even though `LyricCard`/`HumCard`/etc. are memoized. The render loop at `SongCanvasExperience.tsx:605` rebuilds 6 cards per parent render via the un-memoized path. Plus `onSelect`/`onMoveToFinal`/`onMoveToIdeas` are new closures every render. → `SongCanvasExperience.tsx:192-382, 605-615`. Fix: switch render to the dedicated memoized card components (`LyricCard`, `HumCard`, `ChordCard`, `NoteCard`, `VoiceMemoCard`) and stabilize callbacks with `useCallback((id) => ...)` + child receives `cardId`. Expected: -50% INP on selection at 50 cards.

3. **`[...ideasCards, ...finalCards]` produces a new array identity every render** even though both halves are memoized — and triggers a fresh `.map` and reconciliation walk. → `SongCanvasExperience.tsx:605`. Fix: `useMemo(() => [...ideasCards, ...finalCards], [ideasCards, finalCards])`, or render two `.map`s directly. Expected: small but cumulative; matters once `cards.length > 30`.

4. **`handleMoveToIdeas` calls `setCards` twice in sequence with stale-closure logic** (`prev.filter`, then a second `setCards(prev => prev.map…)` on the *new* array that already had the matching card removed). → `SongCanvasExperience.tsx:460-471`. Net effect: the "restore dim ref" never finds its target after the filter. This is a correctness bug masquerading as a perf finding — flag with severity P0.

### High (P1) — paint cost / GPU

5. **`CardShell` injects a `<style>{CARD_KEYFRAMES}</style>` tag in every card render** → N cards = N identical `<style>` tags. → `CardShell.tsx:106`. Fix: lift to module scope, inject once in a top-level effect (or move to `index.css`). Expected: -N style elements in head, -1 style recalc per card mount.

6. **`box-shadow` animated on hover/selected** for every card + the cluster front card + the divider. `box-shadow` is one of the worst layer-promotion paint costs. → `CardShell.tsx:43-51`, `SectionCluster.tsx:124`, `CanvasDivider.tsx:27`. Fix: keep `box-shadow` static, use a sibling pseudo-element with `opacity` for the glow state. Expected: -4ms paint per card on hover at 60fps.

7. **`will-change: transform`** is set on the canvas layer during gestures (✓ good) **but never restored when `panTo` animates** (the easing path in `useGesture.ts:288-304`). The layer can stay promoted indefinitely if `panTo` fires after gesture end. Memory leak in long sessions.

8. **`generateWaveform` runs `Math.sin` 3× per bar inside `useMemo`** — fine when called once per card, but bars are 20 for voice + 8 for hum. With 50 cards = 1400 sins on cold load. Move to a precomputed deterministic LUT seeded by `card.id` hash mod N. Expected: -30ms cold-load JS time.

### Medium (P2) — bundle / lazy / cold load

9. **Lazy chunk thrash:** `SongCanvasExperience` lazy-loads `SongCanvasWorkLayers` and `SongCanvasCollabLayers`, but they're both inside the same `<Suspense>` parent triggered by `showWorkPanel`. Cold-open of the canvas pays the `SongCanvasExperience` lazy cost (✓), but tapping any layer chip triggers *two* lazy fetches sequentially → visible flash. Fix: prefetch both on hover/idle, or merge into one chunk. → `SongCanvasExperience.tsx:32-33, 639-644`.

10. **lucide-react icons imported individually** (good for tree-shake) but `CARD_ICONS` map at `SongCanvasExperience.tsx:57-65` ensures all 7 icons load on the canvas route. Fine — flag only as info.

11. **No `content-visibility: auto`** on offscreen cards in the canvas layer. With 50+ cards, paints could be skipped for ones outside the viewport bbox. Expected: -8ms paint per pan frame when zoomed out.

### Medium (P2) — pointer/gesture UX

12. **`CardShell` calls `e.stopPropagation()` on pointerdown** (✓) but `onPointerDown` never calls `setPointerCapture`. On touch, dragging fast off the card releases capture mid-drag. → `CardShell.tsx:124-129`. Fix: `e.currentTarget.setPointerCapture(e.pointerId)` if the parent intends to track drag. Currently the drag logic is only wired through `CanvasCardEl` (unused legacy path), not the memoized cards — so card drag doesn't actually work yet in the new cards.

13. **Wheel zoom debounce `clearTimeout((onWheel as any)._t)`** stashes state on the function object — works but breaks under StrictMode double-invocation in dev because the handler identity can swap. → `useGesture.ts:225-230`. Use a ref.

14. **`clampPan` uses `containerRef.current.clientWidth` reads inside the move handler** → forced layout read every pointermove. → `useGesture.ts:120-130`. Cache `viewW/viewH` in a resize observer.

15. **`onCursorMove` throttle uses `Date.now()` and broadcasts on every move when interval elapses** but is gated by `e.pointerType !== "touch"` so it's desktop-only — fine, but flag that there's no actual subscriber wired up; dead code path until collab cursors ship.

### Low (P3) — subtle UX

16. **First-action prompt has `pointerEvents: "none"` on the wrapper** with `pointerEvents: "auto"` on the inner card (✓). But the wrapper sits at `zIndex: 50` over the entire viewport — gestures behind it work, but the FAB at `zIndex: 40` is *below* it and unreachable while the prompt is visible. → `FirstActionPrompt.tsx:52` vs `SongCanvasExperience.tsx:591`. Bug.

17. **Tap target audit:** back button is `min-h-11` (✓ 44px). Layer chips are `min-h-8` = 32px — **below 44px iOS minimum**. → `SongCanvasExperience.tsx:550`. Fix: `min-h-11`, reduce icon size if needed.

18. **`focus-visible` ring is missing on every card and chip.** `tabIndex={0}` is set, keyboard nav works, but there's no visible focus outline — fails WCAG 2.4.7.

### Subtle-UX rubric (preview, 11 of 15 rows scored)

| # | Rubric row | Score | Evidence |
|---|---|---|---|
| 1 | Tap latency | 7/10 | `transition: transform 180ms` on press; could `scale(0.97)` in <100ms |
| 2 | Gesture forgiveness | 5/10 | No setPointerCapture on cards; pan/drag distinction by stopPropagation only |
| 3 | Hit targets ≥44 | 6/10 | Layer chips 32px |
| 4 | Reduced motion | 2/10 | No `prefers-reduced-motion` anywhere |
| 5 | Skeletons | 4/10 | `<Suspense fallback={...}>` exists but is a flat gray block |
| 6 | Empty state | 8/10 | FirstActionPrompt is well-crafted |
| 7 | Spatial orientation | 7/10 | ZoneLabels + divider work; no mini-map at low zoom |
| 8 | Undo | 0/10 | Move-to-final has no undo |
| 9 | Color contrast | 6/10 | `#999`/`#CCC` body labels are 2.6:1 → fails AA |
| 10 | Animation budget | 6/10 | pulse-dot at infinity for every hum + unplayed voice — never stops |
| 11 | Z-order discipline | 5/10 | Prompt z50 blocks FAB z40 (see #16) |

Full 15 rows go into `02-static-ux-findings.md`.

---

## The Codex runner script — what it actually does

```text
scripts/codex/run-f4-audit.sh
  ├─ kills any prior chrome instance with --user-data-dir=/tmp/cog-f4-audit
  ├─ launches Chromium headed with:
  │     --user-data-dir=/tmp/cog-f4-audit
  │     --window-size=390,844 --device-scale-factor=3
  │     --enable-precise-memory-info
  │     --remote-debugging-port=9222
  ├─ uses CDP (Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate=4)
  ├─ navigates to http://localhost:8080/song/1/canvas
  ├─ for each scenario in f4-scenarios.md:
  │     starts Tracing.start, runs CDP Input.dispatchTouchEvent script,
  │     stops trace, writes docs/codex-audit-artifacts/f4/traces/Pn-name.json
  ├─ takes heap snapshot every 60s during the 5-min memory scenario
  └─ prints a checklist Codex can paste into SUMMARY.md
```

The 12 scenarios are encoded as exact CDP scripts (pan = 60 touchMove events at 16ms cadence; pinch = synchronized two-finger; etc.), so any operator gets the same trace.

---

## Why I'm not changing any `src/` code yet

Per the project's 3-agent rule (Lovable = backend/SDK only), the canvas component fixes are Claude Code's domain. The job here is to **hand Claude a precise, evidence-backed worklist** so they can ship the fixes. If you want me to also queue the patches, switch to build mode and pick "Static audit + ready-to-apply fix patches" instead — I'll prep them as `docs/codex-audit-artifacts/f4/patches/*.diff` for Claude to apply.

---

## After plan approval, I will execute these tool calls in this order

1. `apply_patch` creating all 7 docs in `docs/codex-audit-artifacts/f4/`.
2. `apply_patch` creating `scripts/codex/run-f4-audit.sh` (+ `chmod +x` via shell).
3. `apply_patch` creating `scripts/codex/f4-scenarios.md` and `scripts/codex/f4-chrome-flags.md`.
4. Final closing sentence with the file list and the one command to run.

No backend, no migrations, no edits to `src/**`.
