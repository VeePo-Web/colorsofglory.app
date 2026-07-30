# R46 — Point at the moment

**Audit finding.** Feedback on a recording is currently song-level. Someone hears the lift at
fourteen seconds and has to write "the bit near the start of the second take". The listener then
scrubs and guesses. That is the slowest loop left in the room.

**The fix, kept simple.** A note can be pinned to a point inside a recording. Tap the waveform while
listening, type one line, done. Tap the mark later and playback jumps there.

No threads-on-timeline. No ranges. No colours. One dot, one line, one jump.

## Backend (already shipped — do not build)

- `song_notes.take_id` + `song_notes.at_ms`
- `add_moment_note(_take_id, _at_ms, _body)` → the new note
- `take_moment_notes(_take_id)` → ordered notes for that take
- SDK: `src/integrations/cog/moments.ts` — `addMomentNote`, `listMomentNotes`, `stamp`,
  `markerPosition`, `activeMomentNote`, `momentsLine`

## UI to build

### 1. Marks on the waveform
Gold dots at `markerPosition(note.at_ms, take.duration_ms)`, sitting on the baseline of the
waveform, 6px, 60% opacity. Never overlap the bars. Tapping a dot seeks to `at_ms` and shows the
note text in the strip below.

### 2. Adding one
While a take is playing, a small "Note this moment" ghost button next to the transport. Tapping it
pauses playback, captures the current `currentTime * 1000`, and opens a one-line input with the
stamp shown as a static prefix (`0:14`). Enter saves. Escape discards. Playback resumes on save.
Optimistically render the dot before the RPC returns.

### 3. The strip
Under the waveform, one line at a time — not a list. Show `activeMomentNote(...)` as the playhead
moves: `0:14 · Sarah — "the melody lifts here"`. When no note is near, the strip is empty (collapsed
height, no placeholder). This is how a listener hears the feedback in time with the music.

### 4. On the card, at rest
`momentsLine(notes)` as a 0.75rem warm-gray footer line. Nothing else. No badge, no count pill.

### 5. Resolving
Long-press a dot → "Done with this". Resolved notes drop out of the strip and the footer count but
stay in the notes pad history. Reuse the existing resolve mutation.

## Performance
- Fetch moment notes once per take, alongside the take payload — never per dot.
- `activeMomentNote` runs on `timeupdate`; keep it out of React state churn by writing the strip
  text through a ref when the resolved note id is unchanged.
- Dots render as absolutely-positioned divs, not SVG re-layout.

## Copy
- Button: "Note this moment"
- Empty long-press menu: "Done with this"
- Never: "comment", "annotation", "timestamp".
