# C2 · Capture — Launch-Ready Record

*C2 Capture Agent, 2026-07-08 · Steps 1–10 complete. This is the honest verification record: what is machine-proven, and the short on-device checklist that remains human.*

## The loop, as it ships

Tap the big gold mic → real MediaRecorder (+ optional on-device live STT with the interim ghost) → say "verse / chorus" or tap a rail chip to split → Stop → the take is **already durable on-device** (Capture Outbox: IndexedDB blob + retry job BEFORE any network call) → `intake-voice-memo` (memo + primary take) → Review Sheet opens **already split into editable section blocks** (server transcript merged with rail pins; guaranteed at least one editable block in every outcome) → *Add to canvas* → `commitTakeToCanvas` (D-group) → the quiet gold CommitRibbon → `/songs/:id/canvas?from=capture`. Unfiled hums land on the device-local Seed Ideas shelf and file into a song via `claimSeedIdea`.

## The never-lose-a-take guarantee (machine-verified)

| Threat | Defense | Proof |
|---|---|---|
| Killed tab / crash mid-upload | Blob → IndexedDB + job → localStorage BEFORE network (Step 2) | outbox suite: "caches the blob BEFORE persisting the job" |
| Dropped connection / offline at save | Job retained `queued`; auto-retry on `online` / 20s heartbeat / app load; calm gold "Saved on this device" card, never red | outbox suite offline + failure cases; CaptureScene test: failed attempt → queued card → background sync graduates into review |
| Retry double-create | Stable idempotency key per job (server acceptance filed — C2-BACKEND-SEAMS §3) | outbox suite idempotency case |
| Interruption / 10-min ceiling / page hidden / mid-record unmount | Recorder auto-finalize salvages the take into the same save path | useVoiceRecorder suite (7) |
| Re-render identity churn cancelling a live take (the Step-1 P0) | Unmount-only teardown + the ONE suite that mounts the REAL hooks | `CaptureScene.lifecycle.test.tsx` |
| Typed lyric lost to a reload | sessionStorage-backed pending blocks per song (Step 6) | code-reviewed; cleared only into a review |
| Transcript never returns | Review seeds a manual editable block on failure AND timeout (Step 5) | `ReviewSheet.test.tsx` |

## Verification record

- **Capture lane: 13 test files, 71/71 green** — outbox (10), uploaders incl. the `"intake"` pipeline, pendingUploads, seedIdeaApi (9), stackModel, useVoiceRecorder (7), CaptureScene (4), lifecycle guard (1), ReviewSheet (2), sectionKeywords (9), acousticSplits, rhyme/naming utilities.
- **tsc + eslint clean for every C2-touched file.**
- **Full repo suite: 464/481.** The 17 failures are OTHER lanes' in-flight work (route/onboarding tests, B1 OTP contract, D canvas Feature-04, E4/E2 route guards, F1 catalog hero, Codex mobile smoke) — pre-existing families from the Step-1 baseline, none touching capture. The repo-wide `qa:codex` gate is therefore the FLEET's shared finish line right now, not a capture blocker; C2's slice of it (lint/type/test on capture files) is green.
- **Seams respected end-to-end:** recorder/metronome/waveform = C4 (consumed, never forked — the one-tap metronome now lives in the canvas lane, still on C4's engine); outbox + cog/* = A3 (one additive read fn, annotated); canvas commit = D (payload only); transcript→blocks stops at review (C3); backend contracts filed in `C2-BACKEND-SEAMS.md`.

## The 5-minute on-device checklist (human — real mic + real STT can't run in CI)

1. **Golden moment, timed:** open a song → tap mic → sing, saying "verse … chorus" → Stop → Review opens already split, announcements stripped → Add to canvas → ribbon → canvas pulse. Target ≈20s, ≤2 taps + Stop, one hand.
2. **Airplane mode:** record → Stop → expect the gold "Saved on this device" card + the sync pill → reconnect → it syncs; if you stayed on the scene, review opens by itself.
3. **Kill the tab mid-upload**, reopen: the take syncs on load (outbox sweep); nothing lost.
4. **Interruption:** take a call / yank Bluetooth mid-take → "Saved — the mic was interrupted, but your idea is safe."
5. **Unfiled:** on `/`, hum → "Saved to your Ideas" → catalog shelf → file it into a song.
6. **Reduced motion** (OS setting): ripple/ring/rail/ribbon all calm; recording state is gold/charcoal — never red.

## Open items (filed, not blocking)

Backend seams (`C2-BACKEND-SEAMS.md`): singing-tuned STT + word timestamps + per-word confidence; F13 detection; intake idempotency acceptance; song key/BPM persistence; optional seed sync. Product calls (`C2-CAPTURE-PATHS.md`): audio-less commit; `idea_captures` client retirement (A3). F8 karaoke word-scrub stays backlog.
