# MELODY LENS — build progress ledger

Charter: 2 features, 1 engine, C4-lead. Contract: `docs/MELODY-LENS-CONTRACT.md`.

| Feature | What | Status | Notes |
|---|---|---|---|
| Engine | `pitchContour.ts` — self-contained YIN + cleanup + `melody_key` | ✅ | Charter claimed pitchfinder/pitchy libs — none installed; built a dependency-free YIN instead (difference fn → CMNDF → parabolic interp). 14 unit tests on synthesized sung/spoken/silent/noise PCM: tracks tone within cents, repairs octave jumps, key-invariant melody_key, spoken→no melody_key, silence→null. |
| A · persist | contourStore + saveMemo/outbox/finalize/voiceApi/memos thread | ✅ | Best-effort throughout (Promise.all with peaks; null on failure = save proceeds). Device-local store is the pre-column home; `resolveContour` prefers server the moment Lovable lands the columns. Contour renames outbox→memo id on sync. **Schema filed for A3/Lovable** (contract §2). |
| A · render | `resolveWaveformBars` precedence (contour→peaks→seed) | ✅ | Adopted on D1's VoiceMemoCard + HumCard (canvas), C4's VoiceMemoListItem + VoiceMemosPage MemoCard + Hum-to-Find thumbnails. Bars ride the tune via `top`; unvoiced dimmed; fake `generateWaveform` now legacy-null only. Canvas board hydrate now selects `waveform_peaks` + resolves the contour so cards show real melodies. |
| B · match | `melodySearch.ts` — subsequence DTW over deltas | ✅ | Key-invariant (intervals + deltas), tempo-invariant (DTW warp), subsequence (free start row), Parsons prefilter >300. 9 tests incl. transpose +5, note-doubled tempo, embedded tail, out-of-tune, honest no-match, 500-memo <200ms. |
| B · UI + backfill | `HumToFindSheet` + `melodyBackfill` (lazy on play) | ✅ | Opt-in pill on the voice page; tap-mic hum → same pipeline → ranked shortlist w/ melody thumbnails. Honest tiny-library / too-short / no-strong-match states. Lazy backfill indexes legacy memos on play (best-effort, de-duped, off the play path). Reduced-motion honored; dialog focus/trap/return; hum never uploaded. |

## Adversarial review (post-build) — all findings addressed
Two-invariant confirmation: all 4 hold; the flagged finalize-BLOCKER is NOT real
(edge fn destructures only known fields — verified). DSP checked clean (YIN CMNDF,
octave repair can't oscillate, subsequence-DTW swap has no alias bug).
- **MAJOR (fixed):** the whole-recording YIN ran synchronously on the main thread AND
  was awaited before the durable enqueue → multi-second freeze + a non-durable window
  (a tab-kill mid-freeze could lose the take). Fix: capture is now durability-first
  (enqueue → optimistic card → THEN pitch), and the YIN runs in a **Web Worker**
  (`pitchContour.worker.ts`, sync fallback + 8s watchdog, `void` fire-and-forget).
  Analyzed span capped at 60s (bounds worker time + the band-pass buffer on imports).
- **MINOR (fixed):** monotone take now renders a mid-band line (was pinned to floor);
  render clamps the contour to [0,1] (defensive for future server values);
  backfill records `done` only after a *definitive* outcome (a transient fetch miss
  retries) and is `resolveContour`-aware (won't re-decode server-carried memos);
  Hum-to-Find distinguishes "too few memos" from "play a few to index them";
  MemoCard bars memoized (no rebuild on playback ticks); sheet honors reduced-motion.
- **MINOR (documented):** contourStore isn't user-namespaced (matches the app's
  existing device caches; no functional leak) — a defense-in-depth follow-up.
- Removed the now-unfed pitch_contour/melody_key finalize plumbing (capture no longer
  produces it synchronously; device store is the home) to keep the diff honest.

**Verification:** tsc + eslint clean; 23 new unit tests (14 pitch + 9 search) green;
full suite 686/694 (same 8 pre-existing other-lane failures); production build green
(worker bundles); 390px browser E2E 9/9 re-run after the worker refactor (real
WebAudio pipeline, render precedence, save-survives-pitch-failure, DTW); canvas
screenshot (soaring vs flat memo).

**Handoffs open:** A3/Lovable — the two nullable columns + finalize persistence +
(optional) a server backfill edge fn. Everything works device-local until then.

## Launch "zero-fail" audit (post-review) — every spec edge case re-verified in code
Verified against the shipped code, not memory. All Feature-1 §2.3 + Feature-2 §3.2 edge
cases confirmed handled. Cleared as NOT-real after reading the code: the Hum-to-Find
double-analyze race (the recorder's `onstop` resolves the awaited `stopRecording()` OR
calls `onAutoFinalize` via the `resolveStopRef` guard — never both, so a tap-stop
analyzes exactly once); reduced-motion on the melody bars (the only animation is the
canvas `cog-wave-play`, already disabled by CanvasStage's global reduced-motion rule;
list surfaces have no bar animation); the <1s / short-PCM path (< one window → 0 frames
→ null → amplitude fallback, no crash).

**Fixed (the one real gap — the §2.3 "layered takes/stacks" edge case):** `MemoStack`
and `TakeMiniPlayer` still rendered flat amplitude/seed while the list + canvas rode the
tune. Both now use `resolveWaveformBars` with the primary take's contour. This also
closed a **pre-existing bug**: `toStackView` dropped `waveform_peaks` entirely, so the
canvas-opened stack's base card rendered a *fabricated* id-seeded waveform — it now
carries the real peaks + contour. tsc + eslint clean; 686/694 (same 8 pre-existing);
build green.
