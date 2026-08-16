# THE HALLWAY, PERFECTED — the frictionless funnel inside Canvas mode
## The in-depth vision + working prompt · Steve Jobs simplicity · GarageBand mobile as the floor, not the ceiling

MODEL: Claude Fable 5
PRIMARY VIEWPORT: 390 × 844 (iPhone / iOS Safari), one thumb, one bar of signal
COMPANION: docs/prompts/THE-HALLWAY-CAPTURE-TO-CANVAS-MASTER.md (pass 1 — the
stations, the laws, the H/F ledger). THIS doc is the deeper cut: the funnel
economics, the GarageBand standard, and the screen-by-screen plan.
RE-FIRABLE: yes. Every pass: vision-check → audit → fix → verify → commit+push.

============================================================
PART 1 — THE ONE SENTENCE
============================================================

A worship leader with a melody in her head and ninety seconds before
rehearsal must be able to hum it, file it, hear it, answer it with a harmony,
keep it, and hear the whole song — without making a single decision she
didn't come here to make.

That is the product. Everything else is furniture.

Steve Jobs's actual method — the one worth copying — was never minimalism.
It was REFUSING TO SHIP A DECISION THE USER SHOULDN'T HAVE TO MAKE. The
iPod didn't have fewer songs; it had fewer choices standing between you and
the song. The hallway applies that test to every pixel of Canvas mode:

> "Is this a decision the songwriter came here to make?
>  If not, the software must make it — silently, reversibly, correctly."

============================================================
PART 1.5 — THE 8-YEAR-OLD TEST (the law above the laws)
============================================================

An 8-year-old can run GarageBand. Not because it is childish — because every
surface obeys four contracts a child (and a distracted adult, and a
worship leader mid-rehearsal, which is the same cognitive state) can trust:

1. **THE GUESS CONTRACT.** Looking at any control, a child's first guess
   about what it does is the right one. If a label needs product knowledge
   to parse, the label is wrong. If an icon needs a label to explain it,
   pair them — an unlabeled icon is a riddle, and children don't tap
   riddles. (Neither do adults; adults just blame themselves.)
2. **THE RESULT CONTRACT.** The tap does exactly what it looked like it
   would do, and you SEE the result happen — the card flies, the stack
   grows, the song plays. Nothing important happens invisibly; nothing
   visible happens that wasn't asked for.
3. **THE WORDS CONTRACT.** Every visible string reads at grade 3: short
   words, one clause, the user's own vocabulary (song, idea, sing, hear,
   keep), never the builder's (sync, queue, transcript, BPM without
   context). One act = one name, on every surface — the same verb never
   wears two costumes.
4. **THE COURAGE CONTRACT.** A child taps freely because nothing they can
   reach is destructive, everything is reversible, and mistakes are met
   with kindness ("your idea is still here"), never blame. Fearlessness is
   a UI property: it is manufactured by undo, honesty, and calm copy.

The test in practice, run every pass: hand the phone (in your mind, and
eventually in a hallway at church) to an 8-year-old with one sentence of
setup — "this is where your song lives." Watch for the FIRST hesitation.
The hesitation is the finding. Fix that, then watch again.

DETAILS WITHIN THE DETAILS — the Jobs discipline, made operational. A
surface passes the big audit and still fails the fingertips. So each pass
also descends one level: not "is there a record button" but what happens
in the 400ms after it's pressed; not "is there a guide track" but what the
writer SEES in the silence before it starts; not "is there an undo" but
whether the toast's word choice makes a 9-year-old feel safe enough to tap
again. Every detail contains details. The pass is done at the level where
the details stop mattering to the person holding the phone — and one
level deeper, because that person is mid-melody and deserves margin.

============================================================
PART 2 — THE FRICTIONLESS FUNNEL (every tap counted, every decision priced)
============================================================

The hallway is a funnel with no walls: each station COMPLETES with the next
station already standing there. This table is a CONTRACT — a change that
adds a tap, a decision, or a watched wait to any row is a regression,
however beautiful.

A "decision" is a fork the writer must adjudicate (a form field, a picker,
a choice between equals). A tap that continues the obvious path costs almost
nothing. A decision costs everything, because deciding is what interrupts a
melody. Forms before safety cost double.

| # | Station | Acts | Decisions | The next act, already standing there |
|---|---|---|---|---|
| 0 | The spark (open mic) | 1 tap = recording | 0 | Stop → the take is already safe |
| 1 | The door (file it) | 1–2 taps | ≤2 (which song; optionally which part) | the "Add to canvas" ribbon |
| 2 | The arrival | 0 taps | 0 | your card pulses at the top of the feed |
| 3 | Hear it | 1 tap | 0 | the selected row: Layer over this · → Final |
| 4 | Answer it (a layer) | 2 taps | 0 | sing; Stop; the stack shows both voices |
| 5 | Keep it | 1 gesture (swipe → Final) | 0 | the toast offers "Hear it" |
| 6 | Hear the song | 1–2 taps | 0 | the transport; finishing offers the door |
| 7 | Open the door | 1 tap | 1 (role — defaulted) | back to writing; arrivals announced |

Spark → the whole song heard: **~8 deliberate acts, ≤3 decisions, zero
forms, zero dead ends, zero watched waits.** Every station's failure mode
resolves to "the idea is safe + retry" — never to a fork the writer must
adjudicate mid-melody.

FUNNEL DISCIPLINE for every future feature: name the station it serves,
price it against this table, and name what it removes. A feature that adds
a station must delete a decision elsewhere to pay for itself. A feature
that cannot name its station does not enter the hallway.

============================================================
PART 3 — THE GARAGEBAND MOBILE STANDARD (copy the clarity, beat the care)
============================================================

GarageBand mobile is the UI standard because it puts a full studio on a
phone without a manual: one dominant surface per mode, one loud control per
state, theory collapsed into smart defaults, chrome that steps back the
moment sound starts — and fifteen years of never eating anyone's take.
Copy those moves. Then beat it where a DAW's operator-view cannot follow a
songwriter's story.

### 3.1 · What to copy, surface by surface

| GarageBand mobile does | The hallway's equivalent | Verdict |
|---|---|---|
| The record button is THE control; everything recedes while tracking | RecordingSheet owns the whole screen: scrim, the breath, Stop | MATCH — never add a second control to the recording state |
| Track headers hide mute/solo/fader until a tap reveals them | The stack sheet is the mixing room: per-layer mute/solo/gain live THERE, never on the feed card | MATCH — pinned by FeedCard.test.tsx ("verbs on selection") |
| + Track: full screen, ONE decision per screen | Add part sheet: one picker, saved instantly | MATCH |
| Sound changes LIVE under your finger (faders ramp, no clicks) | useStackPlayer resolves the mix through ramped GainNodes | MATCH — keep it on the Web Audio clock |
| Big cards, one clear tap (loop browser) | Feed cards, full-width paper, one tone stripe, one face | MATCH |
| Auto-saves through force-quit, every time, invisibly | The outbox + salvage covenant | MEET FULLY — pass 2: an interrupted LAYER must come back WITH ITS PARENT, on the canvas, without visiting capture |
| Says plainly why it can't record (input busy, no mic) | Quota + permission narration | MEET FULLY — pass 2: kill the "back online" lie for storage-quota failures |

### 3.2 · Where the hallway must BEAT GarageBand

| GarageBand's ceiling | The hallway goes past it |
|---|---|
| Opens into the tracks view — the OPERATOR'S view of regions and lanes | The room opens into the STORY: newest sparks first, grouped by the song's anatomy (Verse, Chorus), not by instrument |
| Asks you to pick tempo/key before you play | F13 already LISTENED to your hum: key and tempo arrive as a quiet, confirmable suggestion — the app heard you first |
| Undo sits permanently in the toolbar | Undo lives inside the moment's own toast, then leaves — one less standing control, and the moment carries its own exit |
| A track is anonymous audio | Every card and every layer wears its maker's name and color — a co-write remembers WHO, forever, into credits |
| One pair of hands | The room is multiplayer: arrivals announced once and calmly, contributions land without notification energy, the owner's Final stays clean |
| Musical vocabulary (regions, bars, quantize) | Human vocabulary only: song, idea, take, layer, part, final — a worship leader's words, not an engineer's |

The deepest GarageBand magic is not a control — it is TRUST. Fifteen years,
zero eaten takes. The hallway's layers UX must clear that bar on a $150
Android in a church basement with one bar of signal. Reliability IS the
simplicity: every recovery flow we make automatic is a decision the writer
never sees.

============================================================
PART 4 — SCREEN BY SCREEN: THE HALLWAY INSIDE CANVAS MODE
============================================================

The plan for each surface, in the order the writer meets them. Each screen
lists: its ONE job, its one gold, what it may show, and what it must never
show. (File:line anchors refer to current main; re-verify each pass.)

### 4.1 · THE THRESHOLD (header, feed head)
ONE JOB: say whose room this is and where you stand — in one glance.
- Row 1: ← Songs · the serif song title · Review/Invite at the right edge.
- The Ideas|Final pager beneath: PALE tones, location not CTA (the tab is a
  place marker; gold fill belongs to Record memo alone).
- TARGET (pass 2): exactly TWO chrome bands before the first card. The
  status line is an aria-live region for screens readers, not a visual band.
- Never: a third row, a badge count, two gold fills, any control a role
  cannot use.

### 4.2 · THE STREAM (Ideas page)
ONE JOB: show the song's raw material, newest spark first, and make the one
next act obvious.
- Groups: New sparks → the song's parts → "Already in the song" (dimmed,
  one-line receipts). The entrance cascade settles top-to-bottom once.
- A resting card = face + tone stripe + WHO + quiet state ("≡ 2 layers").
  Verbs appear on selection: Layer over this · Layers · N · → Final.
- The arrival pulse (from=capture) greets the writer's freshest cards.
- The dock: Record memo (the gold) + Add part (ghost). It yields to any
  bottom workflow — one bottom surface, always.
- Never: a standing CTA on every card, an empty-state lecture, a map.

### 4.3 · THE MIXING ROOM (the stack sheet — layers & tries)
ONE JOB: two relationships, never merged — TRIES (takes of the same idea,
one keeper) and LAYERS (voices that play together).
- GarageBand register: each layer is a row — name, maker's color, mute,
  solo, gain — and the mix changes LIVE under the thumb.
- "Record a layer" arms the recorder with the base as the headphone guide;
  the measured latency offset seats the layer on the base's grid.
- Focus-trapped, safe-area aware, dismissible three ways.
- THE COVENANT (pass 2 closes the last gap): an interrupted layer — call,
  Bluetooth swap, killed tab — comes back ON THE CANVAS with its parent
  intact. The writer never learns the word "salvage."
- Never: a timeline, a waveform lane, a dB number, the word "track."

### 4.4 · THE RECORDING BREATH
ONE JOB: capture, safely, with nothing else on screen.
- Full scrim; the pulse; Stop (saves) and Cancel. Backdrop-dismiss is
  blocked during a live take — the two exits are explicit.
- The saved toast fires only AFTER durability is confirmed (never before —
  the false "Saved" was the worst lie this surface ever told).
- Never: a second control, a form, a countdown the writer must watch.

### 4.5 · THE SET LIST (Final page)
ONE JOB: hear the song, in order, and shape that order with one thumb.
- Play the song = the page's gold. Rows reorder with 44px ghost chevrons
  that REST while the song sounds. Finishing offers the next moment
  (play again · keep shaping · someone should hear this).
- Never: arrangement chrome while listening, a mixer, source metadata
  before it's asked for.

### 4.6 · THE DOOR (invite & arrivals)
ONE JOB: get a co-writer in within two taps; greet them by name and role
in plain words; tell the owner when they arrive — once.
- Role is a defaulted human sentence ("They can add ideas"), never a
  permissions matrix.
- Never: red, urgency, a seat-assignment form, a second announcer.

============================================================
PART 5 — THE LAYERS UX, END TO END (the collaboration heart)
============================================================

The single flow the user named — "the UX of the collaboration, adding
layers" — walked at full depth. Every step names its guarantee:

1. **Hear the base.** Tap the card → it plays. (Guarantee: one audio engine;
   selecting never surprises with sound — playing is always explicit.)
2. **Answer it.** Selected row → "Layer over this." (Guarantee: the parent
   id is normalized ONCE at the choke point — memoKey — so a hydrated
   `db-voice-*` base can never send a garbage parent to the server.)
3. **Sing over the guide.** The base plays in earbuds while recording; the
   measured latency offset is stored per-take. (Guarantee: the offset rides
   the upload end-to-end so every device seats the layer on the grid.)
4. **Stop.** The take persists BEFORE any network call; the saved toast
   fires only after the durable write confirms. (Guarantee: no false Saved.)
5. **The stack shows both.** The sheet reopens on the base; the new layer
   sits under it with the maker's name and color. (Guarantee: an optimistic
   layer never vanishes mid-upload — server truth UNIONS with in-flight.)
6. **Play the stack.** Both voices, ramped gains, mute/solo live.
   (Guarantee: ids resolve through memoKey; a stack hydrated on another
   device plays identically.)
7. **The Tuesday.** Phone call mid-layer → auto-finalize salvages the take
   WITH its parentage; killed tab → the canvas reclaims it on next open,
   as a layer, without the writer visiting any other surface. Airplane
   mode → queued honestly; storage full → told honestly, with the path
   (add storage), never "when you're back online."
8. **The memory.** The layer's maker flows to activity and credits — the
   contribution is remembered, because that is why people co-write here.

Steps 1–6 are built and pinned. Step 7's last two gaps (parentage through
salvage; honest quota) are THIS pass. Step 8 is the standing covenant.

============================================================
PART 6 — THE STRESS PROTOCOL (run every pass, break it on purpose)
============================================================

As Jordan, one thumb, 390px:
1. Walk the funnel (Part 2) clean — count acts and decisions against the
   table. Any row over budget = a finding.
2. Then BREAK EVERY STATION: airplane mode at each step · reload mid-flow ·
   double-tap every primary · deny the mic · fill the storage quota ·
   background the tab mid-layer · take a call mid-take · second device
   open throughout (every event exactly once, calmly).
3. The bar at each break: the idea is safe, the interface says so in human
   words, the retry is standing there, and recovery returns to the exact
   context. A break that produces a fork ("keep which?") the writer didn't
   ask for = a finding.
4. Fix the FIRST station where Jordan hesitates, is lied to, or loses work
   before auditing the next. Ship every pass: tsc clean → build green →
   suite green → commit + push (Concurrent-Tree protocol; stage by path;
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`).

============================================================
PART 7 — PASS 2 PLAN (from the master ledger, executed with this doc)
============================================================

- F1 → an interrupted layer keeps `parentMemoId` through the salvage store,
  and the CANVAS reclaims salvaged takes for its song on open — re-enqueued
  with parentage, invisible recovery, no capture-surface detour.
- F2 → quota failures on the canvas flush narrate honestly (kept safe +
  add storage), never "when you're back online"; the sweep stops burning
  retries against a wall that won't move today.
- F5 → the transient duplicate card during the upload window dies at the
  source: rows still "uploading" don't hydrate as mirrors (a card you
  can't play is a lie).
- F7 → the Voice Memos surface reads the REAL plan: a paying writer's
  transcribe toggle unlocks everywhere, not just in the canvas.
- F8 → the threshold drops to two chrome bands: Review/Invite join the
  title row; the status line becomes screen-reader-only. The first thing
  the room shows is the song.

PASS 3 (executed): F3 ✅ every durable write now CONFIRMS (outbox + seed
ideas throw on a refused IDB put; every caller retains + narrates — the
GarageBand never-eat-a-take covenant holds on every path, not just the
canvas). F4 ✅ the layer alignment offset rides the outbox path too (read
at upload, rekeyed on success) — a layer saved anywhere seats on the
base's grid on every device. F6 ✅ permanent server rejections (role
revoked, song deleted, invalid input — stable codes only) PARK: the blob
stays safe on-device, the sweeps stop hammering a wall that won't move,
and the writer is told the truth. F11 ✅ a transcript block the server's
own pass flagged as shaky wears a quiet "worth a quick listen" cue.

PASS 4 (executed — THE 8-YEAR-OLD PASS): Part 1.5's four contracts became
law; the invisible save narrator got its CSS; the layer flow narrates its
first 400ms, its base, and its guide; the stack is honest when offline;
one act = one name everywhere ("Sing over this" / "Record memo" /
"playing now" / "Just this"); ~40 strings brought to grade 3. F10 deleted.

PASS 5 PLAN (the seamless layer): G8 — the review sheet KNOWS it's a layer
(named header, base-derived default name, no section decision: 3 → 1).
G9 — the stack scrubs under the thumb (seek() finally wired to a 44px
slider). G10 — the record/review shells join the shared focus trap
(Escape stays a no-op during a live take — never discard by keyboard).
G11 — the gain slider speaks percentages, the stop button tells the truth
during count-in, the flow's inline-styled buttons gain press states.
Held for pass 6: G7 (the ONE persistent scrim under all three sheet
hand-offs — the last flash of bare canvas mid-flow) and the layer's
arrival glow in the stack.

============================================================
PART 8 — WHAT DONE LOOKS LIKE
============================================================

Jordan opens the room she filed a hum into this morning. Her spark is
pulsing gently at the top. She taps it — it plays. She taps "Layer over
this," sings the harmony against her own voice in her earbuds, stops. The
stack shows both voices with her name twice. Her phone rings mid-third-take
— she answers, comes back, and the take is simply THERE, a layer, waiting.
She swipes the stack to Final, taps "Hear it," and the song plays through.
The room offers the door. She sends it to Marcus. Total decisions made: the
song's name, this morning. Everything else, the hallway decided for her —
silently, reversibly, correctly.

When a pass ends and that paragraph is not yet true on a real phone, the
pass names the exact step where it broke, fixes root cause, and fires again.
