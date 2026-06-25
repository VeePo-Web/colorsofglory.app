# Capture Lane — Pass Handoff

Living log for the re-firable `/capture` loop. Newest pass on top. Each pass closes
the worst remaining reliability/latency/UX gap, ships green, and names the next slice.

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
