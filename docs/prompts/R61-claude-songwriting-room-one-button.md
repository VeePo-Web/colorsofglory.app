# R61 — One button. Tap to type, hold to hum.
## Claude build prompt — capture, everywhere in the room

### The stress test
A melody arrives. Count the taps. Today: find the right surface → find the right
part → find the right affordance (a text field here, a mic there, a "+" somewhere
else) → then capture. That's four decisions before a single word exists, and the
melody is gone by decision two. Sixty rounds refined *what happens after* capture.
Nobody counted the taps *to* capture.

### Reference standard
- **Voice Memos** — one button. Nothing to decide. Recording before the screen redraws.
- **iMessage** — one bar, always at the bottom: type in it, or hold the mic. Same control, two gestures.
- **Things 3** — the magic plus is the only creation affordance in the whole app.
- **Temu** — the next action is never something you go looking for; it is already under your thumb.

### The decision (simplify)
**One control. One place. Two gestures.**
A single 56px gold pill fixed to the bottom of the room, on both surfaces.
- **Tap** → it becomes a one-line field, keyboard up (R58 rules apply).
- **Hold** → recording starts on `pointerdown`, before any render (R57 rules apply).
- Release / send → it lands, the pill returns. No sheet, no mode, no menu.

### Where it lands (never a choice the user makes)
- Typed, with a part in view → the next lyric line of that part.
- Typed, no part in view → top of the ideas shelf.
- Held (a hum) → always the ideas shelf, top, playable instantly from the local blob.
`captureIdea()` returns the destination; the room scrolls to `captureAnchor()`
and the new item does a 400ms `--cog-ease-reveal` rise. That scroll is the receipt —
there is no toast.

### Interactions, exactly
1. `pointerdown` → 8ms haptic, pill scales to 0.97.
2. Still down at 180ms → recording; pill grows into a full-width bar with a gold
   waveform and a live timer. Slide left past 80px = cancel (bar greys, haptic).
3. Up before 180ms → field mode, caret ready, placeholder is the part's name
   (`Verse 1…`) or `An idea…` on Ideas.
4. Enter → lands and the field **stays open** for the next line. This is the funnel:
   one thought becomes four without a single extra tap.
5. Blur with text → lands anyway. Nothing typed is ever discarded.
6. Viewer role → the pill is absent, not disabled.

### Remove
- The `+ Capture an idea` shelf row from R60 (the pill covers it).
- The separate record button in the section header.
- The "new line" button in the lyric sheet.
- The capture type chooser (text / voice / chord) — gesture decides.
- Every "Idea captured" toast.

### Backend (done)
- `capture_idea(_song_id, _client_key, _body, _section_id, _take_id)` — role- and
  lock-checked, idempotent on `client_key`, returns `{kind, line_id|card_id, section_id}`.
- SDK: `src/integrations/cog/capture.ts` (`captureIdea`, `newClientKey`, `captureAnchor`).

### Done when
From anywhere in the room, thumb already resting on the pill: hum in under 200ms,
or type four lines without ever lifting a finger to find a control.
