# F13 — Auto Tempo + Key Detection · Progress

## 2026-07-14 (later) — Launch-audit pass

Fresh-eyes audit of the shipped feature; three findings, all fixed + tested:
1. **Confirm-line honesty bug** — the "Sounds like…" claim followed the LIVE
   mode toggle instead of what the detector heard; now pinned to the detected
   tonic/mode/bpm (mode-aware grid highlight, Use restores detected mode,
   manual-pick verdict compares both). Covered by a dedicated test.
2. **Main-thread manners** — chroma FFT pass now segmented (~10 s slices,
   additive chroma) with macrotask yields, mirroring the Melody Lens's
   off-main-thread discipline without a worker port; tempo runs first + yield.
3. **BPM "detected" tag** now shows for fill-declined suggestions too.
Plus 6 new ChordPicker component tests (silent fallback byte-for-byte,
confirm persists + resolves accepted, honesty-under-toggle, different-key
resolves not-accepted, differs-hint use/dismiss). 71 audio+picker tests green;
tsc + build green; capture/canvas suites green.

## 2026-07-14 — Shipped (safe half: tempo + key, chords excluded)

**What changed**
- NEW `src/lib/audio/tempoKey.ts` — pure on-device DSP: onset-novelty →
  autocorrelation → BPM (octave-folded 60–180, parabolic-interpolated);
  Hann/FFT chroma → Krumhansl–Kessler → {tonic, mode}. Confidence floors
  0.30 (tempo) / 0.42 (key). No ML.
- NEW `src/lib/audio/tempoKeyRunner.ts` — fire-and-forget at finalize:
  detect (10 s timeout) → gate → `fillSongMusicIfEmpty` → suggestion store.
- NEW `src/lib/audio/detectedTempoKeyStore.ts` — device-local suggestion
  metadata (the picker's "detected from your recording" honesty).
- `integrations/cog/songs.ts` — `fillSongMusicIfEmpty` (ATOMIC `.is(null)`
  fill-only-empty writes) + `updateSongKeySignature`; realtime + `useSongTempo`
  now carry `key_signature` (`saveKey`).
- Wired at all three save sites: `saveMemo.ts`, `CaptureScene.handleAudioFile`
  (in-song branch), canvas `handleSaveMemo`.
- `ChordPicker` — the blank "What key is this song in?" becomes a pre-filled
  **"Sounds like G major · 94 BPM — tap to confirm, or change it"** (gold Use
  button, detected key highlighted in the existing grid, gold honesty line);
  dismissible "your take sounds like…" hint beside user-set values; `detected`
  BPM tag; silent fallback renders exactly the old UI. `CaptureSheet` passes
  a `chords` wiring prop; `CaptureScene` builds it (initials from the shared
  song values, dedup-guarded `saveKey`/`saveTempo` persistence, suggestion
  cleared on resolve).

**What was verified** (see contract for detail)
- 18 new unit tests green: synthetic-audio detector cases (clear click
  tracks/tonal beds pass their floors; noise, held tones, rubato-like and
  <4 s takes stay silent; 240 BPM folds; garbage never throws) + runner
  contract (silent-when-unsure, gated fill routing, declined-fill honesty,
  never-throws).
- `tsc --noEmit` clean, `vite build` green, capture + canvas suites green.
- Found + fixed during tuning: LCG test-noise was secretly periodic (real
  0.8 autocorrelation!); normalized autocorrelation needed an absolute
  onset-strength gate or dust reads as tempo; key margin must exclude the
  relative major/minor.

**Not verifiable in CI (needs a phone/browser with real audio)**
- End-to-end: hum a clear demo in a song → open Chords → confirm line shows;
  speak a rambly take → picker unchanged; confirm → metronome + sheet
  inherit. The DSP + gating + fill logic behind each step is unit-covered.

**Next candidates**
- Feed detection through the outbox retry path for takes saved offline
  (currently detection runs at enqueue-time only — offline saves get it,
  since detection is local; only the DB fill waits for connectivity via the
  picker confirm).
- Surface the confirm line in the song-room Chords page (C3) as well as the
  capture picker.
