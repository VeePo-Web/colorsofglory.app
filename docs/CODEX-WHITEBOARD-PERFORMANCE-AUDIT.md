# Codex Whiteboard Performance Audit

Date: 2026-06-04
Scope: Colors of Glory songwriting whiteboard, private song room flow, canvas layers, redirects, mobile instant-feel.

## Executive Verdict

The whiteboard is currently green for the Codex QA gate and has a good performance skeleton. The route is split, the old feature pages redirect into canvas layers, and the core song-room metaphor is finally pointed the right way: deep, not wide.

But this is still a staged prototype. It will not survive the full 33-feature songwriting engine unless the next feature work treats performance as part of the product model. The canvas cannot become "one page with everything mounted." It has to become one room with smart doors, lazy drawers, and instant-feeling surfaces.

Current feel: calm, responsive, Church Center-adjacent.
Future risk: high if audio, transcription, drag, comments, versions, and collaborators all mount into one React tree without virtualization and feature chunking.

## Hard Evidence

Fresh command:

```bash
npm.cmd run qa:codex
```

Result: passed hard checks.

Passed:
- lint
- typecheck
- production build
- unit/mobile tests
- bundle budget
- old-brand scan
- legacy filename scan
- basic accessibility source checks
- instant-feel source checks
- placeholder route scan
- production preview route smoke, 23 routes

Warnings:
- Browserslist data is stale.
- Shared Supabase/client vendor chunk is large: about 203.1 kB raw, 52.7 kB gzip.

Current bundle shape:

| Asset | Raw size |
|---|---:|
| Main JS | 313.4 kB |
| Shared client chunk | 203.1 kB |
| Main CSS | 87.1 kB |
| SongCanvasPage | 11.71 kB |
| SongCanvasTrees | 7.69 kB |
| SongCanvasWorkLayers | 7.64 kB |
| SongCanvasCollabLayers | 3.38 kB |
| SongWorkspacePage | 4.41 kB |
| BottomNav | 2.68 kB |

Good news: the canvas route chunk is under budget.
Quiet alarm bell: the main JS and shared client chunk leave less room than we want before audio, transcription, drag, and offline sync arrive.

## What Is Working

### 1. The whiteboard is now a real private room

Old `/lyrics`, `/voice`, `/chords`, `/notes`, `/people`, `/activity`, and `/credits` routes redirect back into `/songs/:id/canvas?layer=...`.

This is the right product shape. Songwriters should not feel like they are filing paperwork in seven tabs. They should feel like they are inside one song.

### 2. Canvas chunks are split correctly

`SongCanvasPage` lazy-loads:
- `SongCanvasWorkLayers`
- `SongCanvasTrees`
- `SongCanvasCollabLayers`

This keeps the route from swallowing the entire songwriting engine on first touch.

### 3. The first interaction model is simple

Primary actions are clear:
- Add idea
- Record idea
- Invite

This matches the Church Center principle: one obvious next step, no noisy dashboard energy.

### 4. Mobile render is covered

The 390px mobile smoke test includes the whiteboard and verifies core headings:
- Lyrics
- Voice memos
- Chord map
- Song notes
- Ideas Tree
- Final Tree
- In this room
- What changed

That gives Codex a foothold for future regression checks.

## Performance Findings

### P1 - Tree rendering will not scale to serious song rooms

Current pattern:

`SongCanvasTrees.tsx` maps every card in `TreePanel`, then each node renders as a full button/card.

Risk:
- 20 cards: fine.
- 100 cards: okay-ish on desktop, risk on mobile.
- 500 cards: not acceptable.
- 5,000 cards across versions, suggestions, takes, and collaborators: the room starts wheezing.

Required fix before deep canvas expansion:
- Add windowing or grouped rendering for Ideas Tree and Final Tree.
- Render only visible cards plus a small overscan.
- Keep selected card detail separate from the list render path.
- Add a stress test with 250, 1,000, and 5,000 mock cards.

Target:
- Selecting a card should stay under 100 ms on mid-tier mobile.
- Layer switching should stay visually instant under 50 rendered nodes.

### P1 - All work-layer cards mount even when only one layer is focused

Current pattern:

`SongCanvasWorkLayers` renders Lyrics, Voice, Chords, and Notes every time, then marks one active.

This is acceptable for static mock cards. It is not acceptable once these become:
- rich text lyrics editor
- real waveform cards
- MediaRecorder/audio playback
- chord detection
- transcription previews
- comments and suggestions

Required fix:
- In `room` mode, show lightweight summaries for each layer.
- In focused layer mode, mount the heavy editor/player only for that layer.
- Keep expensive audio/editor components out of the initial room render.

Rule:
One room does not mean one mounted component forest.

### P1 - Canvas layer switching uses smooth DOM scrolling without guardrails

Current pattern:

Layer chip click updates state, writes URL, then calls `scrollIntoView({ behavior: "smooth" })`.

Risk:
- Smooth scroll can fight user scroll.
- Repeated layer taps can queue motion.
- Reduced-motion users should not get forced animation.
- On mobile, scroll plus re-render plus lazy chunk reveal can feel gummy.

Required fix:
- Use `replace: true` for layer query updates unless the user is making a real navigation move.
- Only scroll if the target is outside viewport.
- Use instant scroll when `prefers-reduced-motion: reduce`.
- Wrap scroll in `requestAnimationFrame` after the state update.

### P1 - Audio must be isolated before real recording arrives

Current waveform render is static and cheap. That is good.

Future risk:
- React state updates for live waveform bars.
- Multiple audio elements mounted at once.
- Playback progress causing parent canvas re-renders.
- Large waveform arrays stored directly on visible cards.

Required audio architecture:
- Store precomputed waveform peaks from backend/storage.
- Animate playhead with CSS transform, not React state per bar.
- Keep one audio engine/player controller per song room.
- Only mount the active memo player.
- Use a worker or off-main-thread processing for waveform extraction and detection.

Rule:
The voice memo is first-class content, but audio processing is never allowed to sit in the main render path.

### P2 - Memoized canvas nodes are not getting full value yet

`CanvasNode` is memoized, which is good. But `TreePanel` passes a new inline callback for each card on every render.

Risk:
At scale, node memoization becomes less effective because callback identity changes.

Required fix:
- Pass `card.id` to a stable `onSelectCardId` callback.
- Or memoize node props at the list boundary.
- Add a render-count test for card selection.

Target:
Selecting one card should not re-render every visible card.

### P2 - Single array state will get expensive as the room becomes real

Current state:

`cards` is one array, then `ideas`, `finalCards`, and `selectedCard` are derived with filters/finds.

This is fine for now. It becomes weak when cards include:
- comments
- versions
- waveform metadata
- permissions
- collaborator pending state
- suggestion resolution state

Required fix:
- Normalize canvas entities by id.
- Keep ordered id arrays for Ideas and Final.
- Use selector-based state so a memo edit does not cause unrelated trees to re-render.
- Use TanStack Query for server state and a small local store for optimistic UI.

### P2 - URL history can get noisy

Layer changes use `navigate(..., { replace: false })`.

Risk:
Back button becomes a layer-by-layer time machine instead of "leave the song room."

Required fix:
- Use `replace: true` for layer chips and bottom nav layer changes.
- Use push only for true flow transitions, like entering a song or accepting an invite.

This is performance and UX. Fewer history entries also means less mental overhead.

### P2 - Canvas-specific performance budgets are missing

Current bundle budgets are useful, but they do not prove the songwriting room can handle real data.

Add these budgets:
- Canvas route chunk max: 16 kB raw.
- Each feature plugin chunk max: 8 kB raw unless explicitly approved.
- Initial mounted canvas cards max: 80.
- Selection interaction: under 100 ms on mid-tier mobile.
- Layer switch: under 150 ms including scroll.
- Audio playback start after tap: under 250 ms after audio is cached.
- No React state loop above 10 updates per second during recording.

### P2 - Main/shared chunks need a watchlist

The canvas chunks are lean, but root/shared JS is already meaningful:
- Main JS: 313.4 kB raw.
- Shared client: 203.1 kB raw.

Risk:
Importing future feature libraries at top level will quietly tax every route.

Required rule:
No transcription, audio analysis, drag engine, charting, export, or advanced editor library can be imported from `App.tsx`, shared layout, bottom nav, or the base canvas route. Feature libraries must lazy-load behind the exact interaction that needs them.

### P3 - The layer bar is okay for seven layers, not thirty-three

The horizontal chip rail works today.

It will not work if every feature becomes a chip.

Required product rule:
The 33 features must fold into a few deep rooms:
- Capture
- Write
- Arrange
- Listen
- Review
- People
- History

Features should appear as tools inside those layers, not as top-level navigation.

## Church Center UX Audit

What is close:
- Calm visual density.
- Clear primary actions.
- Warm cards and approachable labels.
- No aggressive badges or dashboard noise.
- The room metaphor is readable.

What needs tightening:
- Layer switching should feel like selecting a calm segment, not page navigation.
- The focused layer should become visually dominant, while other layer summaries quiet down.
- The record flow should become a bottom-sheet or full-focus state with no competing UI.
- Empty/loading/error states need to feel pastoral and specific: "This song has no voice memos yet" beats generic blank cards.

Church Center lesson:
The UI should never make the user wonder where they are. The songwriter should always know:
1. What song am I in?
2. What part of the song am I touching?
3. Is my idea safe?
4. Who can see or change this?

## Fantasy.co Craft Audit

What is strong:
- The private room headline has emotional weight.
- Cream/gold palette supports the spiritual creative context.
- The whiteboard is not trying to look like a generic productivity tool.

What needs to become more bespoke:
- The Ideas Tree and Final Tree need a more song-specific spatial language.
- The current grid background is fine, but it should not become decorative noise.
- The transition from raw idea to final arrangement should feel like a sacred "moved into place" moment, not a CRUD operation.

Performance note:
The wow moment should be motion-light. Use composited transforms, opacity, and small layout-preserving reveals. No giant blur filters. No constant animation while writing.

## Recommended Next Moves

### 1. Add a canvas stress harness

Create a test utility that renders the canvas with:
- 50 cards
- 250 cards
- 1,000 cards
- 5,000 cards

Measure:
- render time
- selection time
- layer switch time
- DOM node count

This becomes Codex Gate v2 for the songwriting engine.

### 2. Make tree rendering scalable

Before Feature 1 expands:
- Replace full-card mapping with windowed rendering or collapsed groups.
- Keep selected card detail isolated.
- Stabilize callbacks passed into nodes.

### 3. Split room summaries from focused layer tools

Room mode should show summaries.
Layer mode should mount only the real tool needed.

This is the difference between "everything is connected" and "everything is expensive."

### 4. Fix layer navigation semantics

Use `replace: true` for layer switches.
Guard `scrollIntoView`.
Respect reduced motion.

### 5. Create an audio performance contract

Before real voice memo work:
- one player controller
- precomputed peaks
- no React animation loop
- lazy recorder
- lazy waveform processing
- offline-safe upload queue

### 6. Add real browser performance instrumentation

The current QA is strong for build/test/source gates. It does not yet measure true browser INP, layout shift, or long tasks.

Add:
- Playwright or browser automation.
- 390px visual screenshot.
- DOM node count.
- basic long-task capture.
- route transition timing.

## Final Rating

Current prototype performance: A-

Current scalability readiness: B-

Church Center UX direction: B+

Fantasy.co craft potential: A, if the next 33 features stay deep and layered instead of becoming a feature bazaar.

Overall Codex verdict:
The room is right. The speed is currently right. The next battle is discipline. Every new feature must enter like a quiet tool in the room, not a marching band through the front door.
