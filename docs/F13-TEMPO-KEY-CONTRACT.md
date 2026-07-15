# F13 — Auto Tempo + Key Detection · Contract

**Scope:** the SAFE half of F13 — tempo (BPM) + key only. **Chords are
deliberately excluded** (a stream that can misrepresent; tempo/key are single,
one-tap-correctable values). No schema change; `songs.tempo_bpm` and
`songs.key_signature` already exist.

**The feature in one line:** record your demo, and the metronome already knows
your tempo and the sheet is already in your key — one calm tap to confirm, and
a silent step-aside when it's unsure.

---

## The detector (C4 · `src/lib/audio/tempoKey.ts`)

Pure DSP over `Float32Array` (unit-testable without WebAudio);
`detectTempoKeyFromBlob(blob)` is the browser wrapper (decode via
`OfflineAudioContext`, the volumeNormalizer/pitchContour pattern). Analysis is
capped at 60 s and decimated to ~11.025 kHz. **No ML models.**

```ts
detectTempoKey(samples, sampleRate): {
  tempo: { bpm: number; confidence: number } | null;   // bpm ∈ [60, 180]
  key:   { tonic: string; mode: "major"|"minor"; confidence: number } | null;
}
formatKeySignature(tonic, mode)  // the app's stored format: "G" / "Em"
```

**Tempo:** frame log-energy (512-sample window, 128 hop) → half-wave-rectified
novelty, sharpened against a slow moving average → mean-removed
autocorrelation over the 60–180 BPM lag range → parabolic peak interpolation →
octave-fold with candidates {τ/2, τ, τ·2} and a small bonus for 84–152 BPM.
Guards: takes under **4 s** return null; a novelty peak under **0.25**
(no real onsets: held pads, slow swells, steady noise, speech) returns null —
normalized autocorrelation is scale-invariant, so without the absolute gate,
periodic *dust* reads as a confident tempo (found and fixed in testing).

**Key:** Hann-windowed 2048-point FFT frames (hop 1024) → 12-bin chroma
(55–2200 Hz, bins > 40 cents off a semitone skipped, √-magnitude compression)
→ Pearson correlation against the 24 rotated **Krumhansl–Kessler** profiles.
The confidence margin is measured against the best **non-relative** runner-up:
the relative major/minor shares the pitch set and is the spec's accepted
one-toggle ambiguity, not a wrong answer.

**Confidence floors (the magic-or-silent line):**

| Constant | Value | Meaning |
|---|---|---|
| `TEMPO_CONFIDENCE_FLOOR` | 0.30 | `r(τ*)·1.6 · min(1, span/8s)` — click tracks land ≥ 0.5; noise/rubato < 0.15 |
| `KEY_CONFIDENCE_FLOOR` | 0.42 | `min(1, margin·3.5) · min(1, r₁·1.6)` — clear beds land ≥ 0.5; atonal < 0.2 |

Tuned against the synthetic suite in `tempoKey.test.ts` (click tracks at
92/120/240, C-major/A-minor/G-major beds, mulberry32 noise, held tones, short
clips). Below the floor → **no suggestion, no "we couldn't tell"** — the
manual flow is byte-for-byte today's.

---

## The pipeline (`src/lib/audio/tempoKeyRunner.ts`)

`maybeDetectSongTempoKey(blob, songId)` — fire-and-forget, called AFTER the
take is durably queued at all three save sites:

- `src/lib/voice/saveMemo.ts` (song-room voice surfaces, beside the Melody
  Lens contour pass),
- `src/components/capture/CaptureScene.tsx` (in-song captures, after the
  outbox enqueue — the sacred promise is already kept),
- `src/components/canvas/SongCanvasExperience.tsx` (canvas takes + layers).

Sequence: detect (10 s timeout-raced) → confidence-gate → **fill only EMPTY
song fields** via `fillSongMusicIfEmpty` → record the suggestion in
`detectedTempoKeyStore` (device-local metadata for the picker's honesty UX).
Global captures (no songId) skip entirely. Every failure path ends in
"detected nothing" — **the save can never block or fail on detection.**

## Persistence (A3 · `integrations/cog/songs.ts`)

- `fillSongMusicIfEmpty(songId, { tempo_bpm?, key_signature? })` — each field
  written with an **atomic** `.update(...).is(column, null)` guard: a
  user-set value cannot be overwritten even if it lands between read and
  write. Returns which fields were actually filled. RLS/offline failures
  resolve as "not filled" — the suggestion still surfaces in the picker.
- `updateSongKeySignature(songId, key)` — the explicit-user-action write
  (mirror of `updateSongTempo`). `useSongTempo` now exposes
  `keySignature`/`saveKey` and streams `key_signature` on the song-tempo
  realtime channel.

## The UX (C2 · `ChordPicker` + `CaptureSheet` + `CaptureScene`)

- **Confirm, not ask:** when a confident detection exists and the field was
  empty (or detection just filled it), the picker's blank *"What key is this
  song in?"* becomes **"Sounds like G major · 94 BPM — tap to confirm, or
  change it"** with a gold `Use …` button, the detected key pre-highlighted
  in the existing key grid, and a calm gold *"Detected from your recording —
  every part of it is editable"* line. One tap persists via the existing
  `onKeyChange`/`onBpmChange`; tapping any other key IS the correction UI.
- **Never overwrite:** when the songwriter already set a key/tempo and the
  take sounds different, a **dismissible** hint row appears beside their
  values — "Your take sounds like A minor · 88 BPM. [Use it] [✕]" — never a
  replacement. Dismiss clears the suggestion; their value was never touched.
- **Silent fallback:** no confident detection → exactly today's manual
  prompt. The feature is invisible unless it is confident and helpful.
- The pre-filled BPM carries a tiny gold `detected` tag until confirmed.
- Resolution (confirm/use/dismiss/manual change) clears the device-local
  suggestion — from then on the values are simply the songwriter's.
- Reduced-motion: nothing animates; a11y: the confirm and dismiss controls
  are labeled buttons, ≥44 px.

## Consumers (inherit for free)

Once `tempo_bpm`/`key_signature` are set, the metronome (capture click,
canvas F14 toggle, practice player — all on the shared `useSongTempo`/engine)
and the sheet's key + transpose (C3 `sheetState`) read them with **zero extra
steps**. Capture's MetronomeBar seeds from the shared tempo already.

## Invariants (never break these)

1. **Pre-fill, never auto-commit** — detection fills only *empty* fields; the
   picker presents it as a suggestion; the user's confirm/edit is the
   explicit decision.
2. **Never overwrite a user value** — atomic `.is(null)` guard + hint-only UX
   beside existing values.
3. **Silent when unsure** — sub-floor confidence produces nothing at all.
4. **Never block the save** — fire-and-forget, timeout-raced, every path
   caught.
5. **Single values, not a stream** — tempo + key only; **no chord
   detection.**

## Verification (2026-07-14)

- `tempoKey.test.ts` (14): 120/92 BPM click tracks within ±3 confidently;
  240 BPM folds into range; noise/held-tone/short-clip silent; C major,
  A minor, G major beds detected above floor; silence/garbage safe.
- `tempoKeyRunner.test.ts` (4): sub-floor → no fill + no suggestion; only
  confident values routed to the fill seam; declined fill still yields the
  suggestion (honestly `filled=false`); no-song/detector-crash → nothing,
  never a throw.
- `tsc --noEmit` clean · `vite build` green · capture + canvas suites green.
- **Needs an on-device pass (real audio in the running app):** a sung/played
  demo pre-filling the picker, a spoken take staying silent, and the
  metronome/sheet inheriting after confirm.
