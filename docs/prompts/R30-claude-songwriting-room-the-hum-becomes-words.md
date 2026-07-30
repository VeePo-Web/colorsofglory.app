# R30 — The hum becomes words

**Goal:** you sang a verse into your phone. The words you sang should land in the sheet
without you typing them again. Review, tap, done.

## Backend (done — Lovable)

- `take_transcript_lines(_take_id)` → `{ status, lines: [{ ord, text, start_ms, end_ms }] }`.
  Uses the take's transcript, falls back to the memo-level transcript, and falls back again to
  sentence-splitting plain text. Always returns an array — never null.
- `apply_transcript_to_section(_section_id, _lines[], _mode)` — `append` or `replace`.
  Upserts `song_lyrics` (v1 lines, empty chord anchors), logs `transcript_applied`, bumps the song.
- SDK: `src/integrations/cog/transcript.ts` — `fetchTranscriptLines`, `applyTranscriptToSection`,
  `transcriptIsReady`.

## UI to build (Claude)

**Where it appears:** on a take card, once the transcript is ready, one quiet gold line:
`Use these words`. While it's still transcribing, the same line reads `Listening…` in muted
warm-gray, no spinner, no percentage.

**Review sheet:**
- Header: serif, "What we heard".
- Each line is its own row with a gold check on the left — all checked by default.
  Tap a row to uncheck it (dims to `--cog-muted`, strike-through never used).
- Tap the line's text to edit it inline. This is the only editing surface; no separate edit mode.
- Tap the timestamp chip on the right to hear just that slice of the take.
- Destination row at the bottom: section chips (existing sections + "New section").
- Two choices only: **Add to the end** (default, gold CTA) and a text link "Replace this section".

**After applying:** sheet closes, the sheet view scrolls to the section, added lines fade in
one after another at 40ms stagger. Toast: "4 lines added to Verse 1." with Undo (version restore).

**Rules**
- Never auto-apply a transcript. The writer always sees the words first.
- Never show confidence scores, model names, or the word "AI".
- Viewers don't see `Use these words` at all.
- Prefetch the transcript when the take card enters the viewport so the sheet opens instantly.

## Done when
A hummed verse becomes typed lyrics in the sheet in two taps, and the writer never retypes a line.
