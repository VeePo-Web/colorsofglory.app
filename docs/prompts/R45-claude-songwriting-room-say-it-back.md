# R45 — Songwriting Room Audit: "Say it back"

## The one goal
The room exists so a song and everything said about it stay in one place.
Feedback is the part that used to live in iMessage — and right now the room
reproduces the exact problem it was built to solve: a collaborator leaves
"the second line feels rushed", the writer answers with a *separate* note,
someone else adds another, and a two-line exchange becomes four unrelated
cards with no visible relationship. The conversation is technically saved and
practically lost.

## The rule for this feature
Replies are **one level deep**. A note, and the answers to it. No threads inside
threads, no @mentions, no rich text, no emoji reactions on replies (Amen already
exists at card level — R39). If it looks like a chat app, we went too far.

## Backend (already shipped by Lovable)
- `song_notes.parent_note_id` (nullable, cascades with the parent).
- RPC `reply_to_note(_parent_note_id, _body)` — write-permission checked, rejects
  replying to a reply, inherits the parent's `section_id`, logs `note_replied`.
- RPC `note_replies(_parent_note_id)`.
- Resolving or archiving a parent puts the whole thread away with it.
- SDK (`src/integrations/cog/notes.ts`): `replyToNote`, `listNoteReplies`,
  `groupNoteThreads`, `replyLine`.

## UX to build

### 1. The note card becomes a small thread
Render with `groupNoteThreads()`. A note with replies shows them **inline**, directly
beneath the parent body:
- Replies are indented by 16px with a 1px `--cog-border` left rule (not a bubble).
- Each reply: first name + reply body. Timestamp only on hover/long-press.
- Show the **last 2 replies**. If there are more, one warm-gray line above them:
  `Show all 5` — expands in place, no navigation, no sheet.

### 2. Replying is one tap and one field
Under every root note, a single ghost row: `Reply`. Tapping it swaps the row for an
auto-focused one-line input with a gold send arrow. Enter sends. Blur with an empty
field closes it silently. No cancel button.

### 3. Optimistic, always
- The reply appears the instant Enter is pressed, at 60% opacity until confirmed.
- On failure: keep the text in the input, one quiet toast, never lose typing.
- Never refetch the board after a reply — append to the cached thread.

### 4. Resolve closes the conversation, not the record
`Resolve` on a parent collapses the whole thread to a single muted line:
> Resolved · "the second line feels rushed" · 2 replies

Tapping it re-expands. Resolved threads sink to the bottom of the notes list. Nothing
is deleted and Recently Removed (R34) still covers it.

### 5. Feed behaviour
`note_replied` events **collapse into the parent note's feed row**. The feed shows
"Sarah replied on Verse 2" once per thread per session — never one row per reply.
Tapping it opens the notes list scrolled to that thread with the parent briefly
outlined in `--cog-border-gold` for 1.2s.

## Performance requirements
- `song_notes_board` already returns replies; grouping is client-side and O(n).
  Never call `listNoteReplies` during normal room rendering — it exists only for
  deep links and share views.
- Expanding "Show all" uses data already in memory. Zero fetch, zero spinner.
- The reply input mounts lazily — do not render an input per note.

## Explicitly out of scope
- Nested replies, mentions, typing indicators, read receipts.
- Attaching audio to a reply (a hum is a take, not a comment).
- Editing someone else's reply.

## Definition of done
1. A back-and-forth about one line reads as one block, in order, in the room.
2. Replying takes one tap and one Enter, and paints instantly.
3. Resolving collapses the conversation without destroying it.
4. Ten replies never produce ten feed rows.
