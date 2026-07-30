# R51 — The room always has one next move

**Audit target:** the songwriting room, the canvas and the feed — as a
*collaboration* surface, judged by a first-time writer who has never been
shown anything.
**Verdict:** the room is feature-complete and direction-empty. Every audit
R4–R50 added a capability. None of them added a *current*. A writer opens the
room and sees a workspace: parts, takes, a feed strip, a canvas, people. All
of it is available and none of it is asked for. That is the fat to trim.

---

## 1. The reference standard (what world-class looks like here)

| App | The mechanic worth stealing | The anti-pattern it avoids |
|---|---|---|
| **Figma multiplayer** | Presence is *ambient* — coloured cursors and avatars, no join/leave noise. Comments are pins on the artboard, not a sidebar list. | No "X is editing" modals, no lock dialogs. |
| **Google Docs suggesting mode** | A change arrives as a *thing you accept or reject in place*, one tap, in the sentence itself. | No diff view, no merge screen. |
| **Linear** | Every mutation paints locally first; the network is invisible. Latency budget ≈ 0. | No spinners on user-initiated writes. |
| **Notion** | One `/` affordance, contextual to where the caret is. | No global toolbar of 40 icons. |
| **BandLab / Splice** | Takes are stacked in place — A/B is a swipe, not a file manager. | No "versions" folder. |
| **Apple Voice Memos** | One button. The primary action is the interface. | No settings before recording. |
| **Temu / TikTok** | The screen *always* proposes the next step and it is always one tap; you are never returned to a neutral surface. | It never asks you to choose between five things. |

**The synthesis, and the law for this audit:**
> Collaboration UX is not features. It is *never being at a dead end, and never
> being asked to choose.* One person, one room, one obvious next move.

### 1.1 The five cross-cutting laws (from the reference research)

Every collaboration surface in this app — room, canvas, feed — must satisfy all
five. Treat them as review gates, not aspirations.

1. **Identity is always visible, always the same colour.** One person = one
   colour, bound identically across their presence avatar, their edit marks,
   their note pins and their takes. Never a grey anonymous blob.
   *In COG:* the creator colour system already exists (`creatorColors`) — extend
   it to presence, note authorship and take lanes so the binding never breaks.
2. **Every collaborative artifact is spatially anchored.** A comment is a pin at
   a place (a line, a card, a millisecond in a take), never an entry in a
   detached list. *In COG:* R46 moment-notes and R45 replies exist server-side
   and are currently only reachable through a list — anchor them: a note on a
   take renders as a gold pin on the waveform, tap = jump-and-play from there;
   a note on a line renders as a soft underline on that line.
3. **Optimistic always; the network is invisible.** Motion plays on tap, not on
   response. Failure is a quiet toast and a rollback, never a blocking dialog.
4. **Two clicks or fewer, and nothing destructive is instant.** Accept, reject,
   resolve, restore — all reachable from the point of context, all reversible
   (R34 already guarantees recoverability; the UI must promise it in words).
5. **Never a dead end.** After *any* completed action the room proposes the next
   one. This is exactly what `song_next_move` exists to power — so the strip
   must re-evaluate after every mutation, not only on entry.

**One deliberate divergence from the Temu reference:** we take its
forward-momentum (always one next action, never a static done-screen) and
explicitly reject its urgency layer — no countdowns, no social-proof pressure,
no confetti. This room is a sanctuary. Momentum, not manipulation.

---

## 2. Stress test — what breaks today

Walk these six as a first-timer. Each ends in a dead end today.

1. **Brand-new song.** Room opens empty. The canvas shows a root card and two
   zone labels. There is no instruction and five equally-weighted entry points.
   → *Dead end: the writer leaves.*
2. **A collaborator suggested a line.** The count exists (`open_suggestion_count`)
   but the room shows a grey sentence, not a door. → *A person is waiting and
   the room whispers.*
3. **Idea captured on the move.** It lands unfiled. Nothing ever asks where it
   belongs, so the song grows a junk drawer. → *Loose material accumulates.*
4. **Verse 2 exists but has no words.** `song_gaps` knows. Nothing surfaces it
   at the moment the writer is actually in the room.
5. **Song is complete.** Nothing offers the ending. It stays "in progress"
   forever, so the catalog never resolves.
6. **Solo song, nobody invited.** The single highest-value action in the whole
   product is buried behind People. → *The growth loop never fires.*

Every one of these is the *same* bug: the room has state and no voice.

---

## 3. The fix — ONE strip, ONE action, ONE tap

Backend is done and shipped:

- `song_next_move(_song_id)` — membership-gated, role-aware, read-only. Returns
  **one** object, never a list. Ladder, in priority order:
  1. `review_suggestion` — a person is waiting on you (owner only)
  2. `first_part` — the song is empty
  3. `file_memo` — a recording has no home
  4. `write_words` / `record_part` / `fill_part` — the emptiest part, nearest the top
  5. `name_song` — still called Untitled
  6. `invite` — nobody else has heard it
  7. `finish` — every part is filled in
  8. `none` — silence
- `src/integrations/cog/nextMove.ts` — `getNextMove`, `hasMove`, `visibleMove`,
  `dismissMove` (this-visit-only, per kind+target), `resetDismissals`.

A finished song returns `none`. A viewer is never told to write. A song with
nothing to say says nothing.

---

## 4. What to build (frontend — Claude)

### 4.1 The NextMove strip

One component, `src/components/room/NextMoveStrip.tsx`. Rendered in exactly two
places: the song hub (under the header) and the canvas (docked bottom, above
the safe area). **Never both visible at once.**

Anatomy — and nothing more than this:

```
┌────────────────────────────────────────────┐
│  Verse 2 has no words yet        [ Write it ] │
└────────────────────────────────────────────┘
```

- Height 56px. `--cog-cream-light`, `--cog-border`, radius 16px.
- Headline: `--font-body`, 15px, `--cog-charcoal`. One line, truncates.
- Action: gold pill, radius 14px, white text, min 44px tap target.
- No icon. No count badge. No progress bar. No "3 of 7 steps". No dismiss X —
  swipe the strip right to dismiss for this visit (`dismissMove`).
- `aria-live="polite"`; the strip is a `<section aria-label="Next move">` with
  a real `<button>`.

### 4.2 Where each tap lands (no intermediate screen, ever)

| kind | tap does |
|---|---|
| `review_suggestion` | opens `LineSuggestionSheet` directly on the oldest open suggestion |
| `first_part` | opens `AddPartSheet` with the Verse chip preselected and the field focused |
| `file_memo` | opens the filing sheet (R44) on the oldest unfiled memo |
| `write_words` / `fill_part` | navigates to that section and **puts the caret in the empty line** |
| `record_part` | navigates to that section and arms the recorder (does not start it) |
| `name_song` | inline title edit + the R47 suggestion whisper, caret in field |
| `invite` | opens the invite sheet with the native share sheet one tap away |
| `finish` | opens the finish confirm (R38), single button |

A tap must never land on a screen where the writer has to look for the thing
the strip just named.

### 4.3 Instant feel (non-negotiable)

- `song_next_move` is called **once** on room entry, in parallel with
  `song_room_bootstrap` — never blocking first paint. The strip fades in at
  250ms `--cog-ease-reveal` after the room is already usable.
- Re-fetch only on: a successful mutation the strip's kind depends on, and on
  realtime `song_activity` invalidation. Never on an interval, never on focus.
- On tap: the strip **immediately** collapses (150ms) and the destination
  opens. Do not wait for anything. If the mutation later fails, the strip
  returns — the room is honest, not apologetic.
- Cache under `["song", id, "nextMove"]`, `staleTime: 30_000`.

### 4.4 Simplifications to make in the same pass (trim the fat)

These are removals. Do them.

1. **Delete `roomWaitingLine` from the UI.** The strip replaces it. Two nudges
   is one nudge too many. (Keep the export; stop rendering it.)
2. **`FirstActionPrompt.tsx` on the canvas** — retire it. Its whole job is now
   the `first_part` move, and it used a different visual language.
3. **Hub tiles with zero content** should read the state, not the label:
   a Voice tile with no takes says "No recordings yet", not "Voice".
4. **No badges anywhere.** If a count matters it is in the strip's sentence,
   in words ("2 suggested lines"), never a red dot.
5. **Canvas: one mic.** The BottomNav mic, the canvas mic and the FAB must not
   co-exist on any single frame. Verify at 390px.

### 4.5 Collaboration polish that rides along

- Wire `subscribeRoomFocus` (R41 — currently shipped and unused). Show it as
  the *only* presence signal in the room: a 20px avatar beside the section
  header while someone else is in that part, gently pulsing while they type.
  No cursor, no name label, no toast.
- When another person's edit lands in the section you are reading, the changed
  line gets a 600ms gold wash and nothing else. No banner, no "reload".
- **Anchor the notes (law 2).** Moment-notes (R46) become pins on the take's
  waveform in the author's creator colour; tapping seeks and plays from that
  millisecond. Line notes become a 2px underline under the line, tap opens the
  thread popover in place. Delete any surface that shows notes as a bare list.
- **Accept/reject in place (law 4).** A suggested line (R45/R19) renders inline
  on the line it replaces — old struck through, new beneath it in the
  suggester's colour, with ✓ / ✗ adjacent. No diff screen, no separate route.
- **Ambient presence only (law 1).** Follow-mode, cursor trails and join/leave
  toasts are out of scope and stay out — one 20px avatar is the whole signal.

---

## 5. Acceptance — verified at 390px, one thumb

- [ ] A brand-new song shows exactly one sentence and one button, above the fold.
- [ ] There is never more than one nudge on screen.
- [ ] Every strip tap lands on the exact control it named, focused/armed.
- [ ] A viewer never sees a write action.
- [ ] A finished song shows no strip.
- [ ] Swipe-right dismisses for the visit; reopening the room brings it back.
- [ ] Strip render costs zero blocking requests; room paints identically without it.
- [ ] No red, no badges, no counters, no streaks anywhere in this feature.
- [ ] Reduced-motion: no fade, no collapse — the strip just is, then isn't.
- [ ] The strip re-evaluates after every mutation — no action ends in stillness.
- [ ] Every note is reachable from the thing it is about, not only from a list.
- [ ] One person renders in exactly one colour everywhere they appear.

---

## 6. The one goal, restated

The songwriting room exists so a song gets *finished with other people*.
Everything in it should either move the song forward or get out of the way.
After R51 the room has a heartbeat: at every moment it knows the single most
useful thing, says it in one sentence, and gets you there in one tap.