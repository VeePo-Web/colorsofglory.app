## Capture Scene — Phase 1.5: Live transcript, Review sheet, Canvas commit

Phase 1 already shipped (big mic, side rail, hold-to-record, take upload, `/` route + Songs tab). This plan finishes the "frictionless idea → canvas" loop.

### 1. Live transcript layer (during recording)
- New hook `useLiveTranscript()` — streams partial text using the browser `SpeechRecognition` API when available (Chrome/Safari iOS), falls back to "Listening…" + amplitude ribbon.
- Renders under the mic: rolling 2-line partial transcript, fades old words.
- Section keywords (`verse one`, `verse two`, `pre-chorus`, `chorus`, `bridge`, `tag`, `outro`) detected live → drops an inline section divider chip in the transcript.
- Manual side-rail taps (Lyrics/Chords/Section/Scripture/Idea) drop a timestamped pin that wins over voice detection if within 1.5s.

### 2. Finalized transcript on save
- On stop: send the take audio to a new edge function `transcribe-take` (Lovable AI Gateway, Gemini Flash audio input) for the canonical transcript with word-level ms offsets.
- Merge live pins + voice-detected sections + final transcript into a `TranscriptModel` of ordered blocks: `{ kind: 'verse'|'chorus'|'bridge'|'chords'|'scripture'|'idea'|'lyrics', label, text, startMs, endMs, words[] }`.
- Persisted on the `takes` row (existing) as `transcript_json`.

### 3. Review sheet (bottom sheet, opens automatically after stop)
- Header: take name (editable, friendly default like "Idea · Mon 2:14pm"), duration, destination chip.
- Audio scrubber with waveform; tapping a word in a block scrubs to that ms.
- Block list — each block is a card you can:
  - Rename (Verse 1 → Pre-Chorus)
  - Merge with previous / split at cursor
  - Delete
  - Change kind (lyrics ↔ chords ↔ scripture ↔ idea)
- Destination picker: "New song" (default if on `/`) or existing song from catalog.
- Sticky CTA: **Add to canvas** (gold) — commits blocks as canvas cards.

### 4. Canvas commit
- New SDK call `commitTakeToCanvas(takeId, songId, blocks[])` → edge function `commit-take` creates:
  - `songs` row if "New song"
  - One `canvas_cards` row per block (lyrics/scripture/idea → text card; chords → chord card; section blocks → section header card)
  - Links each card back to `take_id` + `start_ms`/`end_ms` so tapping the card plays that audio slice
  - Activity log entry
- After commit: navigate to `/songs/:id/canvas` with the new cards highlighted briefly.

### 5. Files

New frontend (Claude scope — handoff doc only, I won't write these):
- `src/components/capture/LiveTranscript.tsx`
- `src/components/capture/TranscriptBlock.tsx`
- `src/components/capture/ReviewSheet.tsx`
- `src/components/capture/DestinationPicker.tsx`
- `src/hooks/useLiveTranscript.ts`

New backend (Lovable scope — I will write):
- `supabase/functions/transcribe-take/index.ts`
- `supabase/functions/commit-take/index.ts`
- Migration: add `transcript_json jsonb`, `transcript_status text` to `takes`; create `canvas_cards` table + RLS + GRANTs (gated by `is_song_member`)
- `src/integrations/cog/transcript.ts` — `requestTranscript(takeId)`, `getTake(takeId)`
- `src/integrations/cog/canvas.ts` — `commitTakeToCanvas(...)`, `listCanvasCards(songId)`
- `src/lib/capture/sectionKeywords.ts` + tests (already partly in Phase 1, extend)
- `src/lib/capture/transcriptModel.ts` — merge logic for pins + voice sections + final transcript

Handoff doc: `docs/claude-handoffs/2026-06-08-review-sheet.md` covering LiveTranscript, ReviewSheet, DestinationPicker visual spec + component API the SDK already exposes.

### 6. Out of scope (this phase)
- Streaming partials from the server model (Phase 2)
- Chord/key/BPM auto-detection
- Layered "record over this" takes
- Compare mode / merge / splice on canvas
- Onboarding integration
- Phone OTP, email templates, billing screens

### 7. Verification
1. Sign in, land on `/`, big mic visible.
2. Tap mic, say "Verse one, holy is the Lord. Chorus, glory glory." → live transcript shows partials + a `Chorus` divider appears mid-stream.
3. Tap **Section** chip during recording → manual section pin lands at that ms.
4. Tap mic to stop → Review sheet slides up with named blocks.
5. Rename a block, scrub by tapping a word, change destination to "New song".
6. Tap **Add to canvas** → lands on `/songs/:id/canvas` with cards visible.
7. Tap a card → plays that slice of the original take.
8. Reduced-motion: sheet fades instead of sliding; no ripple on mic.
