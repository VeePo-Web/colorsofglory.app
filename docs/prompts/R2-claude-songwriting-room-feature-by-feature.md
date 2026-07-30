# R2 — Songwriting Room + Feed: feature-by-feature audit & simplify pass

**Owner:** Claude (frontend only). **Depends on:** R1 (`R1-claude-songwriting-room-audit-and-simplify.md`).
**Backend piece already shipped:** `docs/claude-handoffs/2026-07-30-canvas-outbox-sync.md`.

## The one goal (test every change against this)

> A songwriter has an idea. They capture it in seconds, see it appear in the feed,
> file it under a song part, and hear it back. Everything for this song stays here.

Anything that does not serve **capture → see → file → hear** is either subordinate
to it or gone. When there is a choice between a mode and a simpler primitive, take
the primitive.

---

## P0 — Instant performance (do these first, they are measurable)

### P0.1 Playback state is fused into the interaction map
`SongCanvasExperience.tsx:1635-1738`. `interactionsById` is a `useMemo` over
`boardCards` whose deps include `listenStep`, `listenPlaying`, `comparePlayingId`,
`soloPlayId`, and `weave.glow`. Every playback tick rebuilds a fresh
`CanvasCardInteractions` object **for every card on the board**, so every memoized
`FeedCard`/`CanvasCard` gets new props and re-renders. This is the single largest
jank source in the room: playing the song re-renders the entire feed per step.

**Fix.** Split volatile from stable.
1. Remove `playing` from the interaction object and remove `listenStep`,
   `listenPlaying`, `comparePlayingId`, `soloPlayId` from the memo deps.
2. Pass `playing` to the card as its own scalar prop computed at the render site:
   `playing={activePlayingId === card.id}`, where `activePlayingId` is one derived
   string (`listenPlaying ? listenQueue[listenStep] : comparePlayingId ?? soloPlayId`).
   One card's identity changes per step instead of N.
3. Do the same for weave: `weaveFaded`/`weaveLines` become their own props derived
   per card, not fields baked into the memoized interactions object.
4. Route the remaining handlers through `apisRef.current` (the file already
   establishes this pattern at `1640-1648`) so the memo depends only on
   `boardCards`, `isViewer`, `layerCountByBase`, `finalOrder`.

**Accept when:** React DevTools Profiler shows ≤2 card commits per listen-path
step (the leaving card and the arriving card), not N.

### P0.2 Full-board JSON write on every mutation
`SongCanvasExperience.tsx:880-882` → `writeBoard(songId, cards)` in an effect on
every `cards` change, and `canvasBoardSource.ts:137-143` does a synchronous
`JSON.stringify` of the entire board. Voice cards carry `waveformPeaks` and
`pitchContour` arrays, so a drag-commit or a promote stalls the main thread
proportional to total audio analysed in the song.

**Fix.**
1. Debounce the write to ~600ms trailing (mirror `useCanvasMetronome.ts:16,88-91`),
   plus a flush on `visibilitychange`/`pagehide` so nothing is lost on background.
2. Strip `waveformPeaks` and `pitchContour` before persisting — they are
   re-derivable from the server (`canvasBoardSource.ts:281-282`). Local cache
   stores text + ids + placement only.

**Accept when:** dragging a card in a 60-card song shows no long task >50ms in
the Performance panel.

### P0.3 Feed renders every card, unbounded
`CanvasFeed.tsx:281-320` maps every group and every card into the DOM with a
staggered entrance animation. Fine at 20 cards, jank at 200.

**Fix (simple version first).** Cap the entrance cascade to the first 12 cards
(the delay is already capped at 360ms; cap the *count* too), and render groups
past the fold with `content-visibility: auto; contain-intrinsic-size: 120px`.
Only reach for `@tanstack/react-virtual` if a real song crosses ~150 cards —
virtualization fights the swipe-pager and the entrance choreography, so it is a
last resort, not a default.

### P0.4 Same-day cheap wins
- `min-h-screen` → `min-h-dvh` in: `SongWorkspacePage.tsx:141`,
  `SongSheetPage.tsx:283`, `VoiceMemosPage.tsx:704`, `NotesPage.tsx:178`,
  `ActivityPage.tsx:84`, `CreditsPage.tsx:92`, `MemoryPage.tsx:117`,
  `SongMemoryPage.tsx:43`, `SongCatalogPage.tsx:544`, `BrainstormPage.tsx:211`,
  `CapturePage.tsx:8,10`. On iOS the bottom dock is currently clipped behind
  browser chrome.
- Audit `SongSheetPage.tsx` (1,511 lines) for per-keystroke persistence in the
  lyric/chord editor. If it writes on every keypress, debounce to 500ms with an
  on-blur flush.

---

## P1 — One sheet at a time (the flow defect)

Nine independent overlay flags live side by side with nothing enforcing mutual
exclusion: `editCardId`, `moreCardId`, `lineSuggest`, `stackBaseId`,
`showAddPart`, `showReviewQueue`, `showShareSheet`, `showRecap`
(`SongCanvasExperience.tsx:428-441, 518-522, 600-602`), plus `CanvasRecapGate`
(`:2909`) which auto-opens on its own judgment (`useCanvasRecap`) and checks
**none** of the others — a returning collaborator who taps a card while the
recap is deciding can get two stacked sheets.

**Fix.** Collapse to one discriminated union:

```ts
type RoomOverlay =
  | { kind: "edit"; cardId: string }
  | { kind: "more"; cardId: string }
  | { kind: "stack"; baseId: string }
  | { kind: "suggest"; cardId: string; originalLine: string; sectionLabel?: string }
  | { kind: "addPart" }
  | { kind: "review" }
  | { kind: "share" }
  | { kind: "recap" };

const [overlay, setOverlay] = useState<RoomOverlay | null>(null);
```

Opening any sheet is `setOverlay({...})`, which closes the previous one by
construction. `CanvasRecapGate` becomes a *suggestion*: it may only set the
recap overlay when `overlay === null`, and otherwise waits (the recap is calm by
design — it must never interrupt a user mid-thought).

**Also:** every sheet gets Escape-to-close and returns focus to the element that
opened it. Radix `Dialog`/`Sheet` gives both — do not hand-roll it.

---

## P2 — Collapse the four selection modes into one

Listen Path, Compare, Merge/Splice, and Weave are four separate
"select cards → do a thing → commit" flows, each with its own selection state,
its own action bar (`ListenPathBar`, `CompareModeSheet`, `MergeActionBar`,
`WeaveBar`), and its own entry buried in the card overflow menu
(`SongCanvasExperience.tsx:2966-3057`). They share one mutation surface already
(`lib/canvas/features/mutations.ts:16-29`), which proves they are the same shape.

Worse, Weave silently reinterprets the core gesture: in weave mode a card is
tap-to-place instead of drag-to-place (`CanvasCard.tsx:187-189,297`), signalled
only by a fade. That is a mode the user can fall into without knowing.

**Fix, in order of nerve:**
1. **Minimum:** one shared `selectionMode: "listen" | "compare" | "combine" | null`
   in the room, one action bar component that swaps its verb, and a persistent
   mode banner with `aria-live="polite"` announcing "Weaving — tap lines to add".
   Entering any mode exits the others.
2. **Better (recommended):** merge Compare + Merge/Splice + Weave into a single
   **Combine** flow — pick cards, see them side by side, keep the lines you want,
   commit as a new section. That is one mental model instead of three, and it is
   what all three already do underneath. Listen Path stays separate because its
   verb is "hear," not "shape."

Deleting two of the four bars is a win by itself. Measure the line count you
remove and report it.

---

## P3 — Kill the retired map for real

`feedModel.ts:93-114` retires the whiteboard but keeps it alive behind a
**user-writable localStorage key** (`cog:canvas-view`), so the "retired" 2D map
is one devtools line away from any user — while still costing every render:
`clusterFlags` (`:1408`), cluster/hidden-card computation (`:1468`),
`stageIdeasCards`/`stageFinalCards` (`:1501-1505`), and the map-only
`onMergeSelect` branch (`:1673-1679`) all run in feed mode.

**Fix.** Delete the map render path and its supporting components
(`CanvasStage`, `CanvasViewport`, `CanvasBranchConnectors`, `SongRootCard`,
`ZoneFields`, `CanvasDivider`, `SectionCluster`), delete `readCanvasView` /
`writeCanvasView` / `CanvasViewMode`, and delete every `canvasView === "map"`
branch. If the map must survive, gate it on `import.meta.env.DEV` — never on a
key a user can flip. Also delete the unreachable `PeoplePage.tsx` and
`ChordsPage.tsx` (R1 finding) if still unrouted.

---

## P4 — Local state honesty (cross-device gaps the user cannot see)

Eight distinct localStorage keys hold one song's state: cards
(`canvasBoardSource.ts:37`), tombstones (`:174`), features
(`SongCanvasExperience.tsx:218`), view (`feedModel.ts:91`), count-in
(`SongCanvasExperience.tsx:198`), line suggestions, reviewed store, weave used-lines
(`weave.ts:310`).

**Fix.**
1. One `canvasLocalKeys(songId)` registry module exporting every key, so
   "clear this song's local cache" is one call. Namespace them `cog:song:<id>:*`
   and add a `v1` version segment.
2. Three of these carry **silent cross-device divergence** and must say so in
   one quiet line of UI (never a warning banner — the room is a sanctuary):
   - Listen path: already honest ("saved on this device",
     `useListenPath.ts:227-229`). Keep.
   - Owner review decisions (`canvasBoardSource.ts:174-204`): a decision made on
     phone A reappears as "awaiting review" on phone B. Label it the same way
     until the backend column lands — **ping Lovable when you want that column,
     it is a small migration.**
   - Weave used-lines: same treatment.

---

## P5 — Simplify the fiddly bits

- **Free-text song parts.** Filing is free text, so "verse1", "Verse 1", and
  "verse 1" become three feed groups (`feedModel.ts:45-72` keys on the raw
  label). Replace the input with a chip picker: Verse / Pre-Chorus / Chorus /
  Bridge / Outro / Tag, numbered automatically, with "Custom…" last. Normalize
  existing labels on read (trim + title-case) so old data merges.
- **Cross-tree drop can silently no-op.** `CanvasCard.tsx:370-373` — when
  `onCardDrop` is absent the card just repositions with no feedback. Either
  always supply the handler or snap the card back so the user learns the rule.
- **Save toast has no dismiss and no replay.** `SongRoomSaveToast.tsx:23-26`
  self-dismisses at 2.4s. Add tap-to-dismiss; keep the `role="status"`.
- **Dock loading state is silent to screen readers.**
  `CreativeActionDock.tsx:66` swaps the label to "Loading..." with no
  `aria-live`. Wrap the label region in `aria-live="polite"`.
- **Two ways to do tactile feedback.** `BottomNav.tsx:107-112,165-170,222-227`
  hand-rolls `onMouseDown`/`onTouchStart` scale; `CanvasFeed.tsx:176-177` uses
  CSS `:active`. Pick the CSS one, delete the handlers, ship a `.cog-press`
  utility class.
- **Sync indicator.** Wire `subscribeOutbox` per the outbox handoff: silence at
  zero pending, "Saving…" while draining, "Offline — will sync" when offline.
  No red, no counts.

---

## Build order

1. **P0** — perf (measure before/after with the Profiler; report numbers).
2. **P1** — single overlay state.
3. **P3** — delete the map (do this before P2; it shrinks what P2 must unify).
4. **P2** — collapse the selection modes.
5. **P4 + P5** — local-state registry and the polish list.

## Definition of done

- Listen-path playback commits ≤2 cards per step.
- No long task >50ms on drag-commit in a 60-card song.
- Only one sheet can ever be open; Escape closes it; focus returns.
- `canvasView`, `CanvasStage`, and friends no longer exist in the bundle.
- Net line count of `src/components/canvas/**` is DOWN, not up. Report the delta.
