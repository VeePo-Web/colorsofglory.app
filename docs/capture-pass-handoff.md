# Capture Lane — Pass Handoff

Living log for the re-firable `/capture` loop. Newest pass on top. Each pass closes
the worst remaining reliability/latency/UX gap, ships green, and names the next slice.

---

## Pass 3 — Canvas layer retain+retry + de-coral active recording (commit 0ad3e69)

**Nailed:** the canvas save (base voice memos AND "record over this" **layers**)
uploaded the blob straight from state with no local cache — a dropped upload lost
the take, the same gap pass 1 closed for the song room, and a layered take is the
most irreplaceable capture of all.

- `SongCanvasExperience.handleSaveMemo` now routes through `enqueuePendingUpload`
  (cache-first, `parentMemoId`-aware) → `flushPendingUpload`; a failed upload keeps
  the card with its blob safe; a **recovery sweep** on load auto-retries every
  orphaned take. The pending row id keys both the card and the upload idempotency.
- De-coraled the **last** off-palette coral in the capture lane: the
  active-recording state of both record buttons + the `mic-pulse` keyframe now use
  charcoal + a gold glow (matching the gold waveform + charcoal stop). Destructive
  Delete / error "Failed" reds intentionally kept (semantic, not "recording live").

tsc 0, 36 tests pass, build green.

**Reliability ledger:** dropped-upload now CLOSED on **all three** recorded-take
paths (song-room base, canvas base, canvas layer) + recovery sweeps on both
surfaces. Only `handleFileUpload` (VoiceMemosPage) still lacks retain+retry — and
it's the lowest risk, because the source file still exists on the device.

### Next slices (in order)
1. **`handleFileUpload` retain+retry** (lowest-risk path; finishes the ledger).
2. Latency instrumentation marks (gesture→record · stop→card · tap→playback) to
   prove the three budgets on a real device.
3. A shared `useMemoSave` hook to collapse the now-three near-identical save+retry
   handlers (VoiceMemosPage + canvas) into one source of truth.

---

## Pass 2 — Tokenize + de-duplicate the capture sheets (commit d3c80d4)

**Nailed:** the three capture sheets (`RecordingSheet`, `CaptureShell`,
`VoiceReviewSheet`) re-declared ~150 lines of identical inline-styled chrome in
raw hex — a standing brand-token violation. Now they compose three shared,
fully tokenized pieces and the off-system coral is gone.

**New shared pieces (all on `var(--cog-*)`):**
- `CaptureSheetShell.tsx` — scrim + sheet + handle + slide-up motion + safe-area.
- `MicPermissionPanel.tsx` — the "microphone access needed" state, calm gold,
  diagnostics in muted warm-gray (not red).
- `CaptureStopButton.tsx` — stop is charcoal + a filled square glyph, **de-coraled**
  to match the gold live waveform (red is not in the COG palette).

`VoiceReviewSheet` wrapped in the shell; every inner hex → token; discard button
de-coraled to a neutral ghost. Net **−120 lines**. Behavior-preserving:
tsc 0, 27 tests pass, build green.

**Remaining off-brand coral:** the page-level "Record new memo" sticky button +
`@keyframes mic-pulse` in `VoiceMemosPage` still use coral rgba while recording —
a deliberate next micro-pass (it's the page, not the sheets).

### Next slices (in order)
1. **Extend retain+retry to the layer ("record over this") + file-upload paths**
   (adopt `pendingUploads`; file-upload is lower risk — source file still on device).
2. De-coral the page record button + mic-pulse keyframe to gold/charcoal.
3. Latency instrumentation marks (gesture→record · stop→card · tap→playback).

---

## Pass 1 — In-song retain+retry (commit 073e683)

**Nailed:** an in-song voice memo now survives a dropped network. The take is cached
to IndexedDB *before* any upload; a failed save is a calm "Saved on device · tap
Retry" card (gold, not alarm red), never a dead end; a recovery sweep on load
re-surfaces and auto-retries takes orphaned by a prior session.

**Root cause fixed:** `VoiceMemosPage.handleSaveMemo` nulled `pendingRecording` then
uploaded; on failure the blob was already gone — the irreplaceable take was lost.

**New infra:** `src/lib/voice/pendingUploads.ts` (local-first queue mirroring
`seedIdeaApi`; row id = upload idempotency key; re-keys blob to memo id on success).
Tests: `src/lib/voice/pendingUploads.test.ts` (9).

**Reliability ledger after this pass:**
- Dropped network mid-upload (in-song) → CLOSED (cache-first + retain + retry)
- App crash / reload mid-upload → CLOSED (recovery sweep auto-retries)
- Double-tap save → guarded (isSaving guard + idempotencyKey)
- Interruption / page-hidden / ceiling / denied mic / iframe → already handled in
  `useVoiceRecorder` (pre-existing, world-class)

**Verified:** `tsc --noEmit` 0, `vite build` green, 24 tests pass.
**Could NOT verify here:** real-hardware iPhone mic + a true live network drop.
USER TEST: record an in-song memo with the phone in airplane mode after capture →
the card should read "Saved on device · tap retry"; turn networking back on, tap
Retry → it uploads and becomes Ready. Kill the tab mid-upload, reopen the song →
the take re-appears and auto-retries.

### Highest-leverage NEXT slices (in order)
1. **Tokenize + de-duplicate the capture sheets.** `RecordingSheet.tsx`,
   `CaptureShell.tsx`, and `VoiceReviewSheet.tsx` are ~150 lines of duplicated
   inline-styled chrome using raw hex (`#FAFAF6`, `#B8953A`, `#E05440`, `#1A1A1A`,
   `#666`, `#999`, `#CCC`). Extract one tokenized `<CaptureSheet>` shell on
   `var(--cog-*)`; calm the coral-red (`#E05440`) stop button (the only off-brand
   element — the waveform was already de-coraled in Pass 1).
2. **Extend retain+retry to the layer ("record over this") + file-upload paths.**
   The layer save in canvas and `handleFileUpload` should adopt `pendingUploads`
   too (file-upload is lower risk — the source file still exists on device).
3. **Latency instrumentation.** Add lightweight marks for gesture→record,
   stop→card, tap→playback to confirm the three budgets on a real device.
