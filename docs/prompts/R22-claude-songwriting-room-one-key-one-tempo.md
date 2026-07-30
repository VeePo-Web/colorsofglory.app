# R22 — Songwriting Room Audit: "One key, one tempo, the chords under them"

**Lane:** Claude (frontend only). Backend for this is already shipped by Lovable.
**Goal of the room (never forget):** everything for this song stays connected here.
**Rule for this pass:** if there is a choice to complicate or simplify — simplify.

## What changed on the backend (ready to use)

SDK: `src/integrations/cog/chords.ts`

| Function | What it does |
|---|---|
| `getChordsBoard(songId)` | ONE request → song key/tempo/time signature, your role, every progression (with section label + author name), and the section list for the picker. |
| `saveChordProgression({ songId, chords, progressionId?, sectionId?, label? })` | Create or update. Returns the id. |
| `deleteChordProgression(progressionId)` | Removes one progression. |
| `setSongMusicalMeta({ songId, keySignature?, tempoBpm?, timeSignature? })` | Updates only the fields you pass. |

Server guarantees: membership required to read, owner/collaborator required to write, viewers rejected with a permission error, every write logged to the activity feed (IDs only — never chord content in payloads).

## The screen: `/song/:id/chords`

One scroll. Three zones, in this order.

### 1. The header strip — key, tempo, time
- Three inline chips: `Key · G`, `120 BPM`, `4/4`. Serif song title above.
- Tapping a chip opens a small bottom sheet with a single control (key wheel / tempo stepper + tap-tempo / time-signature list). No multi-field modal.
- Optimistic: chip updates immediately, `setSongMusicalMeta` fires, silent revert + one calm toast on failure.
- The metronome already reads tempo — tapping the tempo chip must offer "Play click" so the number is heard, not guessed.

### 2. Progressions list
- Card per progression: section label (`Chorus`) as the small eyebrow, chord chips in gold-pale on the row below, author name + relative time in warm gray.
- Chips wrap; never horizontally scroll a progression.
- Tap a card → inline edit mode in place (no new route): chips become removable, a chord keypad slides up.
- Long-press / overflow → Duplicate, Change section, Delete (delete = calm confirm, no red).

### 3. The chord keypad
- 7 diatonic chords for the current key, in scale order, plus a "more" row for accidentals and quality (m, 7, sus4, /bass).
- Tap appends. Backspace removes the last. Save on close — one write.
- If no key is set, default to C and quietly set it on first save.

## Empty + edge states
- No progressions: one line — "Track the chords under this song." + one gold CTA "Add a progression".
- Viewer role: everything renders, no add button, no edit affordance, no disabled-button graveyard.
- Offline: reads come from cache; writes go through the existing sync outbox pattern used by notes/sheet.

## Performance
- Exactly one network call on mount (`getChordsBoard`).
- No spinner if cached data exists — render cache, revalidate underneath.
- Chord chips are pure presentational components; the keypad is lazy-loaded.

## Definition of done
- Chords view opens in one request and is interactive under 100ms from cache.
- Key/tempo/time edits are one tap deep and never lose focus.
- A collaborator's change appears in the activity feed as "changed the chords" with no chord content leaked.
- Nothing on this screen requires a second screen to finish a thought.
