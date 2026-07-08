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
