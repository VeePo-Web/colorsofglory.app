# R44 — Songwriting Room Audit: "This hum belongs in the chorus"

## The one goal
The room exists so everything for one song stays connected. Right now a recording
lands wherever it was made and can never move. Ideas arrive before structure —
you hum a melody in the car, and only two days later does it become the bridge.
Because nothing can move, the room quietly fills with orphan audio and the writer
loses the thread. That is the exact failure the room was built to prevent.

## The rule for this feature
Filing is **one tap on a section name**. No drag-and-drop, no folders, no multi-select,
no "organise" mode. If a writer has to think about where a tap will land, we failed.

## Backend (already shipped by Lovable)
- RPC `move_memo_to_section(_memo_id, _section_id)` — pass `null` to unfile.
  Owner/contributor only. Validates the section belongs to the song. Logs
  `memo_filed` activity with `from_section_id` so the move is reversible and visible.
- RPC `song_unfiled_memos(_song_id)` — recordings not yet attached to a section.
- SDK: `src/integrations/cog/filing.ts` — `fileMemo`, `fetchUnfiledMemos`,
  `rankSections`, `unfiledLine`.

## UX to build

### 1. "Not filed yet" is a section, not a warning
At the **bottom** of the voice list in the room, render unfiled recordings under a
plain warm-gray label:

> Not filed yet

Same card design as every other take. No amber, no count badge, no red. If there are
zero unfiled recordings, the whole group disappears — no empty state.

### 2. The filing tap
On any recording card, the section name (or `Not filed yet`) is itself the control.
Tapping it opens a short sheet:

- Title: the recording's friendly name, serif, one line.
- A simple vertical list of the song's sections in `rankSections()` order — the section
  currently in view first, then the last section this writer filed into, then song order.
- The current section shows a small gold dot at the right. Nothing else is marked.
- Last row: `Not filed yet` (removes the section).
- No Save button. Tapping a row files it and dismisses the sheet in the same gesture.

### 3. Optimistic and instant
- The card moves groups in the same frame as the tap — before the RPC resolves.
- Play state survives the move: if the recording is currently playing, it keeps playing.
- On failure: move it back, one toast ("Couldn't file that. Try again."), nothing else.
- Never refetch the whole room after a file. Patch the one memo in cache.

### 4. Undo lives in the toast, not in a menu
After a successful file, show a 4-second quiet toast:
> Filed under Chorus. **Undo**

`Undo` calls `fileMemo(id, previousSectionId)`. Use the `from_section_id` you already
have locally — no extra read.

### 5. New recordings suggest their home
When a recording is created while a section is on screen, file it into that section
automatically (the writer was already there). Do not ask. If no section is on screen,
leave it unfiled — and say nothing.

### 6. Feed
`memo_filed` events are **collapsed** in the feed. They never appear as their own row.
Filing is housekeeping, not news. If a memo is filed within 10 minutes of being added,
the feed shows only "added a recording to Chorus".

## Performance requirements
- The section list in the sheet comes from data already in the room cache. Zero fetch.
- Sheet opens in under 100ms; no skeleton, ever.
- `fetchUnfiledMemos` runs once with the room load and then only on realtime invalidation.

## Explicitly out of scope
- Moving a recording between songs.
- Bulk filing / select-many.
- Any drag-and-drop.
- Nested folders, tags, or playlists for audio.

## Definition of done
1. Every recording shows where it lives, and that label is tappable.
2. Filing takes exactly one tap and repaints instantly.
3. Undo is always available for 4 seconds and always exact.
4. A room with no unfiled recordings shows no trace of this feature at all.
