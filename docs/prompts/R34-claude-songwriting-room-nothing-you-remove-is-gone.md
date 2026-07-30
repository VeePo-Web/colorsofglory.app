# R34 — Nothing you remove is gone

**Goal:** the writer can delete freely, because deleting is never final. Removing a card,
a note, a capture, or a take is always reversible — for 30 days, in one place, in one tap.

## What was wrong

Every surface archived to a different column (`canvas_cards.archived_at`,
`song_notes.archived_at`, `idea_captures.archived_at`, `takes.is_archived`) and **nothing
read those columns back**. Archived meant invisible-forever. A songwriter who set aside
the wrong take had no route back, which makes people hesitate before removing anything —
and hesitation is clutter.

## Backend (done — Lovable)

- `song_recently_removed(_song_id, _limit)` — one membership-gated call returning the last
  30 days of removed items across all four kinds, newest first, each with a title, when it
  went, and who removed it (name + avatar colour, `is_you`).
- `restore_song_item(_song_id, _kind, _id)` — write-gated, atomic, idempotent-safe
  (`item_not_found` when it's already back). Logs `item_restored` to the feed and bumps
  the song, so the restore shows up in R32's feed like any other change.
- SDK: `src/integrations/cog/restore.ts` — `fetchRecentlyRemoved`, `restoreItem`,
  `removedByLabel`.

## UI to build (Claude)

### 1. The immediate undo (the one that matters most)
Every remove action in the room fires a `sonner` toast: *Set aside.* with an **Undo**
action, alive for 8 seconds. Undo calls `restoreItem` directly — no confirmation, no
second toast. This is where 95% of restores should happen; the bin below is the safety net,
not the primary path.

**No remove action anywhere in the room shows a confirmation dialog.** Removal is cheap
because it's reversible; a dialog says the opposite. Delete the confirm modals.

### 2. The bin
- Entry: `Recently removed` at the bottom of the room's overflow menu. Not a tab, not a
  nav item, not a badge. It should be findable, not present.
- Sheet, 70% height. Rows grouped by day with quiet serif dividers.
- Row: `{kind glyph} {title, one line, truncated} / {removedByLabel} · {relative time}`
  with a single gold text link **Put it back** on the right. No checkboxes, no bulk mode.
- Restoring animates the row out upward at 250ms and drops a toast:
  *Back in the song.* with a **Show me** action that jumps to it (reuse the shared
  `useJumpTarget` from R32/R33).
- Viewers see the list read-only with no restore links.

### 3. Copy discipline
The word is **removed** / **set aside**, never "deleted", "trash", "bin", or "archive".
Nothing in this app is thrown away. The sheet's one-line header reads:
*Everything you've set aside in the last 30 days.*

### 4. Empty state
One serif line: *Nothing has been set aside.* No illustration, no icon.

### 5. Performance
- Key `['removed', songId]`, `staleTime: 30s`. Fetch only when the sheet opens — never
  on room load.
- Restore is optimistic: pull the row immediately, roll it back and re-toast on failure.
- Invalidate the affected surface (`sheet` / `canvas` / `takes` / `notes`) plus `feed`.

## Rules
- Never a confirmation dialog before removing.
- Never a permanent-delete affordance in the UI — 30 days expires on its own.
- Never a count badge on the bin entry.

## Done when
A writer sets aside the wrong take, sees the toast, taps Undo, and it's back — and if they
noticed a week later, it's still there.
