# Pad — One-Tap Ambient Tonal Bed · Contract

**Owner:** C4 (`src/lib/audio/pad.ts` engine, `src/components/capture/Pad.tsx`
toggle). **Mounted by:** C2 (capture scene, beside the MetronomeBar) and D2
(canvas toolbar, beside the F14 metronome toggle). **Consumes:** the song's
`key_signature` (via `useSongTempo`) → else F13's detected key
(`detectedTempoKeyStore`) → else C; `keys.ts` (`pitchClass`, `MAJOR_KEYS`,
`Mode`); A1 tokens.

**What it is:** tap once and a soft, evolving, worshipful drone fills the room
in your song's key — a tonal floor a hummed melody leans on so it stays in
key (which also makes cleaner input for Say-It-Structured, Melody Lens, and
F13). Tap again and it fades away. Click keeps you in time; **Pad keeps you
in key.** It creates NOTHING about the song.

## The synthesis chain (tuned values)

| Stage | Value |
|---|---|
| Voicing | root + P5 stacked: +0, +7, +12, +19, +24 semitones from tonic-at-octave-2 (~65–330 Hz), gains 1.0/0.75/0.7/0.5/0.34 — NO third by default (consonant under major AND minor). Optional third voice (+16 major / +15 minor, gain 0.42) crossfades in only when flavored. |
| Unison | 3 osc per voice: saw −7¢ · triangle 0¢ · saw +7¢, each ⅓ trim |
| Width | StereoPanner per voice: 0 / −0.55 / +0.55 / −0.3 / +0.3 / +0.12 |
| Breath | per-voice gain LFO, rates 0.09–0.19 Hz (unique per voice → phases drift), depth 16 % of voice gain |
| Filter | lowpass 1800 Hz, Q 0.5; cutoff LFO 0.07 Hz × ±450 Hz |
| Reverb | ConvolverNode, **procedural IR**: 3.5 s stereo decaying noise, one-pole-smoothed (warm tail), decay `(1−t)^2.2` — built directly as an AudioBuffer, zero assets, zero network. Wet 0.85 / dry 0.5 |
| Air | looped noise → highpass 4 kHz → gain 0.012 |
| Headroom | voice gains normalized so the summed bed peaks ≈ 1.0 — against the FULL flavored sum, so choosing a flavor never jumps the level and the mix can never clip into harshness |
| Glue | DynamicsCompressor before master: threshold −20 dB, knee 20, ratio 2.5, attack 0.15 s, release 0.4 s — the reverb build-up breathes instead of stacking into peaks |
| Master | attack 1.5 s / release 2.5 s exponential ramps (never a click); default volume 0.25, clamped 0.05–0.5, remembered (`cog-pad-volume`) |
| Glide | key change: `setTargetAtTime` τ = 0.1 s (~0.3 s settle) per oscillator; flavor third crossfades over ~0.2 s |
| CPU | 18 tone osc + 6 breath LFOs + 1 filter LFO + 1 shared convolver + 1 compressor — fine for mobile |

## The API (mirrors the Metronome class)

```ts
new AmbientPad({ tonic?, flavor?, volume? })
  .start()   // async; creates + resumes the AudioContext INSIDE the tap
  .stop()    // 2.5 s fade, then the graph is released (restartable)
  .dispose() // 0.25 s fast fade + closes the context — never a runaway drone
  .setKey(tonic, flavor?)  // glide — a swell, never a jump
  .setVolume(v)
// pure + unit-tested: midiToFrequency · parsePadKey("Em") · padVoicing · clampPadVolume
```

## The UX

One gold pill — **"Pad · G"** — beside the metronome; tap on/off. The ♯
button reveals the 12 key chips (`MAJOR_KEYS` spellings — every key
procedural), the Neutral/Major/Minor flavor (neutral default), and a small
volume slider. The key follows the song until the writer picks a chip
(their choice then wins). A once-dismissible "Sounds best with headphones"
hint appears on first activation (`cog-pad-headphones-hint`).

## Invariants

1. **Creates nothing about the song** — accompaniment only, never persisted,
   real-time controllable; worst case: tap off, nothing lost.
2. **Every key, zero assets, zero network** — all frequencies + the reverb IR
   are procedural.
3. **Never a runaway drone** — the toggle disposes on unmount (fast fade +
   context close); stop() releases the graph after the fade.
4. **Never clicks or jars** — ramped on/off, glided key changes, smoothed
   volume.
5. **Sibling, not fork** — mirrors the Metronome class + toggle patterns;
   the metronome itself is untouched. Both can run together (Click + Pad).
6. **Bleed is a guided choice here** (deliberate divergence from the click's
   never-bleed rule): the pad keeps sounding while recording because humming
   over it is the point; its harmonics are in-key (reinforcing F13), and the
   headphones hint is the honest guidance. Turn it off first for a dry take.

## Launch-audit fixes (2026-07-15, same day)

1. **Restart-during-fade pop (critical, "never clicks"):** re-tapping the pad
   ON while the old bed was still fading tore its graph down instantly — an
   audible cut. The lifecycle is now GRAPH-SCOPED: stop()/dispose() retire
   the current graph, which fades and frees itself on its own timer; every
   start() builds a fresh graph. A new bed simply swells over the old one's
   tail; no shared teardown timer can ever kill the wrong graph.
2. **Clipping at volume (high, "lush not fizzy"):** the raw voice sum (~3.5×)
   could push the wash past 0 dBFS at higher volumes. Voicing is now
   headroom-normalized (unit-tested) and a gentle compressor glues the mix.
3. **start() can no longer throw** — a failed node build (ancient browser)
   tears down silently; worst case is silence, one tap retries. The toggle
   also hides itself entirely when Web Audio doesn't exist (never a dead
   control).
4. **Interruption self-heal:** after a phone call / screen lock, iOS leaves
   the context suspended while the toggle shows ON. `resumeIfNeeded()` +
   a visibilitychange listener nudge it back to life on return.

## Verification (2026-07-15)

- `pad.test.ts` (7 green): A440/octave math; key-format parsing incl. `F#m`
  and garbage; **all 12 keys** voiced with exact P5/octave ratios and correct
  tonic pitch class; neutral third silent by default; +16/+15 flavored
  thirds; stereo spread + weighted gains + distinct breath rates; volume
  clamps.
- `tsc --noEmit` clean · `vite build` green · capture/canvas suites green.
- **Needs a listening pass (real browser/phone):** the lushness itself —
  several keys, the glide, the fade-in/out, both-with-metronome, and
  dispose-on-leave silence. The graph and math behind each are code-verified;
  the beauty is what ears confirm, and the tuning constants above are the
  knobs.
