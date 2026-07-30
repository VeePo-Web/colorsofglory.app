# R47 — The song names itself

**Audit finding.** Songs are created before they are written, so almost every room starts as
"Untitled". Nothing in the room ever asks again. Three weeks later the catalog is a wall of
"Untitled 3", and a writer cannot find, share, or talk about their own work. Naming is currently a
chore the writer has to remember to do, with a blank field and no help.

**The fix, kept simple.** The title is already inside the lyrics. Once the song has words, the room
offers one line — the strongest repeated line — and one tap accepts it. That's the whole feature.

No AI naming. No list of ten options. No modal. One suggestion, one tap, dismissible forever.

## Backend (already shipped — do not build)

- `song_title_suggestions(_song_id)` → up to 5 candidates ranked `hook` > `chorus` > `opening`,
  deduped, short lines only, room-member gated.
- SDK: `src/integrations/cog/title.ts` — `isUnnamed`, `fetchTitleSuggestions`, `renameSong`,
  `tidy`, `nameNudge`.

## UI to build

### 1. The whisper, in the header
When `isUnnamed(song.title)` and suggestions exist, render `nameNudge(...)` directly under the song
title in the room header: 0.875rem, warm-gray, e.g. `Call it "Hold me steady"?`. Tapping it renames
the song immediately with an "Undo" toast. No confirm step.

### 2. The other options
Tapping the title itself (always, named or not) opens the rename sheet: a single text field
pre-filled with the current title, and beneath it the remaining suggestions as plain tappable lines
with a tiny source label (`repeated line`, `from the chorus`, `first line you wrote`). Tapping a
line fills the field — it does not save. Save is one gold button: "Name it".

### 3. Dismissal
Swiping the whisper away, or renaming manually, hides it for that song forever
(`localStorage: cog.title.nudge.dismissed.<songId>`). It never comes back. This room does not nag.

### 4. In the catalog
An unnamed song card shows the first lyric line in warm-gray italics instead of "Untitled", so the
writer recognises it even before naming. Fall back to "Untitled" only when there are no words yet.

## Performance
- Fetch suggestions lazily: only when `isUnnamed(title)` is true, and only after lyrics have loaded.
  A named song never makes this call.
- Cache per song id for the session; a rename invalidates it.
- Rename is optimistic — the header text changes on tap, before the write returns.

## Copy
- Whisper: `Call it "…"?`
- Sheet button: "Name it"
- Source labels: "repeated line" / "from the chorus" / "first line you wrote"
- Never: "suggestion", "AI", "generate".
