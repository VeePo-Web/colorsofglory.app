# Capture Scene — Phase 2 (Claude handoff)

Owner: Claude Code. Scope: `src/components/capture/**` + `src/lib/capture/**` only. Do NOT touch backend, SDK (`src/integrations/cog/**`), migrations, edge functions, or canvas internals (only the deep-link query contract below).

Plan of record: `.lovable/plan.md` (section "Capture Scene — World-Class Phase 2"). This doc is the build spec.

## Already shipped (do not redo)
`CaptureScene`, `BigMic` (tap/hold), `SideRail`, `ReviewSheet` (reorder/merge/delete), `CommitRibbon`, `LatestPeekStrip`, `sectionKeywords` + `acousticSplits` + `transcriptModel`, dictation everywhere, `ChordPicker`, `ScripturePicker`, Web Speech + ElevenLabs fallback. Backend: `takes`, `idea_captures`, `intake-voice-memo`, SDK at `src/integrations/cog/{capture,takes,player,intake}.ts`.

## Build list

### A. Idle scene polish — `CaptureScene.tsx`
- Strip all chrome except: top-left `Unfiled` pill (tap → `DestinationPicker`), centered `RotatingPrompt`, `BigMic`, bottom dock, `LatestPeekStrip` (only if ≥1 capture).
- Single radial gold glow under mic (`.cog-glow` already in tokens).
- No nav bar in capture mode.

### B. Rotating prompt — create `RotatingPrompt.tsx`
Serif 24px charcoal. Picks based on `new Date()`:
- Sunday any time → "Sunday — what stirred today?"
- 04–11 → "A quiet idea this morning?"
- 12–17 → "What's on your heart right now?"
- 18–22 → "Tonight's melody — let it out."
- 23–03 → "Late-night idea? Hum it."
- Fallback rotation of 3 evergreens.
Fades out 600ms when `recording` prop true.

### C. BigMic upgrades — `BigMic.tsx`
- Replace fake pulse with **RMS-reactive ring** via new `useRmsReactive` hook (see E). Ring scale = `1 + rms*0.35`, smoothed 80ms.
- Long-press (>500ms) while recording = pause (ring dims to 40%, transcript pauses). Release resumes.
- Swipe down >40px on the mic = stop + open `ReviewSheet`.
- Two-finger tap during recording = `scratchLast(5_000)` and ring flashes white 200ms + haptic.
- Hold (existing) = hum mode (8s cap); tap (existing) = full idea.
- Permission denied → render greyed chip variant + tooltip "Enable mic in Settings". Dock still works.

### D. Bottom dock — rename `SideRail.tsx` → `BottomDock.tsx`
- Labels always visible: Lyrics · Chords · Scripture · Idea.
- Idle: opens `CaptureSheet` for that type.
- **While recording**: tapping inserts a typed marker card at current timestamp into the take's section list (type = button kind). Gold flash on the tapped button 300ms.

### E. New libs — `src/lib/capture/`
- `rmsReactive.ts`: `useRmsReactive(stream: MediaStream | null) → { rms: number, analyser }`. Uses `AudioContext` + `AnalyserNode` fftSize 1024, returns time-domain RMS smoothed. Cleanup on stream end.
- `scratchLast.ts`: `scratchLast(state, ms)` — trims last `ms` from take buffer (PCM chunks list) and removes finalized transcript words whose `end > now-ms`. Pure function over `TranscriptModel` + chunk array.
- Extend `sectionKeywords.ts` vocab: add `pre-chorus`, `pre`, `tag`, `hook`, `refrain`, `intro`, `outro`, `vamp`, `breakdown`. Keep fuzzy matcher + filler-strip behavior.

### F. Review sheet — `ReviewSheet.tsx`
- Destination chip at top: `Unfiled · This Song · New Song` → opens `DestinationPicker` sheet. Default `Unfiled`.
- Per-card additions: **type chip** (lyrics/chords/scripture/idea/hum), **Split** action (splits card at caret position in transcript), play button uses existing mini-player.
- Primary CTA: gold full-width "Send to canvas →".
- On commit: write via existing SDK (`idea_captures.commit`, `takes.insert`), then show `CommitRibbon` with deep-link `/songs/:id/canvas?from=capture&capture_id={id}`.

### G. New components
- `DestinationPicker.tsx` — bottom sheet listing Unfiled, recent songs (via `cog/songs.listRecent`), "New Song" with inline name input.
- `CoachMark.tsx` — one-time tooltip on mic; stores `localStorage['cog:capture:coached']=1` after first take.

### H. Friction-cutters
- Offline detection (`navigator.onLine`) → ribbon copy switches to "Saved offline · will sync"; SDK already queues.
- Background tab → keep recording, title bar shows "● Recording — Colors of Glory".

### I. Canvas handoff contract (read-only here)
Capture commits must include `capture_id` and `section_card_ids[]` in the redirect URL: `/songs/:id/canvas?from=capture&capture_id=…`. Canvas owners will animate matching nodes with a 1.2s gold pulse — do not implement that here.

## Files

**Edit:** `CaptureScene.tsx`, `BigMic.tsx`, `ReviewSheet.tsx`, `sectionKeywords.ts`
**Rename:** `SideRail.tsx` → `BottomDock.tsx` (update imports)
**Create:** `RotatingPrompt.tsx`, `DestinationPicker.tsx`, `CoachMark.tsx`, `rmsReactive.ts`, `scratchLast.ts`
**Tests:** `src/test/capture/rotatingPrompt.test.ts`, `scratchLast.test.ts`, `sectionKeywordsVocab.test.ts`, `destinationRouting.test.tsx`

**Do not touch:** `src/integrations/cog/**`, `supabase/**`, `src/pages/**` outside capture route mount, any canvas component internals.

## Acceptance (must all pass)
1. Cold open: only mic + serif prompt + glow + dock + Unfiled pill visible.
2. Say "verse one, holy is the Lord, chorus, all glory" → 2 cards (Verse 1, Chorus), marker words stripped.
3. Hold 6s → hum card, no transcript, waveform only.
4. Mid-record tap Chords dock → typed Chord card inserted at timestamp.
5. Two-finger tap → last 5s scratched, ring flashes.
6. Commit to New Song → ribbon → tap → `/songs/:id/canvas?from=capture&capture_id=…`.
7. Mic denied → grey chip; dock typed capture still works.
8. Returning user → peek strip shows last 3; tap reopens review for that capture.
9. Offline → ribbon says "Saved offline · will sync".

## Out of scope
Canvas internals, workspace, catalog, auth, payments, settings, backend.