# Polish — Subtle Music-Safe Audio Enhancement · Progress

## 2026-07-21 (later) — Pass 2: first-listen coverage + forced-failure proof

- Routed the REVIEW players — the first listen after recording now plays
  polished (`ReviewAudioPlayer` + `blob` prop from `ReviewSheet`;
  `VoiceReviewSheet`'s own element). The saved file stays raw.
- `polishAttach` now auto-loads the loudness blob from the device audio
  cache when a caller only has the memo id (take-player gesture retry,
  stack fallback) — leveling applies everywhere, not just blob-in-hand
  sites.
- NEW `enhance.attach.test.ts` (7 green) — the forced-failure ladder is
  now PROVEN in CI: no Web Audio → clean no-op; remote src → never
  attaches; chain-build failure → loudness-only rung, source still
  connected; source failure → dry + retry next tap; suspended context →
  skip, succeed when running; idempotent (one source per element ever);
  downstream connect failure → source hard-wired to destination.
- Canvas voice cards (`canvasAudio.ts`) documented as deliberately dry:
  reused elements + remote-only URLs + the gapless listen-path seam make
  attaching unsafe; no-regression holds by not touching it. Future slice:
  cache-first canvasAudio, then attach.
- Full audio suite 100/100 green · tsc clean · build green.

## 2026-07-21 — Shipped

**What changed**
- NEW `src/lib/audio/enhance.ts` — the shared enhancement bus: the
  music-safe mastering chain (HP 70 Hz → de-mud 300 Hz −2.5 dB → presence
  3.5 kHz +1.5 → air 10 kHz +2.5 → 2.5:1 compressor → 20:1 limiter →
  −1 dBFS master), per-take loudness leveling toward ≈ −16 LUFS (gated
  active-RMS, clamped, silence-proof), the strictly-additive SAFETY LADDER
  (blob-only attach · running-context-only · no dangling sources · every
  step wrapped), the persisted default-ON preference store, the WAV
  encoder, and `renderPolishedWav` offline export.
- Routed players (each a 1–3 line, fire-and-forget `polishAttach` inside
  the play gesture; remote/signed URLs and any failure = exactly today's
  playback): `useStackPlayer` (+ blob stash at prepare for the loudness
  profile), `VoiceMemoListItem`, `useAudioPlayer` (covers its many
  surfaces), `TakeMiniPlayer` (+ gesture retry in playPause).
- NEW `PolishToggle` — the calm "Polished ✨ / Original" pill on the Voice
  memos page (hides itself without Web Audio); flips all live playback
  instantly via the shared store (D1/G2 consume the same store).
- "Share polished demo" in the memo menu — offline render → WAV → share
  sheet (download fallback). Original untouched.
- `docs/POLISH-CONTRACT.md` — chain values, the ladder, the research
  standard, the boundaries.
- UNCHANGED by design: `volumeNormalizer.ts` + `usePracticePlayer`
  (their peak-normalization contract IS the reference behavior; changing
  practice loudness would be a regression risk for zero gain), capture,
  outbox, `waveform_peaks`, F13/Melody Lens inputs.

**Research grounding (the "Adobe" standard)**
- The named bar is Adobe Podcast (Project Shasta). Its transferable
  standard is gain staging + leveling (→ −16 LUFS integrated, −1 dB
  ceiling) — adopted. Its Enhance Speech model is generative re-synthesis
  that Adobe's own FAQ calls "not compatible with singing" and that the
  current version uses to *separate and mute music* — excluded, with
  citations in the contract. Polish is mastering DSP only.

**What was verified**
- `enhance.test.ts` 9/9 green: quiet takes level toward the target; loud
  takes never slammed (floor-clamped); silence untouched; the silence gate
  levels by the sung phrase, not the quiet; peak allowance caps boost;
  chain values locked transparent by test; WAV header/clamping correct;
  preference defaults ON + persists.
- `tsc --noEmit` clean · `vite build` green · full audio suite green.

**Not verifiable in CI (needs ears + a phone)**
- The sound itself: play a cached sung / voice+guitar memo, A/B the pill —
  polished should be clearer/warmer/louder with the guitar fully intact;
  Original must be the exact raw take. On iOS: play from the memo list,
  background the app mid-play, return (self-heal), and confirm signed-URL
  (uncached) playback is bit-identical to before — it never touches the
  bus. Forced failure: block Web Audio (or DevTools-override
  `AudioContext`) and confirm every player behaves exactly as today.

**Next candidates**
- G2 settings row bound to the same store ("Polish my recordings").
- D1 polished-indicator on the canvas voice card (state is ready).
- Mic Check-style pre-capture level hint (the OTHER half of the Adobe
  standard — cheap input-level heuristics before recording).
- Per-take polished export on takes (currently memo-level).
