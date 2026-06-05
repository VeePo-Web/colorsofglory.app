# Plan — Codex Audit Prompt for Feature 4 (Song Whiteboard Canvas)

Create one new file: `docs/codex/f4-whiteboard-canvas-audit.prompt.md`. This is a single, paste-into-Codex system prompt that turns Codex into a Staff-level performance + subtle-UX auditor for **Feature 4 only** — the Song Whiteboard Canvas at `/song/:id/canvas` (`SongCanvasExperience` + `CanvasViewport` + all `src/components/canvas/*` cards). Read-only audit, no feature work, no scope creep into other features.

## What the prompt contains

### 1. Role & mission
- Role: Staff frontend performance engineer + interaction designer, mobile-first iOS-grade standard (Apple/Fantasy.co bar).
- Mission: prove or disprove that the canvas feels **instant** on a mid-tier Android (Moto G Power class) and iPhone 12 mini under throttling, with **zero perceptible friction** on the core gestures: open canvas, pan, pinch-zoom, tap card, drag card, hold-to-record hum, add lyric/chord/note, scroll long song.
- Hard scope: only files under `src/components/canvas/**`, `src/pages/SongCanvasPage.tsx`, `src/hooks/useGesture.ts`, `src/lib/canvas/**`, and CSS tokens they consume. Anything else → out of scope, list as "adjacent" only.

### 2. Guardrails
- Read-only. No edits, no migrations, no installs. May create files **only** under `docs/codex-audit-artifacts/f4/` (reports, traces, screenshots, flamecharts).
- No backend calls, no Twilio, no Stripe. No service-role key.
- Budget: ≤ 90 min wall clock, ≤ 6 Chrome traces, ≤ 20 screenshots.
- Never block the main thread > 50 ms in a measurement script.

### 3. Pre-flight inventory (Codex must produce first)
- Map every component in `src/components/canvas/` with: LOC, re-render triggers, memoization status, props surface, animation library used (Framer Motion vs CSS), event handlers attached, whether it reads context/zustand.
- Bundle analysis: route-chunk size for `/song/:id/canvas` (gzipped + raw), top 10 modules by bytes, framer-motion footprint, any duplicate deps.
- Asset audit: SVG/PNG sizes in canvas, font subset usage, any non-lazy images.

### 4. Performance audit matrix (the core)
Run each under: **Desktop unthrottled**, **4× CPU throttle + Fast 3G**, **6× CPU throttle**. Record metrics per run.

| ID | Scenario | Target | Metric captured |
|----|----------|--------|-----------------|
| P1 | Cold load `/song/:id/canvas` with 1 song | LCP < 1.2 s desktop / < 2.5 s throttled | LCP, FCP, TTI, TBT, route JS bytes |
| P2 | Hot navigate from `/song/:id` → canvas | Transition < 120 ms paint | Long tasks, route-transition flamechart |
| P3 | Pan with 1 finger across 30 cards | 60 fps sustained, INP < 100 ms | fps timeline, dropped frames, scripting/painting % |
| P4 | Pinch-zoom 0.5×↔2× | 60 fps, no layout thrash | fps, layout count, composite layers |
| P5 | Tap card → expand/active state | INP < 100 ms, no CLS | INP, CLS, hit-target size |
| P6 | Drag card 200 px | 60 fps, pointer-to-paint < 16 ms | pointer event latency, RAF cadence |
| P7 | Hold-to-record hum (3 s) | Mic permission prompt < 200 ms after press, ring animation 60 fps | timeline, audio worklet init time |
| P8 | Add 50 cards programmatically | First card paint < 50 ms each, no GC pause > 16 ms | heap, GC, virtualization status |
| P9 | Long-song scroll (200 lyric lines) | 60 fps, no jank | fps, layer count, repaint regions |
| P10 | Memory after 5 min interaction | Heap delta < 15 MB, no detached nodes | heap snapshots ×3 diff |
| P11 | Reduced-motion + low-power | All Framer Motion respects `prefers-reduced-motion` | manual + audit |
| P12 | Re-render storm | Each gesture re-renders only intended subtree | React Profiler commit list |

For each: capture before/after candidate fix hypothesis, file:line evidence, root cause (not symptom).

### 5. Subtle-UX audit (the second core)
Codex must walk every canvas interaction and score against an explicit rubric. No vague verdicts.

Rubric (1–5 each, with file:line evidence):
1. **Tap response latency** — visual ack within 1 frame? haptic-equivalent?
2. **Gesture forgiveness** — drag dead-zone (8–10 px), tap vs drag disambiguation, double-tap zoom thresholds.
3. **Hit targets** — every interactive ≥ 44×44 px; list violations.
4. **Focus & keyboard** — full keyboard nav across cards, visible focus ring, no traps.
5. **Reduced motion** — alt transitions present, no parallax/scale on `prefers-reduced-motion: reduce`.
6. **Loading skeletons** — no layout shift on card content arrival; skeletons match final geometry.
7. **Empty states** — first-action prompt clarity, single primary CTA, copy < 8 words.
8. **Error states** — mic denied, offline, save fail — surfaced calmly per COG voice (no red badges).
9. **Spatial orientation** — minimap / zone labels / pan limits prevent "lost in canvas".
10. **Undo affordance** — every destructive gesture reversible within 5 s with visible affordance.
11. **Audio UX** — hold-to-record cancel zone (slide up to cancel), waveform appears within 200 ms of stop.
12. **Color/contrast** — gold-on-cream WCAG AA for all states; list any < 4.5:1.
13. **Copy discipline** — banned words list (Click, Tap here, Submit, Loading…), serif only on song titles.
14. **Z-order & overlays** — no card occludes the active recording ring; modals trap focus.
15. **Animation budget** — total simultaneous animations ≤ 3; identify any runaway loops.

### 6. Specific code smells to hunt (with examples)
- `useEffect` without deps, or deps that re-create objects every render.
- Inline `style={{}}` objects on hot paths (cards) causing re-renders.
- Framer Motion `layout` / `layoutId` on long lists without `LayoutGroup` discipline.
- Non-memoized children of `CanvasViewport`.
- Pointer events not using `setPointerCapture`.
- Missing `will-change` or overuse causing extra layers.
- `box-shadow` on animating elements (paint cost) vs `filter: drop-shadow`.
- Re-creating gesture handlers per render in `useGesture.ts`.
- Reading large arrays from context without selector memoization.
- Async work on main thread that should be in `requestIdleCallback` or a Web Worker (waveform generation, hash, transcripts).

### 7. Deliverables (exact file layout)
```
docs/codex-audit-artifacts/f4/
  README.md
  00-inventory.md              # component map + bundle table
  01-perf-matrix.md            # P1..P12 results table with metrics + traces
  02-subtle-ux-rubric.md       # 15-row rubric with scores + evidence
  03-code-smells.md            # ranked list, severity, file:line, fix hypothesis
  04-prioritized-fixes.md      # P0/P1/P2 with expected ms saved or UX delta
  05-quick-wins.md             # ≤ 30 min each, ordered by impact/effort
  traces/                      # *.json Chrome traces named by scenario
  screenshots/                 # before/after-hypothesis stills
  SUMMARY.md                   # 1 page: verdict, top 5 fixes, instant-feel score /100
```
`SUMMARY.md` must include an explicit **Instant-Feel Score /100** with weighted breakdown (P3,P5,P6 weighted highest) and a one-paragraph verdict the user can paste back to Claude as the fix brief.

### 8. Methodology rules
- Every claim cites `path:line` and a metric or trace filename. No prose-only assertions.
- Every fix recommendation has: root cause → proposed change → expected metric delta → risk → est. effort (S/M/L).
- Distinguish **measured** vs **inferred** findings explicitly.
- No recommendation may add a new dependency without justification + size delta.
- No recommendation may alter visual design tokens (cream/gold/serif) — that's Claude's domain; flag only WCAG violations.

### 9. Tone & style
- Terse, engineer-to-engineer, no hype, no emojis.
- Numbers first, prose second.
- If a scenario can't be measured in the sandbox (e.g. real mic), say so and propose the device-lab procedure.

### 10. Acceptance criteria for the audit itself
- All 12 perf scenarios attempted or explicitly marked N/A with reason.
- All 15 rubric rows scored.
- ≥ 10 ranked code-smell findings with file:line.
- ≥ 5 quick-wins each ≤ 30 min.
- `SUMMARY.md` ≤ 1 page and contains the Instant-Feel Score.

## Deliverable from this loop
One file: `docs/codex/f4-whiteboard-canvas-audit.prompt.md` (~600–900 lines), self-contained, paste-ready into Codex from repo root. No other files touched.
