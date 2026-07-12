# MELODY LENS — Melody Waveforms + Hum-to-Find (C4-lead contract)

**Status:** v1.0 shipped. Two sibling features, one engine: a pitch **contour** is
computed once at capture and both features fall out of it — the shape you *see*
(Feature 1) is the index you *search* (Feature 2).

**Lanes:** C4 owns the engine + voice surfaces + the search UI. D1's canvas voice
cards consume the render helper. A3/Lovable own the two DB columns + the optional
server backfill. Capture never depends on pitch.

---

## 1. The engine — `src/lib/audio/pitchContour.ts`

Self-contained **YIN** (difference function → CMNDF → parabolic interpolation),
restricted to the vocal band (80–1000 Hz). No external DSP dependency; runs in the
same decode the capture pipeline already does.

**Pipeline (all pure, all unit-tested):**
`extractPitchTrack(pcm, sr)` → per-frame `{f0Hz, confidence}` (2048-sample window,
512 hop) → `cleanPitchTrack` (confidence-gate → median filter → **octave-continuity
repair** → short-gap interpolation) → the two persisted shapes:

- **`pitchContour: number[]`** — 96 points of RELATIVE pitch in the take's own range
  (0 = lowest, 1 = highest); `-1` (`UNVOICED`) marks silence. Cards downsample via
  `resampleContour(contour, barCount)`.
- **`melodyKey: number[]`** — the search fingerprint: note-onset pitches as **semitone
  intervals from the first note** (key-invariant), silence-trimmed. **Empty when the
  take has no real melodic range** (spoken word ranks itself out — a shape, not a lie).
  `toParsons(melodyKey)` gives the U/D/R fallback.

**Browser wrapper:** `computePitchContour(blob)` — decode + offline biquad band-pass +
the pure pipeline. **Returns `null` on ANY failure** (the invariant: capture saves
whether or not pitch succeeds).

### Contract tunables (documented so a reviewer can retune without spelunking)
YIN threshold 0.14 · silence RMS 0.01 · confidence gate 0.45 · 96 contour points ·
note step 0.8 semitones held ≥3 frames · min sung range 2 semitones.

## 2. Persistence — device-first, off the capture critical path

The **schema ask (filed with A3/Lovable):** add nullable `pitch_contour: number[]`
and `melody_key: number[]` beside `voice_memos.waveform_peaks`, and a one-time
server backfill edge fn (re-decode stored audio → compute → persist) for
cross-device coverage. Until then the contour is **device-local + lazy-backfilled**.

**`src/lib/audio/contourStore.ts`** is the persistence layer (localStorage
`cog:melody-contours`, LRU-capped at 300, ~700 B/entry):
- `writeContour` at capture (keyed to the outbox id) → `renameContour` to the real
  memo id on outbox success (mirrors the audio-cache rename).
- `resolveContour(memoId, server?)` — **server value wins** the moment the columns
  land; the store is the offline cache + the pre-column home. Every consumer already
  calls this, so no consumer changes when the columns arrive.
- `listMelodyKeys()` — Hum-to-Find's on-device index.

**Capture is durability-first and NEVER freezes (fixes the review's MAJOR):**
`saveMemoDurable` computes the cheap peaks, **enqueues the durable upload
(blob safe + optimistic card returned), THEN** kicks off the contour off the main
thread — `computePitchContour` runs the YIN in a **Web Worker**
(`pitchContour.worker.ts`, synchronous fallback + 8 s watchdog) and `void`-writes the
result to the store. So a capture is instant, the blob is durable before any pitch
work, and the analysis (billions of FP ops for a long take) never blocks the UI. The
analyzed span is capped at 60 s (`MAX_ANALYZE_SECONDS`) to bound worker time + the
band-pass buffer memory on long imports.

**Cross-device today:** a new memo's melody waveform shows on other devices on first
play (lazy backfill), amplitude until then. Full at-capture server persistence is a
Lovable follow-up once the columns + finalize/backfill land.

**Known limitation (MINOR):** the store key is not user-namespaced (matching the
app's existing device caches, e.g. `audioCache`) and isn't cleared on logout — no
functional leak (every consumer filters to the current user's own memo ids), a
defense-in-depth follow-up.

## 3. Render — `resolveWaveformBars` (the one helper, strict precedence)

`src/lib/canvas/waveformSeed.ts` → `resolveWaveformBars({seedId, peaks, contour,
barCount, maxHeight})` → `{ mode, bars: [{height, top, voiced, amp}] }`:

1. **contour present → melody waveform**: amplitude bars (height from peaks) whose
   `top` rides the tune — high pitch sits high in the box. Loudness AND shape at once.
2. **peaks only → real amplitude** (bottom-aligned) — fixes the flagged fake-waveform bug.
3. **neither → `generateWaveform(seed)`** — the id-seeded fake survives ONLY as the
   legacy-null fallback so a card is never blank.

**Adopted by EVERY memo-waveform surface** (launch-audit sweep — no surface shows the
fake while another shows the melody): D1's `VoiceMemoCard` + `HumCard` (canvas), C4's
`VoiceMemoListItem`, `VoiceMemosPage` MemoCard, the Hum-to-Find thumbnails, `MemoStack`
(the stack's base row — the primary take's contour; this also fixed a pre-existing bug
where `toStackView` dropped `waveform_peaks` entirely and the base rendered a fabricated
id-seeded shape), and `TakeMiniPlayer` (the primary take rides the memo's tune; layer
takes show their own true amplitude). Static; unvoiced bars render dimmed. `aria-hidden`
— the shape is decorative; the card keeps its normal label. The only motion is the
canvas playback shimmer (`cog-wave-play`), disabled under `prefers-reduced-motion` by
CanvasStage's global rule.

## 4. Hum-to-Find — `src/lib/audio/melodySearch.ts`

`searchMelodies(queryKey, index, {limit})` → ranked `{memoId, distance, score}`.
- **Subsequence DTW** over step-to-step deltas of the melody keys: free start row
  (match any window → hum the chorus, memo opens with a verse), tempo absorbed by
  warping, key-invariant by construction. Brute force over dozens of short sequences
  is sub-millisecond; **>300 memos → Parsons edit-distance prefilter → DTW top-60**.
- `score = 1/(1 + avgPerStepDrift)`, normalized by query length. `hasStrongMatch` gates
  the confident-#1 vs the honest "no close match" state. `MIN_QUERY_NOTES` 3,
  `MIN_LIBRARY` 8, `STRONG_MATCH` 0.55. 9 unit tests (key/tempo/subsequence/out-of-tune/
  no-match/large-scale).

**UI (`HumToFindSheet.tsx`, opt-in):** a "Hum to find a melody" pill on the voice page
→ tap the mic (reuses `useVoiceRecorder`, tap-not-hold, gold-not-red) → same pitch
pipeline → ranked shortlist, each row a **melody thumbnail** + title. Honest states:
tiny library, too-short hum, no-strong-match → recent melodies. The hum is never
uploaded; the index is only this user's own memos.

## 5. Backfill — `src/lib/audio/melodyBackfill.ts` (lazy, on-device)

`backfillOnOpen(memoId)` fires when a memo is played (its audio is fetched anyway):
resolve the blob (audio cache → signed URL), compute the contour, persist it. De-duped
per session, best-effort, never disturbs playback. Coverage grows as the library gets
browsed. **Optional A3/Lovable ask:** a one-time edge-function backfill for full
coverage without waiting on browsing.

## 6. Invariants (never break)
1. **A shape, not notation** — never presented as accurate notes; can't mislead.
2. **Capture survives a pitch failure** — `computePitchContour` returns null, the save
   proceeds with peaks. Verified by forcing the pitch step to throw.
3. **Compute once, persist, render cheap** — pitch is computed at capture (or lazy
   backfill), never at render.
4. **On-device, offline, private** — no network for compute or search; the hum stays local.
5. **C4 computes, D1 renders** — C4 hands the contour + `resolveWaveformBars`; the
   schema is Lovable's.
