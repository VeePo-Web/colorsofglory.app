# R13 — Songwriting Room Audit: "Two Hands, One Line"

**Goal of the room (unchanged):** everything for this song stays connected here.
**Rule for this pass:** two people writing at once must never cost anyone a line.
If a choice appears between clever merging and simple honesty — choose honesty.

## What the audit found

1. **Silent last-writer-wins.** `saveSongSheet` upserts whole sections. If two
   people have the same section open, the second save erases the first with no
   warning, no trace, no undo entry the writer would ever look for.
2. **No staleness signal.** The editor has no way to know a section changed
   under it. The person keeps typing into a document that is already gone.
3. **Conflicts surfaced as failures.** Anything that did fail read as a generic
   "couldn't save" — which teaches people to distrust the room and to keep a
   copy in Notes. That is the exact behaviour this product exists to end.

## What backend shipped (use these — do not hand-roll)

```ts
import { getSectionHeads, saveSectionGuarded } from "@/integrations/cog/sheet";
```

- `getSectionHeads(songId)` → `[{ section_id, label, section_position, updated_at, updated_by_user_id }]`
  Cheap. Call on room focus / after realtime lyric events.
- `saveSectionGuarded(songId, section, { expectedUpdatedAt, position })` →
  - `{ status: "saved", updated_at }` — store `updated_at` as the new baseline for that section.
  - `{ status: "conflict", updated_at, updated_by_user_id, serverLines }` — **nothing was written.**

Server refuses with `view_only`, `song_locked`, `section_not_found` — map these
to the same wording R10 already uses. Never show raw codes.

## What to build

1. **Per-section baseline.** Keep `updatedAt` per section in editor state, seeded
   from `getSongSheet`. Every guarded save that returns `saved` replaces it.
   Autosave one section at a time — the section the caret is in. No whole-doc saves.
2. **Stale badge, not a modal.** When heads say a section is newer than your
   baseline and you have not touched it, quietly refresh it. If you *have*
   unsaved edits in it, show a single calm line on the section header:
   *"Sarah changed this a moment ago."* No red, no count, no blocking.
3. **Conflict = a choice, never a loss.** On `conflict`, open a side-by-side sheet
   scoped to that one section: **Yours** / **Theirs**, with the differing lines
   emphasized. Three actions only:
   - *Keep mine* → re-save with the returned `updated_at` as `expectedUpdatedAt`.
   - *Keep theirs* → adopt `serverLines`, discard local, baseline = returned stamp.
   - *Keep both* → append your version as a new section labeled `"<Label> (alt)"`.
   Your text stays in the editor until you pick. Dismiss ≠ discard.
4. **Never lose the draft.** The local draft is written to the outbox
   (`@/integrations/cog/outbox`) before the RPC and cleared only on `saved` or an
   explicit resolution. Reload during a conflict must restore the conflict.
5. **Presence, softly.** If realtime shows another member in the room, show a
   small warm-gray avatar row in the sheet header — no cursors, no live typing.
   Awareness prevents most conflicts; live cursors would complicate the sanctuary.

## Acceptance

- Two browsers, same section, both edit, both save → second gets the conflict
  sheet; no text is lost in either window; the DB holds exactly one chosen result.
- Viewer attempts a save → one clear "view only" line; no conflict UI.
- Offline save → outbox holds it, replays on reconnect, conflict still honored.
- Non-conflicting sections continue to save without any extra taps or dialogs.
