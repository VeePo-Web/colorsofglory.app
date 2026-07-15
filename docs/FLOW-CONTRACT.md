# Flow — Hands-Free Autoscroll Perform Mode · Contract

**Owner:** F2 (Practice). **Consumes:** C3's lyrics + chords (read-only, via
the practice sections' `chordLines`), F13's `tempo_bpm` (via the practice
state's `bpm`/`bpmFromSong`), transcript timestamps (`TranscriptLine.startMs`).
**Never:** edits lyrics/chords · requires a recording to play · lets the
screen sleep · ships motion without a stepped alternative.

**What Flow is:** a distraction-free full-screen mode where the WHOLE song —
lyrics in big bold Playfair with C3's chord chips above the words — scrolls
continuously at a self-paced rate the performer plays live against. The
physical music stand that turns its own pages. It is NOT KaraokeLyrics (one
line synced to a playing recording) and NOT DriveMode (hands-free playback).

## The "works every time" engine (`src/lib/audio/flowScroll.ts` + `useFlowEngine`)

One unified mechanism: a monotonic piecewise-linear keyframe timeline
(time → scrollTop) advanced by a speed-multiplied rAF clock. The tiers only
differ in how the keyframes are built:

| Tier | Data needed | Keyframes |
|---|---|---|
| 3 — time-synced | every section has a take `durationMs` AND ≥1 section has `transcriptLines` (and no chord sheet for that section — chords are the better visual; timestamps belong to transcript lines) | each timed line reaches the reading line (35% down the viewport) at its real `startMs` (+ accumulated section starts); section boundaries fill the gaps |
| 2 — duration-paced | every section has a take `durationMs` | each section block scrolls past over its own take's duration — the chart finishes when the song does; wordy vs sparse sections pace themselves |
| 1 — constant (ALWAYS) | nothing | two keyframes at `bpmToPixelsPerSecond(bpm)` — `lineHeight·bpm/480` clamped 6–40 px/s (model: a sung line ≈ two bars of 4/4); no bpm → a gentle 12 px/s |

`sanitizeFrames` enforces monotonic y (an out-of-order timestamp becomes a
hold, never a jump back) and tails out to the end of the chart so a missing
final timestamp can't strand the outro. **Honesty rule:** never presented as
"locked to the beat" — it starts at your tempo, gets smarter with the song's
data, and keeps you in control.

**Speed:** a time multiplier (0.5–2.0, ±5% steps) applied uniformly across
tiers, **remembered per song** (`cog-flow-speed:<songId>`) — the second run
is exactly right. Rotation/resize rebuilds keyframes and re-derives the clock
from the current scroll position (continuity, never a jump).

## The control contract (performer always in control)

- **Tap anywhere** = pause ⁄ resume (an elbow works). During the count-in a
  tap starts immediately.
- **Grab & drag** = the clock pauses, the performer repositions, and on
  release (after momentum settles, ~180 ms idle) the clock re-derives itself
  from the new position (`timeAt`, the exact inverse of the scroll mapping)
  and resumes if it was playing. Never trapped; worst case it's a plain
  hand-scrolled chart.
- **Speed nudge** (− % +) live in the header; **Exit Flow** always visible
  when controls are; controls fade after ~2.6 s of performing, any tap
  returns them. A whisper-thin gold **progress ribbon** rides the top edge
  always.
- **Count-in:** three beats at the song's tempo (500–900 ms/beat) behind a
  calm "Flow begins in a breath…" — never startled into motion.
- **Finish:** "That's the song." + From the top (recount-in) + Exit.
- **Space** toggles, **Escape** exits (stand-side laptop safety).

## The invariants

1. **Works every time** — Tier 1 needs only the chart; every tier-build
   failure falls through (3 → 2 → 1 → default), never blocks.
2. **Performer always in control** — tap/drag/nudge as above.
3. **Read-only** — Flow renders the same `ChordLine` component the practice
   chord view uses (one chord renderer, never two) from C3's pre-rendered
   `chordLines`; it never writes.
4. **Never requires a recording** — entering Flow pauses any playing take;
   the scroll clock is its own.
5. **Screen never sleeps** — the practice route's `usePracticeWakeLock` is
   extended to hold for Flow (it already reacquires on tab return).
6. **Reduced motion has a stepped alternative** — `prefers-reduced-motion`
   defaults to **FlowStepped**: one section (or one timed line) at a time,
   advanced by tap or the keys Bluetooth foot pedals send
   (PageDown/ArrowDown/Space/Enter; PageUp/ArrowLeft back), reusing
   KaraokeLyrics for line steps. The header toggle is an explicit override in
   either direction, persisted (`cog-flow-stepped`).
7. **Interruption-safe** — visibility hidden ⇒ pause in place; resume is one
   tap.

## Surfaces

- Entry: the **Waves** button in the practice player header
  (`FullPracticePlayer`, next to Drive Mode) → `FlowPlayer` renders as its
  own full-screen tree in `PracticePlayerExperience` (same pattern as Drive
  Mode).
- `FlowDocument` renders the measurable chart (`[data-flow-section]`,
  `[data-flow-line-ms]`) — section labels as gentle color-chipped dividers
  (`getSectionColor`), fluid type `clamp(1.375rem, 4.6vmin, 2rem)` so it
  reads from a stand in portrait or landscape.
- Empty song (no lyrics/chords/transcripts anywhere): a calm "Nothing to
  Flow yet — add lyrics or chords…" with Exit. Chord-only songs flow their
  chord chart.

## Verification (2026-07-14)

- `flowScroll.test.ts` (11 green): Tier 1 constant/clamped/degenerate; bpm
  mapping + clamps + gentle default; Tier 2 per-section pacing + honest
  decline on a missing duration; Tier 3 merge + monotonicity under
  out-of-order stamps + decline without timed lines; sanitize tail-out;
  `timeAt` inverts `positionAt` exactly (the drag contract); per-song speed
  memory + clamps.
- `tsc --noEmit` clean; `vite build` green; practice-adjacent suites green.
- **Needs a hands-on pass (real browser/phone):** perform a multi-section
  song portrait + landscape, force each tier, toggle reduced-motion, and
  verify wake-lock hold + the grab-resume feel. The engine math and every
  fallback path are unit-covered; the feel is what a phone confirms.
