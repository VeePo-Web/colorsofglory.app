# D2 · Canvas Features Agent — Progress Log

## 2026-07-08 — Steps 1–9 shipped in one pass (charter compressed)

**Context:** D1's `CanvasStage`/render contract and A4's `useCanvasStore` had not
shipped, so D2 ran against the live `SongCanvasExperience` host using the charter's
sanctioned interim seams (documented mutation contract + typed alias). Work was
re-applied once after a concurrent `git reset --hard origin/main` wiped the tree
mid-session; final state below is verified against the current lineage.

### What shipped

- **Logic layer (Step 1):** `src/lib/canvas/features/` — `useListenPath`,
  `useCompareMode`, `useMergeSplice`, `useFinalArrangement`, `useCanvasMetronome`,
  plus `canvasAudio` (single shared audio element), `usePrefersReducedMotion`,
  `mutations` (the A4 contract). The god component no longer holds the F20/F22
  handler bodies, `handleMoveToFinal`/`handleMoveToIdeas`, or `moveFinalCard` —
  all relocated into hooks; the host keeps only the `CanvasFeatureMutations`
  implementation (that IS the interim store).
- **Type decoupling (Step 2):** `CanvasBoardCard` family lives in
  `src/lib/canvas/canvasTypes.ts`; no D2 file imports from SongCanvasExperience
  (back-compat alias retained). `@/types` barrel filed for A2 (didn't exist at ship).
- **Store persistence (Step 3):** every mechanic writes through
  `CanvasFeatureMutations`; merged ids are `merged-<uuid>` (Date.now() ids gone);
  listen path persists via `CanvasFeatureMeta`. Interim persistence rides the host's
  existing keys — exact replacement seam + needed RPC mapping documented in the
  contract for A4.
- **Listen Path plays for real (Step 4):** queue plays card-by-card in order —
  voice/hum via signed-URL playback through the shared element, non-audio cards get
  a 3.5s dwell — with auto-advance, active-chip highlight, prev/next/tap-to-seek,
  pause, error-skip, and stop-on-unmount. Bar is now a controlled transport.
- **Compare Mode real (Step 5):** mounted (it was an orphan component), reachable
  from the card overflow ("Compare A vs B") when a same-section variant exists;
  A/B audition one-at-a-time through the shared element; choose persists winner
  non-destructively (loser dimmed `compare_kept` + labeled "Kept for reference")
  with snapshot Undo; keep-both leaves both; sheet is focus-trapped.
- **Merge finished (Step 6):** uuid ids, `mergedFrom` provenance, parents dimmed
  with reason label, working Undo through `revertMerge`.
- **Final Arrangement (Step 7):** `FinalArrangementBar` (pill → running-order
  toolbar) + `useFinalArrangement` on the lineage's y-slot order model; up/down
  single-pointer reordering (also the keyboard path), Save/Cancel wrap a position
  snapshot so both Cancel and Undo restore the exact prior order; overflow-sheet
  "move up/down" now routes through the same hook; review-queue Approve routes
  through `arrangement.moveToFinal`.
- **Metronome (Step 8):** `CanvasMetronomeToggle` in the status row consuming C4's
  engine (constructed/disposed, never copied), BPM seeded from `songs.tempo_bpm`,
  debounced persist back (interim direct-table adapter filed for A3/A4), beat dots
  driven off the engine clock with gold downbeat.
- **Reduced-motion + a11y (Step 9):** all three bars honor
  `prefers-reduced-motion` (slide-ups → instant); bars are `role="toolbar"` with
  accurate labels; transport + reorder controls are plain buttons (keyboard
  operable); CompareModeSheet traps focus and restores it on close; every drag has
  a non-drag alternative (up/down buttons, overflow actions).

### Verification (Step 10 — partial, see caveat)

- `npm run typecheck`: D2 lane clean. Remaining errors are merge-conflict markers
  in `src/pages/onboarding/*` + `src/test/voice-memo-added.test.tsx` from another
  agent's in-progress merge (not touched, not committed by D2).
- `src/test/canvas-collab.test.tsx`: **passes** with the rewired canvas (renders
  SongCanvasExperience + D3 overlay → no collision).
- `src/test/feature04-canvas.test.tsx`: fails **pre-existing** — `useSongTitle`
  was changed (another lane) to use react-query; the test renders without a
  `QueryClientProvider`. Not a D2 regression (D2 touches neither file).
- **Caveat:** live 390px run/verify (actually hearing a 3-card path, A/B audition,
  metronome click) could not be completed this session — the working tree was being
  concurrently reset/committed by other agents and node_modules was mid-reinstall.
  The playback paths reuse proven primitives (`getPlaybackUrl` + HTMLAudioElement,
  C4's engine). **First task next session: run the five-mechanic walkthrough on
  390px and log results here.**

### What other agents can rely on / must do

- Contract published: `docs/CANVAS-FEATURES-CONTRACT.md` (mutations for A4, type
  seam for A2, slots for D1, engine for C4, capability seam for E1).
- D3 layers multiplayer on the hooks in `src/lib/canvas/features/` — their APIs
  are stable; do not reach around them into the host's mutations impl.
- A4: implement `CanvasFeatureMutations` over real persistence and delete the
  `cog:canvas-features-<songId>` key. A2: `@/types` re-export. A3: `updateSongTempo`.
