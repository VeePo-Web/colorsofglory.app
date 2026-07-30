# R38 — Songwriting Room Audit: "The song is finished"

**Lane:** Claude (frontend only). Backend shipped by Lovable.
**Goal reminder:** the room exists to finish a song. Every other feature is in service of this one moment.

## The gap

The room had a beginning (capture) and a middle (sections, takes, words) but **no ending**.
A song just went quiet. There was no moment of "it's done", no way to tell a
collaborator the writing is closed, and no calm final state to return to.

## What ships (backend, already live)

- `songs.finished_at timestamptz` — the only new state.
- `finish_song(_song_id)` → returns `finished_at`. Owner-only, idempotent.
- `reopen_song(_song_id)` → clears it. Owner-only, idempotent.
- Both write `song_activity` (`song_finished` / `song_reopened`) so the feed narrates it.
- SDK: `src/integrations/cog/finish.ts` — `finishSong`, `reopenSong`, `fetchFinishState`, `finishedLine`.

**Deliberately NOT built:** no lock, no read-only mode, no "publish", no export gate,
no checklist, no completion percentage. A finished song stays fully editable.
Finishing is intent, not permission. That is the simple choice.

## UI to build

### 1. The act (owner only)
In the room's overflow menu, one item: **Finish song**. Tapping opens a small
sheet — serif headline "Finish this song?", one line of body: *"We'll save a
version called Final and mark the date. You can keep editing and reopen anytime."*
Primary gold button **Finish song**, ghost **Not yet**.

On confirm, in this order, optimistically:
1. `versions.saveVersion(songId, { label: "Final" })`
2. `finishSong(songId)`
3. Close the sheet, paint the finished state immediately, no spinner.
If either call fails, revert the header state and show one calm toast with Retry.

### 2. The finished state
- Room header gains one quiet line under the title: `Finished July 30, 2026`
  (`finishedLine`), warm-gray, `--t-label`, no badge, no green check, no confetti.
- The song card in the catalog gets the same single line where "last activity"
  normally sits. Sort order does not change.
- Nothing is disabled. No banner. No nag to reopen.

### 3. Reopen
Owner overflow item flips to **Reopen song** while finished. One tap, no
confirmation sheet (it's harmless and reversible) — just the line disappearing
and a toast "Reopened" with Undo.

### 4. The feed
Render `song_finished` as a full-width, centered, serif divider row inside the
feed timeline: *"Parker finished this song"* with the date beneath. This is the
only feed row allowed to break the avatar+line rhythm — it reads like a chapter
break. `song_reopened` renders as an ordinary quiet row, no emphasis.

### 5. Non-owners
Collaborators see the finished line and the feed divider, never the menu item.
No "request to reopen" flow.

## Performance
- `finished_at` comes down with the existing room bootstrap read — do NOT add a
  second fetch on mount. `fetchFinishState` is only for post-mutation refetch or
  a surface that has no song row already in cache.
- Header state is local-first: flip it before the RPC resolves.
- The realtime `onSongChange` handler already fires on the songs UPDATE — reuse it
  so collaborators' headers flip live with zero polling.

## Acceptance
- Owner can finish and reopen from one menu, in one tap each.
- A version labelled "Final" exists after finishing.
- Finished song is still fully editable everywhere.
- Feed shows exactly one chapter-break row per finish.
- Zero added network requests on room open.
- No new colors, no new components beyond the confirm sheet and the feed divider.
