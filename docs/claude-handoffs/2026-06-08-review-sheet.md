# Handoff — Phase 1.5: Live transcript + Review sheet + Canvas commit

Date: 2026-06-08
Owner: Claude Code (frontend)
Backend: shipped this turn by Lovable.

## What's live on the backend

### Migration `20260608070000_takes_transcript_canvas.sql`
- `takes.transcript_status` (`idle | processing | ready | failed`), `takes.transcript_json` (jsonb), `takes.transcript_error`.
- New table `public.canvas_cards`:
  - `kind`: `lyrics | chords | scripture | idea | section`
  - `section_kind`, `label`, `body`, `start_ms`, `end_ms`, `position`, `x`, `y`, `take_id` (FK SET NULL)
  - RLS: members read/insert/update via `is_song_member`; delete by creator or owner.

### Edge functions
- `POST /functions/v1/transcribe-take` body `{ take_id }` → `{ take_id, status, blocks: TranscriptBlock[] }`.
  Uses Lovable AI Gateway (Gemini 2.5 Flash, audio input) and persists the structured payload to `takes.transcript_json`. 429/402 surfaced as those status codes.
- `POST /functions/v1/commit-take` body `{ take_id, song_id | "__new__", new_song_title?, blocks[] }` → `{ song_id, card_ids[] }`.
  Verifies membership (or `can_create_song` when `__new__`), inserts one `canvas_cards` row per block, bumps `songs.last_activity_at`, audit-logs `commit_take`.

### SDK (`src/integrations/cog/`)
- `transcript.ts` — `requestTranscript(take_id)`, `getTakeWithTranscript(take_id)`, types `TranscriptBlock`, `TranscriptPayload`, `TranscriptStatus`.
- `canvas.ts` — `commitTakeToCanvas(input)`, `listCanvasCards(song_id)`, `updateCanvasCard`, `deleteCanvasCard`, type `CanvasCard`.
- Existing `takes.ts` (`createTake`, `getTakeSignedUrl`) and `capture.ts` (`quickCapture`) unchanged.

## What Claude builds

### 1. `useLiveTranscript()` hook (`src/hooks/useLiveTranscript.ts`)
- Browser `SpeechRecognition` (webkit-prefixed on Safari iOS) when available; otherwise no-op that emits empty partials.
- Returns `{ partial, finals, isAvailable, start, stop }`.
- Run `detectSectionMarkers` from `src/lib/capture/sectionKeywords.ts` against accumulated `finals` to surface live section chips.

### 2. `LiveTranscript.tsx`
Rolling 2-line view under `BigMic`. Show partial in muted, finals in charcoal. When a section keyword fires, slide in a small chip ("Chorus", "Verse 2") inline.

### 3. `ReviewSheet.tsx` (auto-opens on take stop)
Props: `{ takeId, defaultSongId: string | null, onClose, onCommitted(songId) }`.

Flow:
1. On open call `requestTranscript(takeId)`. Show shimmer "Listening back…".
2. On `ready`, render `TranscriptBlock` cards from `transcript_json.blocks`. Each card:
   - Editable label (e.g. "Verse 1")
   - Editable body text
   - Kind switcher (lyrics / chords / scripture / idea / section)
   - Tap any word → seek audio scrubber to `start_ms` (use `getTakeSignedUrl(storage_path)`).
3. `DestinationPicker.tsx` chip at top: "New song" (default if `defaultSongId === null`) or any song from `listMySongs()`.
4. Sticky gold CTA **Add to canvas** → call `commitTakeToCanvas({ take_id, song_id: chosen || "__new__", new_song_title, blocks })` and navigate to `/songs/:id/canvas`.

### 4. Canvas rendering
Use `listCanvasCards(songId)` to render cards in `position` order. Tapping a card with `take_id + start_ms` plays that slice from the signed take URL.

## Error handling
- 429 from `transcribe-take` → toast "Transcription busy, try again in a moment."
- 402 → "AI credits exhausted — add credits in workspace settings."
- `song_limit_reached` from commit (free plan, `__new__`) → route to `/upgrade`.

## Out of scope this phase
Streaming server transcripts; chord/key detection; merge/splice; compare mode; layered re-record.