# Handoff — Capture Scene (Adobe-Podcast-inspired)

_Owner: Claude. Backend + Phase 1 scaffolding shipped by Lovable on 2026-06-08._

## What ships in Phase 1 (already in repo)

- Route swap:
  - `/` (signed in) → `CapturePage` (the big-mic scene).
  - `/songs` → `SongCatalogPage` (the old `/`).
  - `/songs/:id/capture` → `CapturePage` bound to that song.
  - Old onboarding capture moved to `/songs/:id/capture-onboarding`.
- Bottom nav: tabs are now **Capture · Songs · Settings**.
- Files:
  - `src/lib/capture/transcriptModel.ts` — shared types.
  - `src/lib/capture/sectionKeywords.ts` — pure matcher + `buildTranscriptBlocks`.
  - `src/test/capture/sectionKeywords.test.ts` — 8 passing unit tests.
  - `src/components/capture/BigMic.tsx` — gold pill, tap-to-record, ripple, amplitude ring driven by `AnalyserNode`. Reduced-motion honored.
  - `src/components/capture/SideRail.tsx` — 5 always-labeled chips (Lyrics, Chords, Section, Scripture, Idea).
  - `src/components/capture/LiveTranscript.tsx` — section blocks rendered as cards, words are tap-to-scrub buttons.
  - `src/components/capture/CaptureScene.tsx` — wires recorder → upload via existing `uploadVoiceMemo` + `quickCapture` SDK.
  - `src/pages/CapturePage.tsx` — context-aware page; loads `songs.title` when `:id` is present.
  - `src/index.css` — `@keyframes cog-mic-ripple` (with reduced-motion fallback).

Tap-to-record works end-to-end today: audio uploads to `voice_memos` and is linked to the song via `idea_captures`. Section chip inserts a manual marker at the current timestamp; once a real transcript exists those markers will display as transcript boxes automatically.

## What Claude needs to build (Phase 1.5)

### 1. Live STT through Lovable AI Gateway

`useLiveTranscript(analyser)` hook in `src/lib/capture/useLiveTranscript.ts`:
- Streams PCM frames from the analyser node to a new edge function `capture-stt-stream` (Lovable to ship when this lands — call out in the PR).
- Returns `{ words: TranscriptWord[]; status: 'listening' | 'transcribing' | 'ready' | 'failed' }`.
- Until the streaming function ships, fall back to a **batch transcription on stop** by calling the existing `voice-memo-transcribe` edge function and polling `voice_memo_transcripts` for words + word-level offsets. Replace the `setStatus("ready"|"skipped")` block in `CaptureScene.tsx` with the polled words.

Section detection is already free — `detectSectionMarkers(words, manualMarkers)` runs on whatever stream you feed it.

### 2. Review Sheet (`src/components/capture/ReviewSheet.tsx`)

Bottom sheet (shadcn `Sheet`, drag-to-dismiss, 90vh) that opens once `status === 'ready'`. Sections:
- Friendly auto-name (`generateFriendlyTakeName(songTitle, createdAt)` — see existing capture/takes patterns).
- Block list with rename / merge-up / split-at-word / delete.
- Audio scrubber synced with `LiveTranscript`'s `onWordTap`.
- Destination picker (`DestinationPicker.tsx`): combobox of user's songs + "New song" (calls `createSong` from `src/integrations/cog/songs.ts`).
- Primary CTA "Add to canvas" / secondary "Save to Unfiled".

### 3. Canvas commit

On "Add to canvas":
- For each `TranscriptBlock`, create a section zone and a `LyricCard` populated with `block.text`, linked to `memo_id` + `start_ms`.
- For each `CapturePin`, create the matching card type (`ChordCard`, `NoteCard` with scripture eyebrow).
- Navigate to `/songs/:id/canvas` and toast "Added to <Song>".

Reuse `src/lib/canvas/canvasLoader.ts` patterns; do not invent a new persistence model.

### 4. Side-rail capture sheets

Tapping Lyrics / Chords / Scripture / Idea while **idle** should open a progressive capture sheet (re-use `CaptureSheet.tsx` pattern from the existing capture-bar handoff). Tapping while **recording** should pin without opening the sheet (already partly wired — Section chip works; do the same for the others with a small inline timestamp toast).

### 5. Polish

- Replace the placeholder `00000000-…` UUID in `CaptureScene.handleMicTap` with a proper "no song" branch that **doesn't** call `uploadVoiceMemo` until the user picks a destination in the Review sheet — the current behaviour just hides Unfiled captures behind a no-op upload.
- Add `Space` keybinding to toggle the mic when the page is focused.
- Add `1–5` keybindings for the rail chips.
- A11y: `aria-live` announce "Recording started", "<Section> marker added", "Saved to <destination>".
- Mobile QA at 390 / 430 / 768px.

## Anti-patterns

- No badge counts on the mic.
- No autoplay after save.
- Never send raw lyric text to third-party AI for analytics (project memory rule).
- Keep all chip labels visible — Adobe's "don't be subtle" lesson.