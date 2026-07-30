# R35 — Songwriting Room: "What's still missing"

## The one goal
The room exists to move the song forward. When a writer opens it and doesn't
know what to touch next, the room tells them — once, quietly, in a sentence.

## Backend ready
- RPC `song_gaps(_song_id)` → one row per section:
  `section_id, label, kind, section_position, has_words, has_sound, gap`
  where `gap` ∈ `empty | no_words | no_sound | complete`.
  Member-gated, single round trip, no N+1.
- SDK `src/integrations/cog/gaps.ts`:
  `fetchSongGaps`, `nextGap`, `gapLine`, `songWholeness`.

## UI — build exactly this, nothing more

### 1. The next-step line (the whole feature)
Directly under the room header, one line of `--cog-warm-gray`, 0.875rem:

> Bridge has no words yet.  ·  **Open**

- Text comes from `gapLine(nextGap(gaps))`.
- "Open" is a gold text link that jumps to that section in the lyric sheet
  (reuse the feed's jump-target navigation from R32 — same scroll + settle).
- If `nextGap` is null, render **nothing**. No "All done!" banner, no confetti.
- Never show more than one gap. Never a list. Never a count.

### 2. Section headers get one whisper mark
In the lyric sheet, a section with `gap === "no_sound"` shows a small
outline mic glyph at 40% opacity right of its label; `no_words` shows nothing
extra (the empty body already says it). Tapping the mic starts a take for
that section. No colour, no red, no badge.

### 3. Wholeness (optional, header only)
A 2px gold hairline under the song title, width = `songWholeness(gaps) * 100%`,
animating with `--dur-slow` / `--cog-ease-reveal`. No percentage text ever.

## Performance
- Fetch gaps in the same parallel batch as the room bootstrap; never block
  first paint on it — the line fades in when it arrives.
- Cache under `["song-gaps", songId]`, `staleTime: 30_000`.
- Invalidate only after lyric save, take save, or section add/remove —
  not on every keystroke.

## Anti-patterns (forbidden)
- Progress checklists, "3 of 5 sections complete", percentages.
- Red/amber warning states or nagging toasts.
- Blocking anything until gaps are filled.
