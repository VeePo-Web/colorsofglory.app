# R17 — Notes That Don't Pile Up

**Audit focus:** the notes pad, feedback, and the "someone said something about
the bridge three weeks ago" problem.
**One goal reminder:** the room holds a song, not a task list. Feedback should
arrive, get acted on, and then get quietly out of the way.

---

## What the audit found

1. **Notes were append-only forever.** No way to say "handled". A song with two
   collaborators accumulated 30 notes and the pad became a graveyard nobody
   read — so feedback moved back to text messages. That is the exact failure
   the room exists to prevent.
2. **Remove was a hard delete.** One mis-tap erased a collaborator's feedback
   with no undo — inconsistent with every other surface in the room (R7:
   nothing is lost).
3. **No author identity in the list.** The pad rendered `author_user_id`; the
   page had to fetch profiles separately (extra request, avatar flicker).
4. **No way to keep the important one on top.** The "key change in the chorus"
   note sank under chatter.

## What shipped (backend — already live)

`song_notes` gained `pinned`, `resolved_at` / `resolved_by_user_id`,
`archived_at` / `archived_by_user_id`, plus a partial index for live rows.

| RPC | Purpose |
|---|---|
| `song_notes_board(_song_id, _include_resolved, _section_id)` | Every live note **with author name + avatar colour**, already ordered: pinned → open → newest. Archived rows never appear. |
| `set_note_resolved(_note_id, _resolved)` | Mark done / undo done. |
| `set_note_pinned(_note_id, _pinned)` | Pin / unpin. |
| `archive_song_note(_note_id)` | Soft remove (author, or anyone with write access). |
| `restore_song_note(_note_id)` | Undo the removal. |

### SDK — `src/integrations/cog/notes.ts`
```ts
import {
  listNotesBoard, addNote, updateNote,
  setNoteResolved, setNotePinned, removeNote, restoreNote,
} from "@/integrations/cog/notes";

const notes = await listNotesBoard(songId);                       // song-level
const open  = await listNotesBoard(songId, { includeResolved: false });
const forSection = await listNotesBoard(songId, { sectionId });   // meaning zone
```
`removeNote` is now a soft archive — same signature, real undo.

---

## Claude's build brief (frontend only)

**Route:** `/songs/:id/notes` (and the section meaning zone).

1. **One fetch.** Replace `listSongNotes` + any profile lookup with
   `listNotesBoard`. Render `author_name` and `author_avatar_color` straight
   from the row — no second request, no avatar pop-in.
2. **Trust the server order.** Do not re-sort on the client. Pinned notes sit
   at the top with a small gold pin glyph (no badge, no colour fill).
3. **Done is a checkbox, not a delete.** A circular tick on the left of each
   note. Tapping it: optimistic, `setNoteResolved(id, true)`, note animates to
   the bottom group over 250 ms with `--cog-ease`.
4. **Done notes stay visible but recede.** Body at 55% opacity, no strike-
   through. A quiet divider above them: *Handled · 4*. Tapping the divider
   collapses/expands the group; the state persists per song in local storage.
5. **Filter is one toggle, not a segmented control.** "Show handled" switch in
   the header → `listNotesBoard(songId, { includeResolved: false })`.
6. **Long-press / overflow menu has exactly three items:** Pin, Edit, Remove.
   Nothing else. Remove → optimistic hide + toast
   `Removed · Undo` (8s) → `restoreNote(id)`.
7. **Composer stays at the bottom, always one tap away.** Single-line growing
   textarea, gold send glyph enabled only when trimmed length > 0. Enter sends
   on desktop, newline on mobile.
8. **Empty states, calm copy.**
   - No notes: *"Thoughts about this song live here. Nothing yet."*
   - All handled: *"Everything here has been handled."*
9. **Viewer role:** composer hidden, tick and menu hidden. Notes read-only,
   with the standard R10 capability line, not a lock icon per row.

## Anti-patterns for this screen
- No unread counts, no red dots, no "3 open notes" badge in the room header.
- No threads or replies. A reply is a new note. (Simple beats clever.)
- No @mentions in this pass.
- No confirmation dialog on remove — the undo toast IS the safety.

## Done when
- Opening the pad is a single network request.
- Marking done never scrolls the list or loses the user's place.
- Removing and undoing returns the exact same note, author and timestamp intact.
- A viewer sees the pad with no write affordances at all.