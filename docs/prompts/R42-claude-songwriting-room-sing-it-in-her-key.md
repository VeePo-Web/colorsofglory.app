# R42 — Songwriting Room Audit: "Sing it in her key"

**Owner:** Claude (frontend)
**Backend:** shipped — `src/integrations/cog/transpose.ts`
**Goal of the room:** the song stays in one place — including when a different
voice has to carry it.

---

## The finding

The chords board stores one key and one set of chord symbols. That is right for
the writer at 11pm and wrong for everyone else. On Sunday the song is handed to
a singer whose range is a third lower, and the room offers two bad options:
retype every chord by hand, or sing it in the wrong key.

Nothing about the song needs to change to fix this. Transposition is a **way of
looking at the chart**, not an edit. It should cost one tap and change nothing
that is stored — unless the writer says so.

## What backend now provides

`src/integrations/cog/transpose.ts` — pure functions, no network, instant.

| API | Use |
|---|---|
| `transposeChords(chords, semitones, preferFlats)` | Shift a progression. Slash chords, `maj7`, `sus4`, `add9` all survive; unparseable text is left untouched. |
| `transposeKey(key, semitones)` | The key you land in, spelled the way musicians write it (Bb, not A#). |
| `prefersFlats(key)` | Whether the whole chart should use flats. Pass into `transposeChords`. |
| `keyOptions(currentKey)` | Twelve keys with their semitone offsets — the key picker's data. |
| `semitonesBetween(from, to)` | For a picker that speaks in key names. |
| `capoSuggestion(semitones)` | Guitarist shortcut: `{ fret }` or null. |
| `commitTranspose(songId, semitones)` | **The only write.** Rewrites all progressions + song key through the existing guarded chord writes. |

## What to build

1. **One control, in the chords header.** The existing key display (`Key of G`)
   becomes tappable. Tapping opens a compact key strip — the twelve keys from
   `keyOptions()`, current key marked with a gold border. No modal, no
   stepper buttons, no `+1 / −1` chrome.
2. **Instant, local, everywhere.** Selecting a key sets `viewSemitones` in room
   context. The chords board, the lyrics editor's chord chips and Performance
   Mode (R36) all render `transposeChords(..., viewSemitones, prefersFlats(viewKey))`
   at paint time. No refetch, no spinner, no await — the whole chart changes
   in the same frame.
3. **Say plainly that nothing changed.** While `viewSemitones !== 0`, the
   header reads `Key of A · written in G` in warm-gray, with a quiet
   *Back to G* text link. That sentence is the entire "temporary" affordance.
4. **Capo, only for guitarists who need it.** If `capoSuggestion()` returns a
   fret, add one warm-gray line under the header: *Capo 2 — play the shapes in G*.
   No toggle, no settings.
5. **Make it permanent, deliberately.** One text link — *Keep this key* — calls
   `commitTranspose`. Optimistically set the header to the new key, then
   confirm. It is a normal edit: owner/collaborator only, hidden for viewers,
   and version history + the feed already record it.
6. **Remember per person, not per song.** Persist `viewSemitones` in the
   existing per-user room state so a singer's chosen key survives a reload
   without changing what anyone else sees.

## Rules

- Transposing is never a save. Only *Keep this key* writes.
- Viewers may transpose their view. They may not commit.
- Spelling follows the key: flats in Bb/Eb/F, sharps in D/A/E. Never mix.
- No red, no toast on view-transpose — the header sentence is the feedback.
- Simplicity check: this is **a tappable key, a strip of twelve, and one link.**
  If it needs a settings screen, it is wrong.

## Done when

- Tapping a key changes every chord on screen with no perceptible delay.
- Reloading keeps the singer's key; another collaborator still sees G.
- *Keep this key* updates the stored chart once and the header stops saying
  "written in G".
- A chart containing `G/B`, `Cmaj7`, `Dsus4` transposes correctly and a stray
  `(instrumental)` line comes through untouched.
