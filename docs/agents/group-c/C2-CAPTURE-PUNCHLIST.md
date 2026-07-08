# C2 · Capture Punch-List (Step 1 audit — locked)

**Audited:** 2026-07-07, 00:40–01:00 EDT · **Auditor:** C2 Capture Agent (Fable 5)
**Baseline:** full suite 284/291 tests green (38/40 files; the 7 failures are OUTSIDE the capture lane — see §6). Capture-lane suites 8/8 files, **53/53 green**.

> ⚠️ **Concurrent-session caveat.** Other agents were actively sweeping the repo DURING this audit (~140 files changed mid-session): A1 token sweep touched every capture component (styling only — verified by diff), A5 moved routes into `src/routes/`, A2 landed `src/types/`, A3 landed `docs/DATA-ACCESS-MAP.md`, and **C4 landed `src/lib/voice/saveMemo.ts` (`saveMemoDurable`) plus a seam note in `cog/intake.ts` addressed to C2**. Every claim below was verified against the working tree in this window. **Re-verify file state at the start of every C2 step.**

---

## 1. Flow map (stage → status)

| # | Stage | File(s) | Status |
|---|---|---|---|
| 1 | Routes | `src/routes/songRoutes.tsx:33-43` (A5) | **REAL.** `/`, `/capture`, `/songs/:id`, `/songs/:id/capture` ALL land on CapturePage — capture-first is even stronger than the charter said (bare `/songs/:id` → capture). |
| 2 | CapturePage (55) | `src/pages/CapturePage.tsx` | **REAL.** Gaps: raw `supabase.from("songs").select("title")` (→ A3 evict); no `?first=1` handling. |
| 3 | CaptureScene (812) | `src/components/capture/CaptureScene.tsx` | **REAL glue — with the P0 defect (§3.1)** and the outbox bypass (§3.2). Raw `takes` reads ×2 (lines ~131, ~297). `pendingBlocks`/`manualMarkers` volatile (§3.4). Stale header JSDoc (mentions hold-to-hum + idea_captures — both obsolete). |
| 4 | BigMic | `BigMic.tsx` | **REAL.** Tap-only ✓ (hold props are documented deprecated no-ops). Amplitude ring off real AnalyserNode RMS ✓. Reduced-motion → static ring ✓. Label: "Tap to stop · say 'Verse' or 'Chorus' to split" ✓. Gold/charcoal ✓. |
| 5 | Recorder engine (C4) | `src/hooks/useVoiceRecorder.ts` | **REAL, hardened — consume only.** 10-min ceiling auto-SAVES; interruption salvage (`track.onended`); page-hidden/pagehide salvage; empty-blob guard; double-tap guard; iOS AudioContext gesture resume; framed-preview diagnosis; no-timeslice rationale. 7/7 tests. |
| 6 | Live STT | `src/hooks/useLiveTranscript.ts` | **REAL** Web Speech; finalized words + interim ghost; self-restart on `onend`; `supported:false` calm fallback; synthetic even word timing (documented). |
| 7 | LiveTranscript UI | `LiveTranscript.tsx` | **REAL.** ListeningPulse covers no-live-STT platforms (iOS Safari); reduced-motion fallback ✓. `onWordTap` plumbing EXISTS but is not passed by CaptureScene (F8 karaoke scrub = backlog, confirmed). |
| 8 | Section detection | `src/lib/capture/sectionKeywords.ts`, `transcriptModel.ts` | **REAL.** Longer-phrases-first; ordinals parsed + verse backfill; LEADING_FILLERS absorbed via `contentStartMs`; manual pins win ±400ms; unlabeled "Idea" head block. **No unit tests** (→ Step 10). |
| 9 | Acoustic splits | `src/lib/capture/acousticSplits.ts` | REAL + tested (`src/test/capture/acousticSplits.test.ts`) but **DORMANT — zero production callers**. Candidate Step 4 enhancement (silence splits complement keyword splits). |
| 10 | SideRail | `SideRail.tsx` | **REAL.** 5 chips; mid-record tap = timestamped pin, no modal ✓ (section → manual marker; others → PendingBlock); idle tap → CaptureSheet. Entrance animation has no reduced-motion guard (P3). |
| 11 | Save path | `CaptureScene.handleAudioFile` → `cog/intake.submitSharedAudio` → `getPrimaryTakeIdForMemo` | **REAL but bypasses the outbox (§3.2).** No-songId → `createSong` "New idea · <date> · <time>" + "Started a new song" toast ✓. In-memory `failedTake` retry card ("your recording is safe") ✓. Auto-finalized takes flow through the same path with reason-specific toasts ✓. |
| 12 | ReviewSheet (439) | `ReviewSheet.tsx` | **REAL.** Polls transcribe-take 1.2s/45s; merges AI + pending blocks sorted by `start_ms`; edit kind/label/text/reorder/merge-up/delete; ReviewAudioPlayer (signed URL, best-effort); 402/429 → calm toasts. **Gap: timeout dead-end (§3.3).** All data reads go through `cog/transcript`/`cog/takes` — **no raw supabase here (charter correction §5.1)**. |
| 13 | Commit | `cog/canvas.commitTakeToCanvas` (D-group) | **REAL.** Filters text/section blocks; `song_limit_reached`/402 → toast + `/upgrade`; `onCommitted` → CommitRibbon → `/songs/:id/canvas?from=capture`. Requires `take_id` (see §3.5). |
| 14 | CommitRibbon (78) | `CommitRibbon.tsx` | **REAL.** Quiet gold pill, auto-dismiss 3.5s. No reduced-motion guard on rise animation (P3). |
| 15 | CaptureSheet (289) | `CaptureSheet.tsx` | **REAL.** 5 verbs with charter copy verbatim ✓; Lyrics = syllable mirror + "Find rhymes" → RhymeSchemer; Scripture → ScripturePicker (+ typed fallback); Chords → ChordPicker (+ "Type freeform instead"). Gaps: §3.4 (volatility), §3.5 (no audio-less commit), key/BPM persistence unwired (§3.7). |
| 16 | ChordPicker (493) | `ChordPicker.tsx` | **REAL manual entry.** First-run key prompt; KeyPicker; BPM 20–300 (16px anti-zoom); TapTempo (30–300, haptic); inline Metronome synced to BPM; Letters⇄Numbers; diatonic + borrowed; QualityEditor (quality/extension/slash); label "Chords · Gm · 92 BPM" ✓. F13 audio-detection NOT wired (seam, §3.7). |
| 17 | Metronome seam | `Metronome.tsx` (UI) + `src/lib/audio/metronome.ts` (engine) | **CONSUMES C4's engine — no fork ✓.** Chord-entry only; structurally cannot run while recording (recording rail taps never open sheets), so metronome-bleed into a take is impossible on this surface. |
| 18 | ImportMemoButton | `ImportMemoButton.tsx` | **REAL.** 50MB cap mirrors intake; duration probe; feeds the same `handleAudioFile` (inherits §3.2). |
| 19 | LatestPeekStrip | `LatestPeekStrip.tsx` | **REAL.** Raw `supabase.from("voice_memos")…songs,takes` + `auth.getUser` (→ A3 evict). Resume reopens ReviewSheet ✓. |
| 20 | Global/unfiled path | `GlobalCaptureFlow` → `useGlobalCapture` → `CaptureShell` → `SeedReviewSheet` → `seedIdeaApi` → `SeedIdeasShelf`/`SeedIdeaCard` (on SongCatalogPage) | **REAL and MORE complete than the charter believed:** `claimSeedIdea` (file-into-song via voiceApi) is BUILT + WIRED + 9/9 tests. Seeds are device-local (localStorage + IndexedDB) — not synced across devices (product note). FAB effectively retired on nearly all routes (BottomNav mic owns it). `OutboxSyncPill` rides app-wide ✓. `CaptureShell` exposes Cancel (decide: does commitment-only apply to the global shell? §3.11). |
| 21 | Legacy idea_captures | `cog/capture.ts` (quickCapture / listMyUnfiledCaptures / promoteCapture) | **DEAD CLIENT PATH — zero UI callers** (grep-verified; only cache-key refs). Superseded by seedIdeaApi. `promote-capture` edge fn still exists server-side. Reconcile in Step 8 (§3.9). |
| 22 | Capture Outbox | `src/lib/voice/captureOutbox.ts` (+10-case suite), `captureUploaders.ts`, NEW `saveMemo.ts` (C4) | **REAL.** Durable-first (IndexedDB before network); stable idempotency key; retain-on-fail; retry on `online`/20s heartbeat/app-load; orphan safety; pluggable uploader registry (`voiceApi` default; `memos` registered — brainstorm-era, likely vestigial since BrainstormPage was deleted → verify in Step 2). Active on VoiceLayerPanel + `saveMemoDurable`. **NOT active on the CaptureScene main path (§3.2).** |

## 2. Seams (respect these)

- **C4 (consume, never fork):** `useVoiceRecorder`; `src/lib/audio/*` incl. `metronome.ts` engine + NEW `waveformPeaks.ts`; NEW **`saveMemoDurable`** (`src/lib/voice/saveMemo.ts`) — "THE canonical save for every C4 voice surface"; `VoiceReviewSheet`/`RecordingWaveform`/`CaptureSheetShell`/`CaptureStopButton`.
- **A3 (route data through cog/*):** evictions listed in §3.6. Backend seams to file, not build: `cog/transcript` singing-tuned STT + real word timestamps + per-word confidence; `cog/analysis` (F13 key/BPM/chord detection); optional seed-ideas server sync.
- **D-group:** `commitTakeToCanvas` payload + `canvas?from=capture` arrival pulse. Future F19 round-trip (`capture_id` / `section_card_ids[]`) — coordinate, don't build.
- **C3:** transcript→blocks hand-off stops at the ReviewSheet.
- **A5:** capture routes live in `src/routes/songRoutes.tsx`; `GlobalCaptureFlow` mounts at app root.
- **A1:** token sweep observed mid-audit (CaptureScene inline `rgba(184,149,58,…)` → `var(--cog-gold-aXX)`, styling-only). `--cog-record-red: #E05440` exists in `tokens.css` as "the ONLY red" — capture correctly does not use it.
- **B2/C1:** `?first=1` first-visit handling on the capture landing — absent everywhere in capture (grep-verified); decide in Step 8.

## 3. Gaps (ranked)

### P0
1. **The big-mic recording self-destructs on the first re-render.** `CaptureScene.tsx:93-98` keys a cleanup effect on `[recorder, live]`; BOTH hooks return a fresh object literal every render (`useVoiceRecorder.ts` final return; `useLiveTranscript.ts` final return). React therefore re-runs the cleanup — `recorder.cancelRecording(); live.stop();` — on EVERY re-render, and re-renders are guaranteed the moment recording starts (phase transitions + the 100ms duration ticker). `cancelRecording` nulls the MediaRecorder handlers before stopping → the blob is DISCARDED, and its unconditional `setState` re-triggers the cleanup in an unbounded update loop.
   **Evidence:** (a) mechanism probe (2/2 green): both hook identities change per render, AND a live recording survives the same re-renders when no dep-keyed cleanup exists; (b) two full-scene mounts with the REAL hooks hung vitest indefinitely (the update loop starving the event loop); (c) `CaptureScene.test.tsx` passes only because it mocks both hooks as STABLE SINGLETONS — deps never change, so CI is blind to this. Git history: the effect has had object deps since the file's creation; the Jun-29 "fix capture mic recording start" commit fixed a different bug (STT ordering) and left this.
   **Fix (one-liner class, Step 3 — or first action of Step 2):** make the cleanup unmount-only (`[]` deps, calling through refs), and add a regression test that mounts CaptureScene with the real hooks (browser APIs shimmed).
2. **The main save path bypasses the sacred-promise outbox.** `CaptureScene.tsx:~121` calls `submitSharedAudio()` directly (ImportMemoButton inherits this); the only net is the in-memory `failedTake` card — a killed tab/reload strands the take. C4's fresh seam note in `cog/intake.ts` says exactly this and points at `saveMemoDurable` / a registered `"intake"` uploader. **Step 2 design notes:** the outbox default uploader speaks the voiceApi pipeline while CaptureScene needs the intake pipeline (memo + primary take), so register an `"intake"` uploader (or extend `saveMemoDurable`); success is now ASYNC → resolve take id via `getPrimaryTakeIdForMemo` on the outbox `success` event and open the ReviewSheet then; keep the `failedTake` card + recorder auto-finalize as belt-and-braces; verify whether the vestigial `"memos"` uploader registration should be retired.

### P1
3. **ReviewSheet timeout dead-end.** The guaranteed "at least one editable block" only fires on explicit `transcript_status === "failed"`. On a 45s poll TIMEOUT (status never terminal) with no pending blocks, the sheet shows zero blocks and says "Tap a side-rail tool to add one" — but the rail is BEHIND the open sheet. Violates "never a dead end" (→ Step 5: seed the manual Idea block on any non-ready outcome; fix the copy).
4. **Typed fragments are volatile.** `pendingBlocks` + `manualMarkers` live only in component state — a refresh/navigation loses typed lyrics/chords/scripture pins. The never-lose promise currently covers audio only (→ Step 6: persist lightweight to storage, or explicitly scope-accept and document).
5. **Text-only capture cannot reach the song.** ReviewSheet commit requires `take_id` (`commitTakeToCanvas` contract), so CaptureSheet fragments saved while idle wait in memory until a recording happens ("N notes ready · record a take to review"). Tension with the north star "ANY fragment goes DIRECTLY into the song's room" (→ Step 6/8 product decision: audio-less commit path, or accept + make the copy honest).
6. **Raw supabase evictions (→ A3, Step 9):** `CapturePage` (songs.title), `CaptureScene` ×2 (takes), `LatestPeekStrip` (voice_memos + auth). Grep-verified as the complete set in the capture lane.
7. **`?first=1` unhandled** on the capture landing (→ Step 8 with B2/C1).

### P2
8. **F13 detection seam** not wired (no `cog/analysis`); additionally ChordPicker's `onKeyChange`/`onBpmChange` are not passed by CaptureSheet, so key/BPM set during capture never persists to the song (→ Step 7; file the seam with "editable, never silently authoritative" + "low confidence — tap to confirm").
9. **F8 karaoke word-scrub** — `LiveTranscript.onWordTap` plumbing exists, unwired; ReviewSheet has no word-level view. Backlog per charter (→ note only).
10. **No tests** for `sectionKeywords`/`buildTranscriptBlocks`; `acousticSplits` dormant (→ Steps 4/10).
11. **Low-confidence flagging absent** — transcript payload carries no per-word confidence; UI can't flag. Backend seam (cog/transcript) first (→ Step 4 files it).
12. **Three-pipeline reconcile (→ Step 8):** in-song intake→take→canvas ✓ · unfiled seed ideas (device-local seedIdeaApi) ✓ · legacy `idea_captures` client path DEAD (zero UI callers). Decide: retire `cog/capture.ts` client fns (keep `promote-capture` server-side?), and whether seed ideas should sync via a `seed_ideas` table (Lovable seam).

### P3 (polish)
13. Recording takeover incomplete — the header (Songs pill / room chip / Settings) stays visible while recording; charter says "no header, no nav — the waveform IS the screen" (→ Step 3: fade header like the prompt; rail + live transcript STAY, they're core capture tools).
14. Reduced-motion guards missing on SideRail entrance, CommitRibbon rise, prompt fade (BigMic/LiveTranscript/Metronome/RhymeSchemer already honor it).
15. Stale CaptureScene header JSDoc ("hold-to-hum", "idea_captures via the existing SDK").
16. `CaptureShell` (global FAB surface) exposes Cancel — decide whether commitment-only Stop extends to the global shell (big-mic scene itself is correctly Stop-only; post-failure Discard is an explicit user choice and fine).
17. `FailedTakeNotice` uses rust `#b54a30`-family tones — acceptable (destructive/error context), noted for the record.

## 4. Invariant check

| Invariant | Verdict |
|---|---|
| Single front door | **HELD** for routes (stronger than spec); **partial** for typed-only fragments (§3.5). |
| Tap-only recording | **HELD.** Hold props are deprecated no-ops with the orphan-risk rationale in place. |
| Waveform IS the screen | **PARTIAL** — prompt fades, but the header remains during recording (§3.13). |
| Commitment-only Stop | **HELD** on the big-mic scene. Global CaptureShell has Cancel (decision item §3.16). |
| Gold/charcoal, never red | **HELD.** Live state is gold; `--cog-record-red` token exists but capture doesn't use it. **Brief discrepancy documented here — do NOT revert to coral (#E05440); red stays reserved for destructive/error.** |
| The take is never lost | **BROKEN on this surface today** — first by P0-1 (the take never survives the tap flow), then by P0-2 (no durable outbox on the main path). Recorder-level salvage + canvas-layer outbox + `saveMemoDurable` are all in place to fix against. |
| Real transcription, no stubs | **HELD.** No code path fabricates transcript text; no-STT → manual editing; failure copy is calm. The one hole is the timeout dead-end (§3.3). |
| Prefills editable, never authoritative | N/A yet (F13 unwired); ReviewSheet blocks fully editable ✓. |
| Consume, don't fork | **HELD.** Recorder, metronome engine, nashville/keys, rhymeSuggest, scripture, commitTakeToCanvas — all consumed, none forked. |

## 5. Charter corrections (audit vs. the C2 system prompt)

1. ReviewSheet needs **no** raw-supabase eviction — its reads already go through `cog/transcript`/`cog/takes` (A3's layer). The eviction set is CapturePage, CaptureScene ×2, LatestPeekStrip.
2. The Seed-Ideas claim/file wiring is **already built and tested** (SeedIdeasShelf on the catalog → SeedIdeaCard picker → `claimSeedIdea`), not open work. What remains is reconcile/polish (§3.12) — including that seeds are device-local.
3. GlobalCaptureFlow does **not** use `cog/capture.ts`/`idea_captures` — it uses `seedIdeaApi`. The `idea_captures` client path is dead code.
4. Routing is capture-first beyond the charter: bare `/songs/:id` also lands on CapturePage.
5. NEW since the charter was written (landed mid-audit): `saveMemoDurable` (C4) + the C2-addressed seam note in `cog/intake.ts` — Step 2's "useMemoSave collapse" now has its primitive.

## 6. Baselines & evidence

- Full suite: 38/40 files, 284/291 tests green. The 7 failures are in `codex-mobile-render.test.tsx` + `feature04-canvas.test.tsx` — "No QueryClient set" when rendering ChordsPage/SongCanvasPage fallbacks via `useSongTitle` (test-harness/provider issue in C3/D territory, likely A-sweep fallout; flagged, not C2's).
- Capture lane: `captureOutbox` (10) · `captureUploaders` (1) · `pendingUploads` (9) · `seedIdeaApi` (9) · `stackModel` · `useVoiceRecorder` (7) · `CaptureScene` (2) · `rhyme-suggest` — **53/53 green**.
- P0-1 mechanism probe: 2/2 green (identity-churn proof + survival-without-cleanup control); probe file removed after the run — recreate as a shipping regression test when the fix lands (Step 2/3).
