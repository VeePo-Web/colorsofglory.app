# Capture — Ideal-Customer Friction Fire (2026-07-04)

Lane: **Capture only** (recorder, voice-memo cards, capture sheets, Ideas shelf,
take lifecycle). Not canvas tree / lyric editor / collaboration / onboarding / admin.

Method: walk the app as the ideal songwriter, find friction, fix the highest-leverage
one, verify (`tsc` + vitest), ship straight to `main` on VeePo-Web. Each fix also
pushed to its own `capture/*` safety branch.

## Shipped this fire

1. **`6f2122b` — a captured idea can become a new song.** The Ideas picker led with
   a dead-end ("Start a song first") for a brand-new writer with ideas but no songs.
   It now leads with **"+ Start a new song from this idea"** (`createSong` named after
   the idea → `claimSeedIdea` into it), with "or file into a song" when songs exist.

2. **`5badac3` — the "Unfiled" pill is a real doorway.** It was a static `<div>`
   styled identically to the interactive "Open room" button (fake affordance). Now a
   button → opens the catalog / Ideas shelf.

3. **`f7b1d1a` — live "Unfiled · N" count.** Global captures land in *local* Ideas,
   which the DB-only peek strip can't see, so a hum left no trace on the page it was
   captured from. The pill now carries a live gold count that ticks up the instant a
   hum saves (record OR import). Best-effort; never blocks capture.

4. **`480c2c0` — no more save-to-nowhere text tools on the song-less page.** Every
   side-rail tool (lyrics/chords/section/scripture/idea) writes to a song's canvas via
   `commitTakeToCanvas`, which the global page has no song to reach. Typing there said
   "Saved" then lost it on reload. The rail now guides the writer into a real song.

Verification: `tsc --noEmit` exit 0 each; `vitest run src/lib/voice src/lib/capture`
= **45/45 green**.

## The vision — best-possible capture UX (mobile Safari, Apple-grade)

**Global page (`/`)** = instant, thumb-first *voice* capture. One tap → recording in
<400ms → hum lands in Ideas with a time-of-day name → "Unfiled · N" ticks up. Zero
forms before the idea is safe. This is the sacred fast path; keep it pristine.

**Ideas shelf** = the "one idea, two homes" hub. Hear / rename / discard / file into a
song / start a new song from it. Every idea has a home and an exit.

**In-song capture (`/songs/:id/capture`)** = the full studio: voice + the side-rail
tools (lyrics, chords, sections, scripture, ideas) that commit to the song's canvas.
This is where the side features should be polished next — they *work* here.

## Next initiative (needs coordination — NOT a pure in-lane fire)

**Text ideas need a home.** Today a *typed* lyric/note idea can only persist by being
committed to a song's canvas alongside a recorded take (`commitTakeToCanvas`, a
**canvas-lane** API). There is no capture-lane way to persist a text-only idea to the
Ideas shelf or to add a text note to a song. To give typed ideas true "two homes"
parity with voice hums, the Ideas model (`seedIdeaApi`) must gain a `kind: "text"`
record **and** a claim path — which requires either a canvas/lyric-lane API to write a
text block into a song, or an agreed contract with that lane. Until then, the
song-less page correctly routes text intent into a song (fix #4).

## Remaining in-lane friction candidates (future fires)

- **Recording-branch pins on the global page** are now blocked by the same guard
  (good), but audit the in-song recording pins for the same "does it actually land"
  rigor.
- **New user tapping a text tool → "Open songs" → empty catalog.** Consider a smarter
  toast action that lands them in the new-song flow directly.
- **In-song side-rail visual polish** (Apple-grade sheets, 16px inputs already done) —
  audit `CaptureSheet`, `ChordPicker`, `ScripturePicker` spacing/motion in-song.
