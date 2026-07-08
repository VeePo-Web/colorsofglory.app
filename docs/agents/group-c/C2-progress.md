# C2 · Capture Agent — Progress Log

## Step 1 of 10 — Capture subsystem audit + punch-list (2026-07-07)

**Outcome:** Punch-list published at [`C2-CAPTURE-PUNCHLIST.md`](./C2-CAPTURE-PUNCHLIST.md) — full flow map (22 stages), seams, ranked gaps, invariant check, and charter corrections. No product code changed (audit-only step; a throwaway mechanism-probe test was created, run, and deleted).

**What was verified (real checks, not reads alone):**
- Full vitest suite baseline: 284/291 green; all 7 failures outside the capture lane (QueryClient harness issue in ChordsPage/SongCanvasPage smoke tests — flagged to C3/D/Codex).
- Capture-lane suites: 8 files, **53/53 green** (outbox, uploaders, pendingUploads, seedIdeaApi, stackModel, useVoiceRecorder, CaptureScene, rhyme-suggest).
- **P0 discovered and empirically proven:** `CaptureScene.tsx:93-98` keys its cleanup (`cancelRecording` + `live.stop`) on `[recorder, live]`, and both hooks return fresh object identities every render — so the cleanup fires on every re-render, killing/discarding a live take the moment recording starts, and its `setState` re-triggers itself in an unbounded update loop. Proven by a 2/2-green mechanism probe (identity churn + survival-without-cleanup control) plus two hung full-scene mounts with the real hooks; CI is blind because `CaptureScene.test.tsx` mocks both hooks as stable singletons.
- P0 #2 confirmed: the main CaptureScene save path calls `submitSharedAudio` directly, bypassing the Capture Outbox (C4 concurrently landed `saveMemoDurable` + a seam note in `cog/intake.ts` addressed to C2 for exactly this).

**Charter corrections logged:** ReviewSheet needs no supabase eviction; Seed-Ideas claim/file is already built + tested; the legacy `idea_captures` client path is dead (zero UI callers — GlobalCaptureFlow uses `seedIdeaApi`); routing is capture-first beyond spec (bare `/songs/:id` → capture).

**Cross-lane handoffs:** C4/A3 — Step 2 will wire the capture save through the outbox via a registered `"intake"` uploader / `saveMemoDurable` (async review-open needed); A3 — 4 raw-supabase evictions listed; A3/Lovable — cog/transcript (word timestamps + confidence) and cog/analysis (F13) seams; B2/C1 — `?first=1` still undecided; C3/D/Codex — non-capture test failures.

**Note for every later step:** other agent sessions were actively editing the repo during this audit (A1/A2/A3/A5/C4 sweeps, ~140 dirty files). Re-read files before editing; re-run the capture-lane suites before and after each change.

**Next:** Step 2 — complete the sacred promise (route every capture save through the outbox). First action should be (or be preceded by) the P0-1 one-liner fix, since no take survives the tap flow until the cleanup effect is unmount-only.

## Step 2 of 10 — The sacred promise: every save through the outbox (2026-07-08)

**Outcome:** the main capture save path is durable-FIRST. `CaptureScene.handleAudioFile` no longer calls `submitSharedAudio` directly — it enqueues through `enqueueCaptureUpload` with a new registered `"intake"` uploader (same `intake-voice-memo` edge fn, so zero backend change), then settles on that job's outbox event: success → resolve primary take (`getPrimaryTakeIdForMemo` with lag tolerance) → Review Sheet; failure → a calm gold "Saved on this device" card (`QueuedTakeNotice`, `role=status`, never red) with "Sync now", auto-retry continuing underneath — and if a background retry succeeds while the scene is open, the take graduates straight into review. `ImportMemoButton` flows through the same path. The raw `takes.select("storage_path")` read was replaced with A3's `getTakeWithTranscript` (one Step-9 eviction done early). Belt-and-braces kept: recorder auto-finalize, the in-memory `FailedTakeNotice` + durable `failedCaptureStore` (now only guarding pre-enqueue failures), and the unfiled Seed-Ideas path (already durable-first).

**Notes on concurrent work:** P0-1 (the recording-killing cleanup) was already fixed by a parallel session before Step 2 began (unmount-only teardown ref) — I added the missing regression coverage instead: `CaptureScene.lifecycle.test.tsx` mounts the scene with the REAL hooks (browser APIs shimmed) and proves a live recording survives re-renders; this is the one suite where real identity churn meets the component, so the old bug can't ship silently again. The parallel session also rerouted unfiled captures to Seed Ideas (superseding the auto-create-song behavior in the charter) — preserved as-is.

**Verified:** 18/18 green — `CaptureScene.test.tsx` (mic-start ordering ×2, outbox routing asserts `uploaderKey: "intake"` + `submitSharedAudio` never called directly, failed-attempt → queued card → background-sync graduation), `CaptureScene.lifecycle.test.tsx` (P0 regression), `captureUploaders.test.ts` (memos + new intake pipeline), `captureOutbox.test.ts` (all 10, untouched and green — retain-on-fail/offline/orphan/idempotency).

**Seam notes:** `intake-voice-memo` does not yet accept the outbox's stable idempotency key, so a retry after a lost success *response* could double-create a memo (upload itself never duplicates thanks to the outbox's in-flight guard). Filed for A3/Lovable in the backend-seams doc (Step 4). `resolveTakeId` deliberately never re-uploads when the take row lags — it toasts "It'll appear in Latest."

**Next:** Step 3 — the record moment (header fade during recording, reduced-motion guards, stale JSDoc).

## Step 3 of 10 — The record moment (2026-07-08)

**Outcome:** "the waveform IS the screen" is now real — the header fades to nothing (opacity-only, `aria-hidden`, pointer-events off) while a take is live or stopping, on top of the parallel session's `navLocked` disabling; the only visible controls during recording are the timer, the waveform ring, Stop, and the side rail (a core capture tool, kept by design, as is the live transcript). Reduced-motion guards added to CommitRibbon's rise (SideRail's cascade guard had just been added by the parallel session — verified, not duplicated). The stale Phase-1 JSDoc (hold-to-hum / idea_captures) was replaced with the real current loop. Confirmed held: tap-only (hold props remain deprecated no-ops), commitment-only Stop, gold/charcoal live state (the red-vs-gold Visual-Brief discrepancy stays documented in the punch-list §4 — not reverted), BigMic ripple/ring already reduced-motion-safe, mic label steers splitting.

## Step 4 of 10 — Live transcription + spoken-section splitting (2026-07-08)

**Outcome:** the splitting brain is now spec-locked by unit tests, and the backend seams are formally filed. `src/test/capture/sectionKeywords.test.ts` (twin session started it; C2 added the missing load-bearing case) now covers: empty input, single keyword, spoken ordinals, two-token "pre chorus" beating "chorus", ordinal backfill, manual-pin-wins-±400ms, the implicit Idea head block, marker-word stripping, and **leading-filler absorption** ("okay this is the chorus" → marker owns the fillers, body starts after the trigger, no filler leaks into any block). Verified no code path fabricates transcript text: no-STT → ListeningPulse + server transcript; explicit failure → manual editing with calm copy. Published [`C2-BACKEND-SEAMS.md`](./C2-BACKEND-SEAMS.md) filing to A3/Lovable: singing-tuned STT + real word timestamps + per-word confidence (flag, never guess), F13 `cog/analysis` (editable-never-authoritative prefills), `intake-voice-memo` idempotency key (closes the double-create-on-lost-response window opened by retries), song-level key/BPM persistence target, optional `seed_ideas` sync.

**Verified:** 14/14 green (sectionKeywords ×9, CaptureScene ×4 incl. Step-3 header fade, lifecycle guard ×1).

**Next:** Step 5 — ReviewSheet timeout dead-end.
