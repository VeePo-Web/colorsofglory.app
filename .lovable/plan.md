You want this working in the app now, not waiting for Claude. I'll temporarily cross the frontend boundary (with your go-ahead) to ship the capture → review → canvas flow, and also drop a Claude prompt you can hand off later if he wants to repolish.

## What I'll build in Lovable

### 1. `src/hooks/useLiveTranscript.ts`
Browser `SpeechRecognition` (webkit on iOS) wrapper.
- Returns `{ partial, finalWords[], isAvailable, start(), stop(), reset() }`.
- No-op fallback when unavailable so batch transcription still works on stop.

### 2. Side-rail progressive sheets — `src/components/capture/sheets/`
One bottom sheet per chip, opened when the rail is tapped while idle. While recording, chip taps keep dropping timestamped pins (no modal interruption).
- `LyricsSheet` — multiline text.
- `ChordsSheet` — Key select + BPM + chord progression chips.
- `SectionSheet` — kind (Verse / Pre-chorus / Chorus / Bridge / Tag / Outro) + optional number.
- `ScriptureSheet` — reference + body.
- `IdeaSheet` — single free-text field.

Each saves a local "pending block" that flows into the Review Sheet.

### 3. `src/components/capture/ReviewSheet.tsx`
Auto-opens on stop. Built with `Sheet` from shadcn.
- Editable take name, duration, destination chip (current song / Unfiled / "New song…").
- Audio scrubber using a signed URL (new SDK helper).
- Poll `getTakeWithTranscript` every 1.2s until `ready` or `failed` (60s cap).
- Merged blocks list (voice transcription + manual pins + side-sheet entries) ordered by `start_ms`.
- Per-block: rename label, edit body, change kind, delete.
- Sticky gold **Add to canvas** → calls `commitTakeToCanvas` → navigates to `/songs/:id/canvas?from=capture`.

### 4. Wire it into `CaptureScene.tsx`
- On stop: create take row, kick off `requestTranscript`, open `ReviewSheet`.
- Keyboard: Space toggles mic; 1–5 fire rail chips.
- Keep all existing copy and the cream/gold visual language locked.

### 5. Tiny SDK addition — `src/integrations/cog/takes.ts`
Add `getTakeSignedUrl(storage_path)` if not already present, so the Review Sheet can play the audio.

### 6. Canvas arrival polish — `src/pages/SongCanvasPage.tsx`
When `?from=capture` is set, pulse newly-arrived cards gold for ~1.5s. Tapping a card with `take_id + start_ms` plays that slice.

### 7. Claude prompt
Save `docs/claude-handoffs/2026-06-08-capture-polish-prompt.md` — a copy-pasteable prompt Claude can use later to repolish visuals, motion, and copy without changing data contracts.

## Out of scope this round
- Live streaming server transcripts (browser STT only for the live preview).
- BPM / key / chord auto-detection.
- Layered re-record, compare mode, merge across takes.

## Success check
- Tap mic → record → say "Verse 1", "Chorus" → stop → Review Sheet opens with separated blocks → edit + pick destination → Add to canvas → land on `/songs/:id/canvas` with cards visible and playable.

## Note on the boundary
Project memory says Lovable shouldn't touch `src/pages/**` or `src/components/**`. You explicitly asked me to continue in Lovable so it actually saves and you can use it — I'll proceed on that override and keep the changes additive so Claude can re-skin later without conflicts.