# R1 — SONGWRITING ROOM: FULL AUDIT + SIMPLIFY PASS
## Owner: Claude (all `src/` UI) · Persona: Fable 5 (`/feature`) · Branch: `claude/room-simplify`

> Audited 2026-07-30 by Lovable (static, full-file read of the room + feed +
> nav graph). Every finding below carries a `file:line`. Nothing here is a
> guess — where something could not be verified statically it is marked
> **[verify live]**.

---

## THE ONE GOAL (measure every decision against this)

**A songwriter has a spark. In under three taps it is captured, it is filed
under a part of the song, and they can hear the song play back with it in.**

Everything that does not serve that sentence is either subordinate chrome or
it is deleted. When a choice exists between complicating and simplifying —
**simplify**. This pass is allowed, and expected, to *remove* code.

---

## SCORECARD (what the audit actually found)

| Area | Verdict |
|---|---|
| Feed rendering craft (`CanvasFeed`, `FeedCard`, `FinalListenPage`) | **Strong.** Memoized, transform/opacity-only animation, reduced-motion guarded, 44px targets, direct-DOM drags. Keep. |
| Room host (`SongCanvasExperience.tsx`, 3171 lines) | **Critical.** One component owns 7 modes. Its interaction memo re-renders the whole feed on every playback step. |
| Nav graph (room ↔ modules ↔ feed) | **Critical.** The hub is a dead end; "Back" from 4 of 6 modules lands on Capture, not the room. |
| Filing a spark under a song part | **High.** Free-text section field — a typo silently forks a new feed group. |
| Dead code | **High.** Two fully-built pages (569 + 196 lines) unreachable; the retired map mode still fully wired. |
| A11y | **Good**, one miss (40px reorder chevrons). |
| Persistence | **Medium risk.** Synchronous full-board localStorage write per mutation; silent server-sync failures. |

---

## FINDINGS — CRITICAL

### C1 · The whole feed re-renders on every playback step
`SongCanvasExperience.tsx:1635-1738` — `interactionsById` builds a **new
interaction object for every card on the board**, from a `useMemo` with ~16
deps including `listenStep`, `listenPlaying`, `soloPlayId`, `comparePlayingId`.
Those change each time the song advances a part, so every `FeedCard`
(`FeedCard.tsx:62`) and `CanvasCard` (`CanvasCard.tsx:131`) `memo()` is
defeated at once. On a 40-card set list this is a full-list re-render per song
part. This is the single biggest perf defect in the room.

**Fix:** playback state must not flow through the shared interactions map.
Give each card a *stable* interactions object (deps: `boardCards`, `isViewer`,
the handler identities only) and pass volatile playback state as two scalar
props on the card itself (`isPlaying`, `listenIndex`) — or better, read it
from a tiny context/selector so only the sounding row re-renders. Verify with
React DevTools Profiler: stepping the song must repaint **one** row.

### C2 · The room hub is a navigational dead end
- `SongWorkspacePage.tsx` renders **no** `SongTabBar` and no `BottomNav` — the only song-interior screen with no persistent nav chrome.
- `SongTabBar.tsx:12-19` has **no tab for the room**. Its 6 tabs collapse to 3 real destinations.
- "Back" goes to `/songs/:id` — which is **CapturePage**, not the room: `SongSheetPage.tsx:296`, `VoiceMemosPage.tsx:722`, `NotesPage.tsx:199`, `PeoplePage.tsx:362`. Only `ActivityPage.tsx:103,268` returns to `/room` correctly.
- Activity, Credits and Versions have **no entry point from the hub at all**.

**Fix (simplify, don't add):** one nav model for the song interior.
1. Every module's back chevron returns to `/songs/:id/room`. One shared `useSongBack(songId)` helper; delete the four hand-rolled `navigate()` calls.
2. `SongTabBar` gets a **Room** entry (home) and drops the tabs that alias to the same page (Lyrics/Chords → one "Song" tab). Target: 4 tabs — Room · Song · Voice · Feed.
3. The room shows the tab bar too, so the chrome never disappears and reappears.

### C3 · Retired map mode is still fully wired and taxing the feed
`feedModel.ts:101-105` declares the whiteboard retired; users cannot reach it.
Yet `SongCanvasExperience.tsx:2575-2848` still mounts `CanvasStage`, `WeaveBar`,
`MergeActionBar`, `ListenPathBar`, `FinalArrangementBar`, `CompareModeSheet`,
plus their hooks (imports at `144-158`) and the `isBottomWorkflowActive`
coordination layer that exists only to stop five bars colliding. Worse, weave /
merge / compare fields are computed **for every card in feed mode too**
(`interactionsById` only branches on `canvasView` at `1677`).

**Fix:** delete map mode and its five modes from the room. Move anything worth
keeping (Listen Path is the only candidate — the feed's "Play the song" already
covers it) into the feed's own transport. Remove `canvasView`, `readCanvasView`,
`writeCanvasView`, the map "Feed" button at `2635-2643`, and the dead
`localStorage` escape hatch. Expected: −1000+ lines from the host, a smaller
bundle, and a much smaller interaction memo.

---

## FINDINGS — HIGH

### H1 · Filing a spark under a song part is a free-text trap
`CardEditSheet.tsx:229-239` — Section is a plain text input; `feedModel.ts:56-64`
groups by exact trimmed string. "verse1" and "Verse 1" silently become two
groups with no merge affordance. This directly breaks the second beat of the
one goal.

**Fix:** replace the input with a chip picker of the song's existing parts +
"New part…". Normalize on save (trim, title-case, collapse whitespace). This is
the highest-leverage single change in the room.

### H2 · Two fully-built pages are unreachable
- `src/pages/PeoplePage.tsx` (569 lines, real invite composer + role picker) — `/people` is intercepted by `CanvasLayerRedirect` (`songRoutes.tsx:83`).
- `src/pages/ChordsPage.tsx` (196 lines, `MOCK_CHART` at `16-21`, local-only key/BPM at `26-27`, dead "Add section" button at `176-187`) — `/chords` resolves to `SongSheetPage` (`songRoutes.tsx:62`).

**Decision required (pick one, don't keep both):** route `/people` to
`PeoplePage` and drop the `?layer=people` view, **or** delete `PeoplePage`.
`ChordsPage` is mock-only — **delete it**.

### H3 · The hub shows counts where it should show the song
`SongWorkspacePage.tsx:47-79` computes honest live counts from `useSongDetail`,
but nothing more: no last lyric line, no memo duration/waveform, no avatar
stack (despite `CollaboratorAvatarStack` already existing and used in
`PeoplePage.tsx:7`), and **no activity peek** even though `useActivityFeed`
exists. A returning collaborator gets no "what changed" signal.

**Fix:** three additions only — last lyric line on the Song card, avatar stack
on the People card, one-line activity peek that links to `/activity`. No new
queries beyond `useSongMembers` + `useActivityFeed`.

### H4 · Every forward tap from the hub pays a cold waterfall
`SongWorkspacePage.tsx:109-111` prefetches only the **back** destination
(catalog). `SongCatalogPage.tsx:154-160` does the right thing for its forward
paths. Sheet / Voice / Notes / Canvas chunks are never warmed.

**Fix:** idle-prefetch the module chunks + their queries from the room, exactly
as the catalog does.

---

## FINDINGS — MEDIUM

- **M1 · Synchronous full-board write per mutation.** `SongCanvasExperience.tsx:880-882` → `writeBoard` (`canvasBoardSource.ts:137-143`) does `JSON.stringify(cards)` into `localStorage` on **every** `cards` change, including drag commits and realtime merges. Debounce (250ms trailing) + write on `visibilitychange`.
- **M2 · Silent sync failure loses ideas.** `persistNewCard` (`391-412`) no-ops for voice/hum and demo rooms; `syncServer` (`333-348`) swallows failures. After the `DIRTY_GRACE_MS = 15_000` window (`325`) a hydrate can prune the card (`969-976`). Needs a visible "not synced yet" state + retry through the outbox that already exists (`OutboxContext`).
- **M3 · Sheets can stack.** `editCardId`, `moreCardId`, `stackBaseId`, `showAddPart`, `showWorkPanel` are five independent states (`429-441`, `600`) with no mutual exclusion; two fixed bottom sheets can co-mount. Collapse to one `activeSheet` discriminated union. **[verify live]**
- **M4 · One flat `cards` array for the whole board** (`:414`) means every single-card edit re-runs the entire memo chain. Acceptable *after* C1 lands; revisit only if the profiler still shows cost.
- **M5 · `NotesPage.tsx:57-62`** runs its own `["song-members", songId]` query instead of the canonical `useSongMembers` (`useAppQueries.ts:101-108`) — two cache entries, invalidation drift.
- **M6 · `FinalListenPage.tsx:316`** animates `border-color`/`background-color`/`box-shadow` on the sounding row (paint, not composite). One row at a time, so low impact — switch to an overlay pseudo-element with opacity if the profiler flags it.

## FINDINGS — LOW

- **L1 · A11y:** `FinalListenPage` reorder chevrons are 40×40 — below the 44px floor. Everything else in the feed passes.
- **L2 ·** `CanvasFeed.tsx:244-280` empty state says "one tap below" with no visual tie to the dock at `:352`.
- **L3 ·** `CanvasCard.tsx:339-346` changes `boxShadow` on drag-start alongside the transform — one-off repaint, fine on modern iPhones.
- **L4 ·** A `forwardRef` warning fires for every provider at app root on load (observed live in the preview console). Harmless today; noisy for real debugging. Track it down.
- **L5 ·** `CanvasFeed.tsx:92-93` recomputes the entrance-stagger counter inline, so inserting an idea restarts the cascade below it. Key the delay off card identity.

### Verified-good (do not "fix")

Realtime hydration is debounced with identity-preserving diffs
(`SongCanvasExperience.tsx:893-1019`). Drags write straight to `style`
(`SwipePromoteRow.tsx:53-56`, `CanvasCard.tsx:202-213`). Capture-then-fill —
the card exists before the sheet opens and autosaves on dismiss
(`1064-1134`, `CardEditSheet.tsx:70-78`). Query staleness is deliberately
tiered (`useAppQueries.ts`). Modal focus traps are applied consistently.
`finalPageRequest` **is** wired (`:813`, `:1902`) — the promote toast does turn
the page. Room skeleton + cached-title paint (`SongWorkspacePage.tsx:32-39`,
`194-202`) is good perceived-perf work.

---

## THE BUILD ORDER (ship in this sequence, one PR each)

**Phase 1 — Delete (biggest win, lowest risk).**
C3 map mode + five legacy modes · H2 dead pages. Nothing user-visible should
change. Record the line-count delta.

**Phase 2 — Make it instant.**
C1 interactions/playback split · M1 debounced persistence · H4 prefetch.
Gate: React DevTools Profiler — stepping the song repaints one row; a card edit
repaints one card; hub → module has no white flash.

**Phase 3 — Make it flow.**
C2 one nav model (room in the tab bar, back always returns to the room) ·
M3 single active sheet.

**Phase 4 — Make it sing.**
H1 section chip picker · H3 hub previews (lyric line, avatars, activity peek) ·
M2 sync-state indicator · L1/L2/L5 polish.

---

## ACCEPTANCE CRITERIA

- [ ] Spark → captured → filed under an **existing** part → heard in the song: **≤ 3 taps**, no typing a part name from memory.
- [ ] Stepping the song during playback re-renders exactly one row (Profiler evidence pasted).
- [ ] `SongCanvasExperience.tsx` is under 1200 lines; no component over ~250 lines.
- [ ] Every module's back chevron lands on `/songs/:id/room`; the room shows the same tab bar as its modules.
- [ ] Zero unreachable pages and zero references to `canvasView` / map mode remain.
- [ ] Two bottom sheets can never be open at once.
- [ ] `tsc` 0 errors · `build` succeeds · tests green · tokens only (`var(--cog-*)`) · no `console.log`.

## CONSTRAINTS

Frontend only. Data through the `src/integrations/cog/*` seam — never the raw
Supabase client from pages/components. COG tokens only. iOS Safari is the
primary target. Prefer deleting to adding: a PR in this pass that grows total
line count needs a sentence justifying it.

## REFERENCES

`src/components/canvas/SongCanvasExperience.tsx` · `src/components/canvas/feed/*`
· `src/pages/SongWorkspacePage.tsx` · `src/components/cog/SongTabBar.tsx` ·
`src/routes/songRoutes.tsx` · `src/lib/canvas/feed/feedModel.ts` ·
`src/lib/canvas/canvasBoardSource.ts` · `docs/MOBILE-UX-BENCHMARK.md` ·
`docs/CANVAS-RENDER-CONTRACT.md` · `CLAUDE.md` §1–§3