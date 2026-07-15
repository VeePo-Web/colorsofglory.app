# Flow — Hands-Free Autoscroll Perform Mode · Progress

## 2026-07-14 — Shipped

**What changed**
- NEW `src/lib/audio/flowScroll.ts` (F2-owned, practiceTypes folder-exception)
  — the pure keyframe engine: one monotonic time→scrollTop mapping fed by
  three tiers (timed lines → take durations → tempo/default constant), with
  `positionAt`/`timeAt` (exact inverses — the drag contract), sanitize
  (monotonic + tail-out), `bpmToPixelsPerSecond`, and per-song speed memory.
- NEW `src/components/practice/useFlowEngine.ts` — measurement (section
  blocks + timed lines via data attributes), tier resolution with graceful
  fallback, the rAF clock (frame-capped so a hung frame never teleports),
  grab/drag/tap semantics with momentum settle, count-in, interruption pause,
  rotation rebuild with clock continuity.
- NEW `src/components/practice/FlowDocument.tsx` — the whole song as one
  measurable chart: color-chipped section dividers, big fluid Playfair,
  C3's chords via the SAME `ChordLine` renderer (now exported from
  ChordScroll — one chord renderer, never two).
- NEW `src/components/practice/FlowStepped.tsx` — the reduced-motion
  alternative: one section/timed-line per step, tap or pedal keys to advance,
  KaraokeLyrics reused for line steps.
- NEW `src/components/practice/FlowPlayer.tsx` — the shell: Exit, speed −%+,
  stepped toggle (persisted; reduced-motion defaults stepped), progress
  ribbon, count-in overlay, finished overlay ("From the top"), paused hint,
  fade-away controls, Space/Escape keys, `.cog-glow` cream stage.
- `PracticePlayerExperience` — `flowMode` render branch (same pattern as
  Drive Mode) + the route wake lock now also holds during Flow;
  `FullPracticePlayer` — the Waves entry button beside Drive Mode.
- Entering Flow pauses any playing take (self-paced perform, not playback).

**Bonus F2 charter gaps closed by Flow:** chords are now in a scroll surface
(FlowDocument), and the wake lock covers the new mode.

**What was verified**
- 11 unit tests green on the engine math (all three tiers incl. honest
  declines, monotonicity under out-of-order timestamps, tail-out, the
  drag-inverse contract, bpm mapping clamps, per-song speed memory).
- `tsc --noEmit` clean · `vite build` green · practice/capture/audio suites
  green.

**Not verifiable in CI (needs a phone/browser)**
- The performed feel: portrait + landscape legibility from a stand, the
  grab-resume momentum settle, wake-lock hold through a full song, forcing
  each tier on a real song, reduced-motion toggle. The math and fallbacks
  behind each are unit-covered.

**Next candidates**
- Per-section speed shaping for Tier 1 (wordy vs sparse) — the spec's noted
  stretch.
- A Flow entry on the song sheet page (C3 surface — coordinate first).
- Volume-key advance in stepped mode on Android (media-key capture).
