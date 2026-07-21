# Polish — Subtle Music-Safe Audio Enhancement · Contract

**Owner:** C4 (`src/lib/audio/enhance.ts` engine,
`src/components/voice/PolishToggle.tsx`). **Routed players:**
`useStackPlayer`, `VoiceMemoListItem`, `useAudioPlayer` (covers every
surface that plays via it), `TakeMiniPlayer`. **Untouched by design:**
`usePracticePlayer` (it already has its own Web Audio graph + peak
normalization — changing its loudness semantics would be a regression risk
for zero gain), `volumeNormalizer.ts` (kept EXACTLY as-is: it is the
practice player's contract and the reference "today behavior"), capture,
the outbox, `waveform_peaks`.

**What it is:** every voice memo played through COG can sound clearer,
warmer, and more even — like a real demo — via a transparent mastering
chain: gentle EQ + gentle compression + loudness leveling + a peak limiter.
One tap ("Polished ✨ / Original") flips all live playback to the untouched
take, instantly. On-device, zero network, non-destructive, and **strictly
additive** — in every failure state the app behaves exactly as it did
before this feature existed.

## The research standard (what "Adobe-quality" actually means)

The bar the user named ("Adobe's recording app") is **Adobe Podcast**
(formerly Project Shasta): Enhance Speech v2 + Mic Check. Two findings
shaped this feature:

1. **Its leveling, not its AI, is the transferable standard.** Adobe's
   pipeline is AGC-style leveling + normalization; podcast/music platforms
   target −14…−16 LUFS integrated with a −1 dBTP ceiling. Polish adopts
   **≈ −16 LUFS integrated (gated active-RMS approximation), −1 dBFS
   ceiling** — the single biggest "sounds pro" win for quiet phone takes.
2. **Its enhancement model is disqualifying for music.** Enhance Speech is
   generative re-synthesis (HiFi-GAN lineage) trained on talking voice;
   Adobe's own FAQ states it "is not compatible with singing," community
   threads document robotic voice/warble/hallucinated syllables, and the
   2025+ version architecturally *separates music as background* to mute
   it. On a hum or voice+guitar it strips the instrument and misrepresents
   the performance — a no-failure violation. **Polish is therefore
   mastering DSP only: no speech isolation, no denoise-by-default, no
   re-synthesis, ever.**

## The music-safe chain (`POLISH_CHAIN` — the knobs)

| Stage | Value | Why |
|---|---|---|
| High-pass | 70 Hz, Q 0.707 | rumble/handling; low enough to keep guitar body |
| De-mud | peaking 300 Hz, −2.5 dB, Q 1 | phone-mic boxiness |
| Presence | peaking 3.5 kHz, +1.5 dB, Q 1 | clarity, conservative (sibilance) |
| Air | high-shelf 10 kHz, +2.5 dB | openness |
| Compressor | −24 dB thr · 2.5:1 · knee 30 · 15 ms att · 200 ms rel | even, never squashed |
| Limiter | −2 dB thr · 20:1 · knee 0 · 3 ms att · 100 ms rel | peak guard |
| Master | ×0.89 | ≈ −1 dBFS ceiling |
| Loudness makeup | per-take gain toward RMS 0.158 (≈ −16 LUFS) | the "sounds pro" win |

Loudness profile (`computeLoudnessGain`, unit-tested): 400 ms blocks, −60 dB
silence gate (a mostly-quiet take levels by its sung phrase, not its
silence), clamp 0.5–8×, and a pre-limiter peak allowance (gain × peak ≤
1.4) so peaks approach the limiter gently. Silence (< 0.01 peak) is left
untouched. Cached per memo; computed from the take's blob off-thread via
`OfflineAudioContext` (the volumeNormalizer decode pattern).

**Tier-2 denoise:** deliberately NOT shipped. RNNoise-style processing is
speech-trained and the risk/benefit is wrong for a music-first app; if it
ever ships it must be off-by-default, ~30–50 % wet, and behind an explicit
per-take choice. Filed as a possible future slice, not a default.

## The strictly-additive safety ladder

```
full chain → loudness-gain-only (chain build failed) → dry (exactly today)
```

Silence through `createMediaElementSource` is impossible by construction:

1. **`blob:` sources only.** Cross-origin media through a media-element
   source outputs SILENCE (not an exception) — so remote/signed-URL
   playback is never attached and keeps today's plain-element path. Cached
   playback (audioCache blobs — the common case) gets polish; coverage
   grows as the cache warms.
2. **Running context only.** Attach resumes the context inside the tap
   (bounded 250 ms); if it won't run, the element stays dry this play and
   retries next tap. An element wired into a suspended context would be
   silent — so we never wire one.
3. **No dangling sources.** Once a source node exists, any downstream
   failure hard-wires it straight to the destination.
4. **The reuse guard (launch-audit find).** A media-element source is
   PERMANENT — an already-attached element that later loads a REMOTE src
   (cache evicted; the take player switching to an uncached take) would
   play silence. The two element-reusing players (`TakeMiniPlayer`,
   `VoiceMemoListItem`) check `isPolishAttached(el)` and fetch uncached
   sources to a blob first (which also warms the cache the prefetch was
   about to warm). Fresh-element players (`useAudioPlayer`,
   `useStackPlayer`) are safe by construction.
5. Everything is wrapped; every failure logs nothing to the UI and lands on
   a rung that is exactly today's behavior or better. `polishAttach` never
   throws and is idempotent per element.
6. iOS interruption self-heal: `visibilitychange` resumes a suspended bus
   (the Pad lesson).

## The A/B model

`isPolishEnabled` / `setPolishEnabled` / `subscribePolish` — a persisted
(`cog-polish-enabled`, default ON) external store. The pill
(`PolishToggle`, hidden when Web Audio doesn't exist) re-routes every live
bus entry instantly: polished = chain + per-take loudness gain; original =
unity gain straight to destination — the untouched take. D1 consumes the
same store for the canvas voice card; G2's settings screen can bind
"Polish my recordings" to it directly.

## Export

`renderPolishedWav(memoId, blob)` renders the SAME chain + loudness offline
(`OfflineAudioContext`) → 16-bit WAV. Wired as **"Share polished demo"** in
the memo menu (share sheet, download fallback). The original file is never
overwritten; a failed render ends quietly.

## Analysis boundary

F13 (tempo/key), Melody Lens (pitch contour), and waveform peaks all read
the ORIGINAL blob — none of their call paths route through the bus (the bus
only exists between an `<audio>` element and the speakers). Transcription
also currently uses the original; it MAY adopt the polished render later.

## Invariants

1. **Strictly additive** — any failure = today's exact behavior; the save
   path never depends on Polish; no player's error handling changed.
2. **Music-safe** — mastering DSP only; the chain-values test
   (`enhance.test.ts`) fails if anyone cranks the knobs past transparent.
3. **Non-destructive** — original blob is the single source of truth;
   export is a new file.
4. **Instant A/B** — one tap, mid-play, all surfaces.
5. **On-device** — zero network, zero cloud, zero new dependencies.
