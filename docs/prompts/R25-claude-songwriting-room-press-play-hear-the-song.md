# R25 — Listen Path: "Press play and hear the whole song"

**Audience:** Claude (frontend owner). Backend is shipped — do not write SQL or edge functions.

## The one job
A song lives in fragments: a hum for the verse, a phone take of the chorus, a bridge
idea from a collaborator. Until you can hear them **in order**, the song isn't real yet.
Listen Path is one ordered list per song. Press play, hear the song end to end.

If a choice appears between clever and simple: choose simple. One list. One play button.

## Data seam (already built)
`src/integrations/cog/listenPath.ts`

- `getListenPath(songId)` → `{ role, items[], total_duration_ms, updated_at }` in **one** request.
  Each item is already resolved: `section_label`, `take_name`, `duration_ms`, `storage_path`, `take_archived`.
- `saveListenPath(songId, items)` → save the **whole** order in one write; returns the fresh board.
- `playableItems(items)` / `formatDuration(ms)` helpers.
- Audio URLs: use the existing batch signing seam in `src/integrations/cog/player.ts` — pass the
  `storage_path`s of the playable items, sign them all in one call, never sign per-tap.

Rules the server already enforces: members read, owner/collaborator write, viewers can play
but not reorder, deleted takes silently drop out of the saved list.

## Screen: `/song/:id/listen` (and a play affordance on the workspace hub)

**Header**
- Serif song title, then one calm line: `6 parts · 4:12`. Nothing else.
- Gold radial glow at bottom-center (`.cog-glow`).

**The path list**
- Vertical stack of rows, 16px radius cards, `--cog-cream-light`, `--cog-border`.
- Each row: section label in serif (`Verse 1`), take name in `--cog-warm-gray` below,
  duration right-aligned in `--t-label`.
- Currently playing row: border becomes `--cog-border-gold`, plus a slim gold waveform
  bar animating on the left edge. No progress ring, no numbers ticking.
- Rows connect with a 1px vertical hairline in `--cog-border` so it reads as a path, not a list.

**Play**
- One full-width gold CTA pinned above the safe area: `Play the song`.
- Playback advances automatically to the next playable item; gaps (sections with no take)
  are shown but skipped, with a hushed `no take yet` label instead of a duration.
- Tapping any row starts from there.
- While playing, the CTA becomes `Pause` — same button, same place. Never two buttons.

**Reordering (owner/collaborator only)**
- Long-press a row to lift it (scale 1.02, soft shadow), drag to reorder — Framer Motion `Reorder`.
- On drop: optimistic local order, then `saveListenPath` once, debounced 600ms.
  On failure, snap back and show a single Sonner toast: `Couldn't save the order`.
- Viewers: no drag handles, no long-press, no disabled-looking controls. They simply see the path.

**Adding to the path**
- Bottom ghost button: `Add a part`. Opens a sheet listing the song's sections and unarchived
  takes (from `song_voice_board`). Tap to append. Sheet stays open for a second add, closes on
  backdrop tap. No multi-select checkboxes, no confirm step.
- Swipe-left on a row → `Remove from path`. Removing never deletes the take.

**Empty state**
- Serif line: `Nothing to play yet.` Sub-line: `Add a take and it becomes part of the song.`
- Single gold CTA `Add a part`.

## Performance rules
- One `getListenPath` on mount, one batch URL sign, then zero network on playback.
- Preload the **next** item's audio only (`preload="auto"` on a single hidden element).
- Never re-fetch the board after a save — use the returned board.
- Reorder is local-first; the save is invisible to the user.

## Motion
- Row entrance: `translateY(8px) → 0`, 400ms, `--cog-ease-reveal`, 30ms stagger, capped at 8 rows.
- Play/pause icon crossfade 150ms. Active row border transitions 250ms.
- No spinners anywhere. If audio is buffering, the waveform bars simply idle.

## Done when
- Opening the screen with a cold cache paints the full path in one request.
- Pressing play plays every take in order without a network call between items.
- Reordering feels instant and survives a refresh.
- A viewer sees exactly the same screen minus the drag affordances.