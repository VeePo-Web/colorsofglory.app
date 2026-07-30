# R29 — A or B (Compare Mode)

**Goal:** two takes of the same chorus exist. The writer should be able to hear both
back to back and pick the keeper in one screen — no file names, no menus, no deleting.

## Backend (done — Lovable)

- `song_compare_takes(_song_id, _section_id?)` → `{ takes: [...] }` — every live take with
  name, duration, waveform peaks, author (name + avatar colour), `is_primary`, and its section.
  One request; pair with the existing batch signed-URL helper for playback.
- `choose_take(_take_id, _set_aside_take_id?)` → makes the chosen take the keeper for its memo,
  clears the previous keeper, optionally archives the loser, logs `take_chosen`, bumps the song.
- SDK: `src/integrations/cog/compare.ts` — `fetchCompareTakes`, `chooseTake`, `comparablePairs`.

## UI to build (Claude)

**Entry:** on the Voice board, when a section has more than one take, a quiet gold line appears
on the section header: `2 takes · Compare`. Nothing else changes. No badge counts.

**Compare screen** (full-height sheet, not a page):
- Section name in serif at the top. Below it, exactly two stacked cards: **A** and **B**.
- Each card: take name, author dot, duration, gold waveform, a big circular play button.
- Playing A pauses B automatically. Never two audio sources at once.
- A single `Loop` toggle at the bottom loops the currently playing take.
- If there are more than two takes, the two most recent are loaded into A and B, and a small
  row of chips underneath swaps any other take into the B slot. Never a list picker.

**Deciding:** one gold CTA under each card: **Keep this one**. Tapping it calls
`chooseTake(winner, loser)`, the losing card slides out (`--dur-slow`, `--cog-ease-reveal`),
the winning card centres and gets the gold `Keeper` chip. Toast: "Take 3 is the keeper."
with Undo (calls `chooseTake` back the other way, un-archiving in the process).

**Rules**
- Viewers get the compare screen read-only — playback yes, CTAs hidden.
- Nothing is ever deleted here; "set aside" means archived and still reachable from the takes drawer.
- Preload both audio blobs before the screen animates in so the first tap on play is instant.

## Done when
A writer can settle "which chorus" in three taps, and the room knows which take is the song.
