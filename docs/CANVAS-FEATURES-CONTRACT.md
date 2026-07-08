# CANVAS FEATURES CONTRACT — D2 (Canvas Features Agent)

**Version:** v1.0 · 2026-07-08
**Owner:** D2 · Canvas Features Agent
**Consumers:** A2 (types), A4 (canvas store), D1 (render layer), D3 (collaboration), C4 (audio engine), E1 (roles)

This is the contract for the **mechanics** of `/songs/:id/canvas`: Listen Path (F20),
Compare Mode (F21), Merge/Splice (F22), Final Arrangement (F23), and the one-tap
Metronome (F14). D2 owns what these interactions **do** — never how cards look (D1)
or who else is in the room (D3).

---

## 1. What D2 owns

### Logic layer — `src/lib/canvas/features/`

| Hook | Feature | What it does |
|---|---|---|
| `useListenPath` | F20 | Queue building + **real sequenced playback**: voice/hum takes play through the shared canvas audio element in order with auto-advance; non-audio cards get a 3.5s readable dwell; prev/next/goTo seek; `save()` persists the sequence. |
| `useCompareMode` | F21 | A/B pair discovery (same section + tree, undimmed), **real one-at-a-time audition**, `choose()` persists the winner non-destructively (loser dimmed + kept, `dimReason: "compare_kept"`), keep-both leaves both active. Undo restores a full pre-decision snapshot. |
| `useMergeSplice` | F22 | 2-slot selection; `executeMerge()` creates a new section with **collision-safe id** (`merged-<uuid>`, no more `Date.now()`), records provenance in `mergedFrom: [idA, idB]`, dims (never deletes) both parents, real Undo. |
| `useFinalArrangement` | F23 | The running-order model: Final tree top-to-bottom y-order **is** the arrangement. `moveBy()` swaps column slots; `begin()/cancel()/save()` wrap an arrange session with a position snapshot so Cancel and Undo restore the prior order exactly. Also owns the relocated `moveToFinal`/`moveToIdeas` mechanics (dimmed source + `-final` copy, undoable). |
| `useCanvasMetronome` | F14 | One-tap click **consuming C4's engine** (`src/lib/audio/metronome.ts` — constructed/disposed, never forked). Seeds BPM from `songs.tempo_bpm` via `getSong`, persists BPM changes back (debounced 800ms). Visual beat driven off the engine's `onBeat` clock. |

Shared plumbing:

- **`canvasAudio.ts`** — the ONE `HTMLAudioElement` for all canvas feature playback.
  Listen Path and Compare both audition through it, so starting either silences the
  other; nothing on the canvas can double-play. `memoIdForCard()` maps card ids
  (`db-voice-<uuid>` / raw uuid) to playable memo ids; signed URLs come from
  `getPlaybackUrl` (cog/memos) with a 4-minute cache.
- **`usePrefersReducedMotion.ts`** — live media-query hook; all D2 bars/sheets cut
  slide-up motion to instant under `prefers-reduced-motion: reduce`.
- **`mutations.ts`** — the store mutation interface (below) + `newFeatureCardId()`.

### Components — `src/components/canvas/`

- `ListenPathBar` — **controlled** transport (props: `step`, `playing`, `onPlayPause`,
  `onPrev`, `onNext`, `onStepTo`, …). No internal playback state; useListenPath drives it.
- `CompareModeSheet` — **controlled** audition (props: `playingId`, `onTogglePlay`) +
  focus-trap (focus moves in on open, Tab cycles inside, Escape closes, focus restores).
- `MergeActionBar` — unchanged UX (2-slot "Select 1 more idea…"), reduced-motion aware.
- `FinalArrangementBar` — NEW: collapsed "Arrange final ▸" pill → full running-order
  toolbar with per-section up/down buttons (the single-pointer / keyboard alternative
  to dragging), Save order / Cancel.
- `CanvasMetronomeToggle` — NEW: one-tap pill with engine-clock beat dots (gold
  downbeat) and ± BPM steppers while running.

---

## 2. The store seam D2 consumes (A4 — ACTION REQUIRED)

D2 hooks write **only** through `CanvasFeatureMutations`
(`src/lib/canvas/features/mutations.ts`):

```ts
interface CanvasFeatureMutations {
  applyMerge(parentAId: string, parentBId: string, merged: CanvasBoardCard): void;
  revertMerge(mergedId: string, parentAId: string, parentBId: string): void;
  promoteToFinal(sourceId: string, finalCopy: CanvasBoardCard): void;
  returnToIdeas(finalCardId: string, sourceId: string | null): void;
  patchCards(patches: Array<{ id: string; patch: Partial<CanvasBoardCard> }>): void;
  saveListenPath(orderedCardIds: string[]): void;
}
```

**Interim implementation** lives in `SongCanvasExperience.tsx` (`featureMutations`
useMemo) over the host's card state, persisted with the existing
`cog:canvas-cards-<songId>` localStorage plus `cog:canvas-features-<songId>` for the
saved listen path (`CanvasFeatureMeta`). **That object + those keys are the A4
replacement seam**: when `useCanvasStore` lands, implement this interface over real
persistence (`canvas_cards` RPCs in `src/integrations/cog/canvas.ts` are the obvious
backing: `canvas_move_card` / `canvas_bulk_move` for arrangement slots,
`canvas_group_cards` + `canvas_link_cards` for merge provenance,
`canvas_promote_to_final` / `canvas_set_section` for tree moves) — **no D2 hook
changes required.**

Also filed for **A3/A4**: `updateSongTempo(songId, bpm)` (or a general `updateSong`).
Interim: `src/lib/canvas/features/songTempo.ts` writes `songs.tempo_bpm` directly
(same direct-table pattern as cog/canvas.ts) and is non-fatal offline.

## 3. The type seam (A2 — ACTION REQUIRED)

Canonical board-card type: **`CanvasBoardCard`** (+ `CanvasBoardTree`,
`CanvasBoardCardType`, `CanvasBoardCardStatus`, `CanvasBoardDimReason`) in
`src/lib/canvas/canvasTypes.ts`. New fields D2 added: `dimReason` (why a card is
dimmed — `moved_to_final | merged | compare_kept`) and `mergedFrom` (F22 provenance).

No D2 file imports types from `SongCanvasExperience` anymore;
`export type CanvasCard = CanvasBoardCard` remains there only for back-compat.
When A2 publishes the `@/types` barrel, re-export `CanvasBoardCard` from it and D2
imports flip in one sweep.

## 4. Slots / mount points (D1)

`CanvasStage` + `docs/CANVAS-RENDER-CONTRACT.md` did not exist when D2 shipped.
Current mounts (all inside `SongCanvasExperience`, ready to lift into D1 slots):

- Bottom bars: `MergeActionBar` (z 695) → `ListenPathBar` (z 700) →
  `FinalArrangementBar` (z 690, pill at z 640) — all above `SongTabBar`, below
  StackSheet (799/800).
- `CompareModeSheet`: modal sheet at z 60/61.
- `CanvasMetronomeToggle`: status row, next to the canvas status pill.
- **Drag visual seam:** the on-canvas drag of final sections is D1's; its drop
  callback should call `useFinalArrangement` order logic (slot swap via
  `patchCards`) — the order model stays D2's.

## 5. Capabilities consumed (E1)

Interim viewer gate: `?role=viewer` (`isViewer`), passed into every hook; all
mutating verbs no-op for viewers. When E1's `useCapabilities` is available on this
route, replace the `isViewer` args with `!capabilities.canEdit` — hooks take a
boolean, so no hook changes.

## 6. Engine consumed (C4)

`Metronome` class from `src/lib/audio/metronome.ts` — constructed lazily on first
toggle, `setBpm`/`setBeatsPerBar` live, `dispose()` on canvas unmount. One engine
pattern shared with Capture; D2 never duplicates the click.

## 7. Non-destructive guarantees (all mechanics)

- Merge: parents dimmed with `dimReason:"merged"`; Undo removes the section and
  restores both.
- Move-to-Final: source dimmed (`moved_to_final`); Undo/`moveToIdeas` restores it.
- Compare choose: loser dimmed (`compare_kept`), never deleted; Undo restores the
  exact prior status/dim of both cards.
- Arrangement: Cancel and Undo restore the exact pre-session slot positions.
- Listen Path: saving overwrites only the saved sequence; cards are untouched.
- Card faces label the dim reason ("Merged into section" / "Kept for reference" /
  "Used in Final") so a kept card always explains itself.

## 8. Known gaps / follow-ups

1. **A4**: real store behind `CanvasFeatureMutations` (kills the two localStorage keys).
2. **A2**: `@/types` barrel re-export of `CanvasBoardCard`.
3. **A3/A4**: `updateSongTempo` to replace the direct-table interim in `songTempo.ts`.
4. **D1**: `CanvasStage` slots + drag-visual drop callback into `useFinalArrangement`.
5. Compare auditions only voice/hum takes (lyric variants are read side-by-side);
   fine per F21, noted for completeness.
6. Pre-existing (not D2): `feature04-canvas.test.tsx` fails because `useSongTitle`
   now uses react-query and the test renders without a `QueryClientProvider` —
   owned by the lane that changed `songContext.ts`.
