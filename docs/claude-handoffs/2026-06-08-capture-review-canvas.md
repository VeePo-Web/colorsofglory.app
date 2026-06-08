# Handoff — Capture → Review Sheet → Canvas (Adobe-inspired)

Date: 2026-06-08
Owner: Claude Code (frontend). Lovable owns only SDK/backend changes called out below.

## Goal
Turn the existing big-mic Capture scene into a frictionless intake: tap to record → say "Verse 1"/"Chorus" or tap a labeled side button → stop → review sheet with editable blocks → one tap to canvas.

## What is already shipped (do not rebuild)
- `src/components/capture/CaptureScene.tsx` — mic-first scene wired to `useVoiceRecorder`, `uploadVoiceMemo`, `quickCapture`.
- `src/components/capture/BigMic.tsx` — gold pill mic, ripple, amplitude ring, reduced-motion fallback.
- `src/components/capture/SideRail.tsx` — labeled chips: Lyrics · Chords · Section · Scripture · Idea.
- `src/components/capture/LiveTranscript.tsx` — lightweight block list under the mic.
- `src/lib/capture/sectionKeywords.ts` + `transcriptModel.ts` — voice/manual marker merge, `buildTranscriptBlocks`.
- SDK ready: `src/integrations/cog/transcript.ts` (`requestTranscript`, `getTakeWithTranscript`) and `src/integrations/cog/canvas.ts` (`commitTakeToCanvas`, `listCanvasCards`).
- Edge functions live: `transcribe-take`, `commit-take`. Migration `20260608185054_*` added `takes.transcript_*` + `canvas_cards`.

## What Claude builds next

### 1. `useLiveTranscript()` — `src/hooks/useLiveTranscript.ts`
Browser `SpeechRecognition` (webkit on iOS) with batch fallback.
- Returns `{ partial: string, finals: TranscriptWord[], isAvailable: boolean, start(), stop() }`.
- Run `detectSectionMarkers(finals, manualMarkers)` to surface live section chips inside `LiveTranscript`.
- If unavailable → no-op (existing batch transcription via `requestTranscript` on stop still works).

### 2. Progressive side-rail sheets (idle taps)
New `src/components/capture/sheets/*` — one bottom sheet per chip kind:
- **LyricsSheet** — multiline text, optional "attach to current take", save → creates a `lyrics` block locally (or `canvas_cards` insert if a song is bound).
- **ChordsSheet** — Key (select), BPM (number), progression (chip input). Saves as a `chords` block (`body` = `"Key: G · 92 BPM · I–V–vi–IV"`).
- **SectionSheet** — pick kind (Verse / Pre-chorus / Chorus / Bridge / Tag / Outro) + optional number; if recording, inserts a manual marker; if idle, creates a standalone `section` block.
- **ScriptureSheet** — reference + body text. Saves as `scripture` block.
- **IdeaSheet** — single free-text field. Saves as `idea` block.

While **recording**, chip taps must still drop a manual marker at `durationMs` (no modal interruption). Add a small inline pill confirmation instead.

### 3. `ReviewSheet.tsx` — opens automatically on `stopRecording`
Props: `{ takeId, defaultSongId: string | null, manualMarkers: SectionMarker[], localBlocks: TranscriptBlock[], onClose, onCommitted(songId) }`.

Layout (bottom sheet, 92dvh max, drag-to-dismiss):
1. Header: editable take name + duration + destination chip (current song / Unfiled / "New song…").
2. Audio scrubber (use existing waveform component if available; otherwise simple `<audio>` + range) — sourced via `getTakeSignedUrl(storage_path)`.
3. Status row: `processing` → shimmer "Listening back…"; `failed` → retry button; `ready` → blocks list.
4. Blocks list (merge `localBlocks` + `transcript_json.blocks`, ordered by `start_ms`):
   - Section label chip (editable inline)
   - Body text (editable, multi-line)
   - Kind switcher (lyrics / chords / scripture / idea / section) — context menu
   - Word taps → seek audio to `start_ms`
   - Swipe-left → delete; long-press → merge with neighbor
5. Sticky footer: **Add to canvas** (gold, full width). Calls `commitTakeToCanvas({ take_id, song_id: chosen || "__new__", new_song_title, blocks })`, then `navigate('/songs/' + result.song_id + '/canvas?from=capture')`.

On open: call `requestTranscript(takeId)` once; poll `getTakeWithTranscript` every 1.2s until `status !== 'processing'` (max 60s).

### 4. Canvas arrival
On `/songs/:id/canvas?from=capture`:
- Use `listCanvasCards(songId)` to render new cards highlighted for 1.5s (gold pulse).
- Tapping a card with `take_id + start_ms` plays that slice via the take's signed URL.

### 5. Capture scene wiring changes
In `CaptureScene.tsx`:
- On `stopRecording`, instead of toasting, set `reviewTakeId` and render `<ReviewSheet>`.
- Refactor the "no song" branch: still upload, still create the take, but defer `quickCapture`/song selection until the user picks a destination in the sheet.
- Add keyboard: Space toggles mic; 1–5 fire rail chips.

## Error handling
- `429` from `transcribe-take` → toast "Transcription busy — try again in a moment." Keep the audio.
- `402` → "AI credits exhausted — add credits in workspace settings." Link to `/settings/billing`.
- `song_limit_reached` from `commit-take` (free plan, `__new__`) → route to `/upgrade`.
- Network loss while recording → audio still buffered locally; show "Saved on this device — will sync." (use existing `audioCache` if present).

## Visual rules (locked)
- Cream background, gold mic + CTAs, serif section labels — no Adobe purple/dark.
- Labeled chips beat icon-only. Keep the Adobe principle: *don't be subtle*.
- Mobile-first 390px; sheet animates 250ms `var(--cog-ease-reveal)`; respect `prefers-reduced-motion`.
- Calm — no badge counters, no aggressive upsell. Upgrade only on hard gates.

## Out of scope this phase
Layered re-record, compare mode, merge/splice across takes, chord/key auto-detection, streaming server transcripts. Tracked separately.

## Acceptance checklist
- [ ] Opening `/` shows the big mic immediately (no auth wall surprise).
- [ ] One tap records; tapping again stops and opens the Review Sheet.
- [ ] Saying "Verse 1" / "Chorus" mid-recording creates separate blocks in the sheet.
- [ ] Each side-rail chip works while idle (opens sheet) and while recording (drops marker).
- [ ] **Add to canvas** lands the user on `/songs/:id/canvas` with the new cards visible.
- [ ] Tapping a card plays the linked audio slice.