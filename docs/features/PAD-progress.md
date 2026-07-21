# Pad — One-Tap Ambient Tonal Bed · Progress

## 2026-07-15 (later) — Launch-audit pass

Fresh-eyes audit against the no-failure standard; four findings, all fixed +
covered (see the contract's "Launch-audit fixes"):
1. **Restart-during-fade popped** (critical) — graph-scoped retirement now:
   each stop/dispose retires its graph to fade + free itself; start() builds
   fresh; re-tapping mid-fade swells a new bed over the old tail.
2. **Clipping at higher volumes** (high) — voicing headroom-normalized to a
   ~1.0 summed peak (anchored to the full flavored sum so flavor changes
   never jump the level; unit-tested) + a gentle DynamicsCompressor glue.
3. **start() could throw mid-build** on ancient browsers — now never throws
   (silent teardown; a tap retries), and the toggle hides itself when Web
   Audio doesn't exist.
4. **Silent-but-ON after a phone call / screen lock** — `resumeIfNeeded()` +
   a visibilitychange listener self-heal the suspended context.
8 pad tests green (headroom guarantee added); tsc clean; build green;
capture + canvas suites green.

## 2026-07-15 — Shipped

**What changed**
- NEW `src/lib/audio/pad.ts` — the `AmbientPad` engine (sibling of
  `metronome.ts`, same class shape: construct / async start with
  ctx.resume-in-gesture / stop / dispose). The full lush chain: fifths-stack
  voicing over 3 octaves (no third by default — consonant under major AND
  minor), 3-osc unison detune ±7¢ per voice (saw·tri·saw), per-voice
  breathing LFOs at mutually-detuned rates, stereo spread, LFO-swept lowpass,
  **procedural convolution reverb** (3.5 s stereo decaying smoothed noise
  built directly as an AudioBuffer — zero assets, zero network), an "air"
  layer, 1.5 s/2.5 s master ramps, 0.3 s key glide, crossfaded flavor third.
  Pure helpers exported + unit-tested (`midiToFrequency`, `parsePadKey`,
  `padVoicing`, `clampPadVolume`).
- NEW `src/components/capture/Pad.tsx` — the one-tap toggle ("Pad · G", gold
  when active), ♯ reveal for the 12 key chips + Neutral/Major/Minor flavor +
  a remembered volume slider, the once-dismissible headphones hint, engine
  lifecycle (lazy create in the tap, dispose on unmount — never a runaway).
- Mounted beside the metronome on BOTH surfaces: CaptureScene (not
  phase-gated — the pad deliberately keeps sounding through a take; humming
  over it is the point) and the canvas toolbar next to the F14 toggle
  (`keySignature` now read from `useSongTempo` there).
- Key inheritance: song `key_signature` → F13 detected key → C; the writer's
  chip pick overrides and glides live.

**What was verified**
- 7 unit tests green: all 12 keys voiced procedurally with exact perfect-5th
  and octave ratios + correct tonic pitch classes; the app's key format
  parsed ("G"/"Em"/"F#m", garbage rejected); neutral default keeps the third
  silent; major/minor flavors sit at +16/+15 semitones; stereo pans spread,
  low voices weighted, breath rates distinct; volume clamped to the subtle
  bed range.
- `tsc --noEmit` clean · `vite build` green · capture + canvas suites green.

**Not verifiable in CI (needs ears + a phone)**
- The lushness: listen in several keys, glide between chips mid-drone,
  confirm the fade-in/out never clicks, run Click + Pad together, and leave
  the surface mid-drone to confirm total silence. All tuning constants are
  documented in docs/PAD-CONTRACT.md as the knobs.

**Next candidates**
- A premium bundled IR option (the contract notes procedural is the right v1).
- Octave/voicing presets ("low bed" / "full") if writers ask.
- Sharing one AudioContext with the click transport if context count ever
  matters on low-end devices.
