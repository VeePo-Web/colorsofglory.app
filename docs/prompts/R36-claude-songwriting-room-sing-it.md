# R36 — Songwriting Room: "Sing it"

## The one goal
The song has to leave the screen and come out of a mouth. Right now the room is
built for editing; the moment a writer actually wants to *sing* it — phone on a
stand, guitar in hand, band in the room — the editing UI is in the way.

## Backend ready
- RPC `song_performance_view(_song_id)` → one JSON payload: title, key, tempo,
  time signature, and every section in order with its lines + chords.
  Member-gated, one round trip.
- SDK `src/integrations/cog/perform.ts`:
  `fetchPerformView`, `cachedPerformView` (localStorage, instant paint),
  `estimateSectionSeconds`, `totalPerformSeconds`.

## UI — build exactly this, nothing more

### 1. Entry
One control only: a small "Sing it" text button in the lyric sheet header
(charcoal, 0.875rem). No icon soup, no menu nesting.

### 2. The screen
Full-bleed cream, the signature bottom glow, no nav bars, no tab bar.
- Song title in serif at the very top, 1.5rem, then a single muted line:
  `Key of G · 76 bpm` (omit either if unset).
- Sections stacked: label in serif 1.25rem, `--cog-warm-gray`, then lines at
  **1.5rem / line-height 1.7** charcoal. Chord chips sit above their line in
  `--cog-gold-pale`.
- Generous 32px between sections. Nothing else on the screen.

### 3. Three gestures, no buttons
- **Tap** anywhere: toggle autoscroll on/off. When on, scroll advances at
  `totalPerformSeconds(view)` pacing with `requestAnimationFrame` (never
  `setInterval`), and a 2px gold hairline creeps across the top as the clock.
- **Swipe down from the top**: exit back to the sheet, slide-to-right transition.
- **Long-press**: cycle text size across three steps (1.25 / 1.5 / 1.875rem),
  persisted in localStorage per user. No settings panel.

### 4. Stay awake
Request `navigator.wakeLock` on entry, release on exit. Fail silently if
unsupported — never surface an error about it.

### 5. Chords toggle
A single word in the top-right, `Chords` / `Words only`, toggling chord chips.
Persisted. That is the only affordance visible.

## Performance
- Paint from `cachedPerformView(songId)` synchronously on mount, then refresh in
  the background and diff-in silently. No spinner ever appears in Sing it.
- Prefetch `fetchPerformView` when the lyric sheet mounts, so the tap into
  Sing it is instant.
- Render with plain divs — no virtualization, no motion on the lyric lines
  themselves (autoscroll must stay perfectly smooth on a mid-range phone).

## Anti-patterns (forbidden)
- Editing anything in Sing it. It is read-only, always.
- Toolbars, transport bars, metronome UI, count-ins, or a settings sheet.
- Dark mode, teleprompter mirroring, or a "presentation" second screen.
