# R56 — "The first ten seconds"

**The one goal of the room:** everything for this song stays connected here.
**The R56 defect:** the room is designed for the person who already knows the song. It has never been designed for the stranger who just walked in — and the stranger is the growth loop.

---

## 1. Stress test — accept an invite on a second phone

| Second | What a first-timer sees today | Verdict |
|---|---|---|
| 0–1 | Invite accepted → dumped straight into the room | ❌ No handoff. Whose song is this? |
| 1–3 | A title, tabs, cards, a canvas | ❌ Reads as a tool, not as someone's unfinished song |
| 3–5 | Nothing tells them what they may touch | ❌ Fear of breaking someone else's work = no first action |
| 5–10 | R51's next-move strip may say "Write it" | ❌ Wrong first move — they haven't *heard* the song |
| Return visit | Same lack of orientation, forever | ❌ Or, worse, a welcome that repeats |

**The core miss:** we tell a newcomer to *contribute* before we let them *hear*. Nobody writes a line for a melody they haven't heard.

## 2. The reference standard

- **Figma multiplayer:** you land where the work is, with faces attached. Orientation is the artifact itself, not a tour.
- **Notion shared page:** one line of context, then the content. No modal, no checklist.
- **Spotify collaborative playlist:** the first affordance for a joiner is *play*, never *add*.
- **Temu, the honest half:** never leave a new arrival without an obvious forward step. We keep the momentum; we reject the urgency, the countdowns and the confetti.
- **Anti-reference — every SaaS product tour:** coach marks, dots, "Next →". If the room needs a tour, the room is wrong.

## 3. The R56 rule

> A first-time arrival gets **four sentences and one button**, printed over the room, once.
> The first button for someone who did not start this song is always **Listen**.
> There is no tour, no checklist, no second screen, and it never appears twice.

## 4. Backend (shipped)

`song_arrival(_song_id)` → one call, returns and stamps in one step:
- `first_visit` — true exactly once per person per song (stamps `song_notification_prefs.last_seen_at`).
- `title`, `owner_name`, `invited_by_name`, `people_count`, `is_owner`.
- `room_line` — "3 parts and 2 recordings." / "Nothing here yet — it starts with you."
- `permission_line` — "You can write, record and comment here." / "You can listen and read here." (capability, never the word *collaborator* or *viewer*).
- `first_move` — `{ kind, headline, action, target_type, target_id }`. Viewer → listen/read. Empty song → add a part. Any recordings + first visit → **listen**. Otherwise → the first wordless part, then record, then listen.

SDK: `getSongArrival(songId)` in `src/integrations/cog/arrival.ts`. Returns `null` on any failure — a stranger's first second is never an error state.

## 5. Frontend — every interaction, exactly

### 5.1 Fetch
- Fire `getSongArrival(songId)` **in parallel** with the room bootstrap, never chained after it.
- The room paints first, always. The welcome layers over an already-rendered room — the newcomer sees the real song behind it, which is the entire point.
- `first_visit === false` → discard, render nothing. No stored flags client-side; the server owns "once".

### 5.2 The welcome (the only new component: `ArrivalWelcome`)
A bottom sheet, not a modal. 88% width, 24px radius on the top corners, `--cog-cream-light`, standard glow behind it. Rises 320ms `--cog-ease-reveal`; the room behind dims to 40% and stays visible and un-blurred.

Contents, top to bottom, nothing else:
1. `invited_by_name ? "{name} invited you into this song." : "{owner_name}'s song."` — `--t-label`, `--cog-warm-gray`.
2. **Song title** — `--font-display`, `--t-song-title`, charcoal.
3. `room_line` — `--t-body`, `--cog-warm-gray`.
4. `permission_line` — `--t-label`, `--cog-warm-gray`.
5. Cast row (R52): up to 5 colour dots with initials, 24px, overlapping 6px. No names, no roles, no count badge.
6. **One gold full-width button**: `first_move.action`. Above it, `first_move.headline` in `--t-label`.
7. Below the button, a single 44px text target: **Look around** — dismisses.

No close X. No "skip". No progress dots. No second page. No illustration.

### 5.3 What the button does
- Dismiss (280ms slide down) **and then navigate**, in that order, so the transition reads as entering the room, not leaving a dialog.
- `takes` → the takes drawer, first take auto-selected, **auto-plays** (audio was prefetched by R40, so it starts under 200ms).
- `sheet` → the words, scrolled to top.
- `section` → that part, caret placed at the end of its last line.
- `section_new` → the add-a-part sheet, open, keyboard up.
- `record` → the capture bar, armed but **not** recording.
- **Look around** → dismiss only, no navigation. The R51 next-move strip is what carries them from here.

### 5.4 Hand-off to R51
- Suppress the R51 next-move strip while the welcome is on screen; fade it in 400ms after dismissal.
- The welcome is orientation and happens once. The strip is momentum and happens forever. They must never be on screen together.

### 5.5 The owner's first visit
`is_owner && first_visit` → show the same sheet with line 1 omitted and the button from `first_move` (usually "Add a part"). Same component, same once-only rule. Do not build a second variant.

## 6. Removals — trim the fat (do all six)
1. **Delete the invite-accepted interstitial / "You're in!" screen.** Acceptance navigates straight into the room; the welcome is the confirmation.
2. **Delete any coach marks, tooltips, spotlight overlays or "?" help buttons** in the song room.
3. **Delete the empty-state paragraphs** on the parts, takes and notes tabs — one line and one gold button each, maximum.
4. **Delete role labels from the room UI** ("Collaborator", "Viewer" chips). Capability is stated once, in the welcome; the rest is enforcement, not decoration.
5. **Delete any client-side `hasSeenWelcome` localStorage flag.** The server stamps it. Two devices, one welcome.
6. **Delete the "who else is here" list view** if one survived R52 — the cast row is the whole feature.

## 7. Performance gates
- `song_arrival` is one round trip and must not be awaited before first paint.
- Welcome mount → visible under 100ms after the payload lands.
- Tapping **Listen** → audible audio under 300ms (fails the gate if R40 prefetch was skipped).
- Zero layout shift in the room when the sheet mounts or dismisses.

## 8. Definition of done
- New phone, accept an invite → room paints, welcome rises, four sentences, one gold button, audio plays on tap.
- Reload → no welcome, ever, on any device signed in as that person.
- Viewer arrival → the button says Listen and no writing affordance is visible anywhere on screen.
- Owner creating a brand new song → same sheet once, button "Add a part".
- Airplane mode arrival → no welcome, no error, room renders from cache.
