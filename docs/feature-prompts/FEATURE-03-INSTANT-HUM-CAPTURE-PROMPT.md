# Colors of Glory Feature 03 Master Prompt
## Instant Hum Capture: Hold the Mic, Save the Idea

Paste this prompt into Claude Code / Antigravity for Feature 03.

Feature source:
- `zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/Colors of Glory - Feature 3 UX + Implementation Plan.docx`
- `zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/COG_Product_03_Instant_Hum_Capture_Hold_To_Record_UX_Build_Handoff.pdf`
- Root `AGENTS.md`
- Current route: `src/pages/onboarding/CaptureFirstIdeaPage.tsx`

## Role

You are building Feature 03 for Colors of Glory: Instant Hum Capture.

This maps to the songwriting roadmap's Instant Hum Capture / Capture + Audio layer. The goal is to win the first five seconds of inspiration: a songwriter should hold one gold mic button, hum or speak an idea, release, and immediately see the idea saved as a seed card inside the song.

Do not build Feature 2 workspace shell, Feature 4 canvas internals, layered recording, transcription, payments, metronome, Listen Path, AI detection, exports, or full voice memo management. This feature is only instant capture.

Codex's role on this feature is performance, backend/frontend seam quality, instant-feel QA, subtle UX polish, and release readiness.

## Best Implementation Approach

Use the existing `/songs/:id/capture` route as the focused capture surface, and expose the same capture trigger from `/songs/:id`, `/songs/:id/voice`, and `/songs/:id/canvas` later through a lightweight shared button.

Recommended architecture:

- focused capture route for MVP
- reusable `InstantHumCaptureButton`
- recording service isolated from UI
- local-save-before-upload
- optimistic saved seed card
- no heavy audio imports in `App.tsx`, workspace shell, or canvas base route

## Read First

- `AGENTS.md`
- `src/pages/onboarding/CaptureFirstIdeaPage.tsx`
- `src/pages/VoiceMemosPage.tsx`
- `src/components/canvas/FirstActionPrompt.tsx`
- `src/components/canvas/HumCard.tsx`
- `src/components/canvas/VoiceMemoCard.tsx`
- `src/integrations/cog/memos.ts`
- `src/integrations/cog/storage.ts`

## Feature Goal

A user can capture a hum, melody, lyric phrase, chord idea, or prayer moment in under five seconds.

Primary UX sentence:

> Hold the mic. Capture the idea. See it saved.

The feature must feel faster and safer than opening a generic Voice Memos app.

## Required MVP Behavior

1. User opens `/songs/:songId/capture`.
2. User sees one large muted-gold mic button.
3. User presses and holds to record.
4. Mic permission is requested only after intent.
5. Recording state appears immediately.
6. Timer starts within 150ms.
7. User releases to save.
8. Recording is saved locally first.
9. Upload begins after local save.
10. A visible seed idea card appears immediately.
11. If upload fails, local recording remains safe.
12. User can retry upload, add to song, save for later, rename, play, or add note.

## Current Code Audit Notes

The current capture page simulates recording and navigates after stop. Replace that with a proper state machine and service boundary.

Current issues to fix:

- recording state uses red/orange; move to calm gold
- random waveform uses repeated React state updates; avoid broad render churn
- no real MediaRecorder/service boundary yet
- no local preservation behavior yet
- no storage/role/permission state yet
- manual mic SVG can become Lucide `Mic`
- success should show a saved card, not only route away

## UX Requirements

The mic is the hero. Everything else is secondary.

Ready state:

- headline: `Hold to capture`
- support: `Hold the mic when an idea comes.`
- button label: `Hold to record`

Recording state:

- headline: `Recording`
- timer: stable tabular text
- microcopy: `Release to save.`
- optional helper: `Slide away to cancel.`
- active visual: gold ring pulse, not red alert

Saved state:

- headline: `Saved as a seed idea`
- card: `Voice Memo 1 - Just now - 0:12`
- primary CTA: `Add to song`
- secondary CTA: `Save for later`
- actions: `Play`, `Rename`, `Add note`

Failure state:

- headline: `Your idea is saved here`
- support: `We could not upload it yet. Keep this screen open or try again when your connection improves.`
- CTA: `Retry upload`

Storage blocked:

- headline: `Recording is paused`
- support: `Your songs are safe, but new recordings need more storage.`
- CTA: `Manage storage`

Viewer role:

- copy: `You can listen and read in this song. Ask the owner for contributor access to record ideas.`

## What Not To Build

Do not build:

- DAW timeline
- waveform editor
- mixer controls
- file browser
- required naming before recording
- required tags before recording
- required section assignment before recording
- red flashing record UI
- upload-only workflow
- Pro paywall before first capture
- transcription requirement
- technical error copy
- destructive discard without confirmation

## Component Plan

Create or refactor into:

- `src/components/capture/InstantHumCaptureButton.tsx`
- `src/components/capture/HoldToRecordSurface.tsx`
- `src/components/capture/RecordingTimer.tsx`
- `src/components/capture/RecordingRing.tsx`
- `src/components/capture/SavedSeedIdeaCard.tsx`
- `src/components/capture/CapturePermissionNotice.tsx`
- `src/components/capture/CaptureStorageNotice.tsx`
- `src/components/capture/CaptureErrorNotice.tsx`
- `src/lib/capture/recorderService.ts`
- `src/lib/capture/localRecordingCache.ts`
- `src/lib/capture/recordingPermissions.ts`
- `src/lib/capture/recordingValidation.ts`
- `src/lib/capture/captureState.ts`
- `src/lib/analytics/captureEvents.ts`

Use existing memo upload functions where possible:

- `src/integrations/cog/memos.ts`
- `src/integrations/cog/storage.ts`

Do not put upload logic inside React components.

## State Machine

Use an explicit state model:

```ts
type InstantHumCaptureMode =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "saving_local"
  | "uploading"
  | "saved"
  | "upload_failed"
  | "permission_denied"
  | "storage_blocked"
  | "unsupported";
```

Every UI state should render from this state machine. Avoid scattered booleans like `isRecording`, `isUploading`, and `hasError`.

## Performance Requirements

This must feel instant.

Hard targets:

- mic press feedback under 100ms
- timer visible within 150ms
- recording shell visible within 150ms
- local saved card visible within 100ms after stop
- no layout shift between idle, recording, saving, and saved states
- no React render loop above 10 updates per second
- no audio/upload libraries imported into the base app route
- no large waveform arrays in visible card state
- no default browser audio controls

Specific fixes:

- Timer updates once per second.
- Screen reader timer announcements happen less often, not every second.
- Waveform pulse should use CSS animation or isolated refs, not continuous React state across the whole page.
- Only mount audio playback after the saved card exists.
- Only one recording session can exist at a time.
- Duplicate taps/holds must be ignored.
- Use fixed dimensions for mic area, timer, notices, and saved card to avoid CLS.

## Backend/Lovable Seam

Lovable owns backend, but frontend must expose clean interfaces.

Required service contracts:

```ts
requestMicPermission(): Promise<"granted" | "denied">;
startRecording(input: { songId?: string; userId: string }): Promise<RecordingSession>;
stopRecording(sessionId: string): Promise<LocalRecordingResult>;
uploadVoiceMemo(input: {
  songId: string;
  workspaceId: string;
  blob: Blob;
  durationMs: number;
  source: "instant_hum_capture";
}): Promise<VoiceMemo>;
createSeedIdeaCard(input: {
  voiceMemoId: string;
  songId?: string;
  contributorUserId: string;
}): Promise<SeedIdeaCard>;
```

If backend is not ready, use typed adapters and mock responses, but keep the interface real.

## Accessibility Requirements

- Mic button aria label: `Hold to record a voice idea`
- Provide tap-to-start / tap-to-stop alternative.
- Space/Enter starts and stops recording.
- Use one H1: `Hold to capture`
- Errors use `aria-live="polite"`.
- Reduced motion disables ring pulse.
- Touch target: mic button ideal 120px+, minimum 64px.
- Timer uses stable tabular numbers.
- Do not rely on color alone for recording state.

## Analytics Rules

Track only safe fields:

- entry point
- has song context
- role type
- plan type
- duration bucket
- size bucket
- upload status
- retry count
- storage state

Never track:

- raw audio
- transcript text
- lyric content
- full song title
- private notes
- phone numbers
- emails
- invite tokens
- full file names

## Required Tests

Add/update tests for:

- ready state renders at 390px
- mic button accessible label exists
- tap-to-record fallback works
- hold start enters recording state
- release enters saving/local saved state
- upload success shows saved seed card
- upload failure preserves local recording
- permission denied state
- storage blocked state
- viewer cannot record
- duplicate start is ignored
- reduced motion disables pulse
- no technical error copy appears

Run:

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run perf:budget
npm.cmd run qa:mobile
npm.cmd run qa:codex
```

## Acceptance Criteria

Passes only if:

- a user can capture a hum in under five seconds
- recording feedback feels immediate
- release creates a visible seed idea card
- failed upload does not lose the idea
- user is never forced to organize before recording
- UI feels calm, premium, and songwriting-specific
- role/storage/permission states are safe and clear
- no DAW, file-manager, or tech-dashboard feeling appears
- Codex performance and mobile QA pass
