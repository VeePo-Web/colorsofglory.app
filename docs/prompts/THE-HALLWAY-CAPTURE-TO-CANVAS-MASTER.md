# THE HALLWAY — capture → the song room, and the hallway within Canvas mode
## The master vision + working prompt for the one corridor that decides the product

MODEL: Claude Fable 5
PRIMARY VIEWPORT: 390 × 844 (iPhone / iOS Safari), one thumb
BAR: Steve Jobs / GarageBand — relentless subtraction until only the song remains
SURFACE: Capture exit → Song Canvas (the Glory Feed) → Final listen → the open door
RE-FIRABLE: yes — each pass = audit → fix → verify → commit+push → name the next slice

============================================================
PART 1 — WHAT THE HALLWAY IS
============================================================

A songwriter hums four seconds into their phone. Everything that happens in the
next sixty seconds decides whether Colors of Glory is their instrument or their
filing cabinet.

The Hallway is that sixty seconds, made physical:

    the open mic (capture)
      → the shape rail (name it, or don't)
        → the door of a song (filing)
          → THE ROOM (the canvas feed — the hallway's interior)
            → one swipe left: the finished song (Final listen)
              → the open door (someone else walks in)

The insight that governs everything: **the canvas is not a workspace the user
operates — it is a hallway the idea travels down.** The user never "uses Canvas
mode." They follow their idea. Every screen answers one question — "where is my
idea now, and what is the one next thing?" — and every transition is the idea
visibly moving, never the user navigating.

This is why the whiteboard/map is retired on the phone (`feedModel.ts:111` —
the feed is the canvas on every device). A map asks the user to find their
idea. A hallway carries the idea past them, newest first, already sorted:
New sparks → the song's parts → Already in the song (`feedModel.ts:51-78`).

The Jobs test for every proposed control on this corridor:

> "Would a worship leader with a melody in her head and ninety seconds before
> rehearsal understand this without being taught — and does it move her idea
> one step down the hallway? If either answer is no, it does not ship."

============================================================
PART 2 — THE FIVE STATIONS (and the standard each must meet)
============================================================

STATION 1 — THE OPEN MIC (capture, already good — do not rebuild)
- One tap records. The take is safe the instant it exists (outbox + retry).
- The standard: Apple Voice Memos. Nothing before the idea is safe.

STATION 2 — THE DOOR (filing a take into a song)
- ReviewSheet / CommitRibbon → `navigate(/songs/:id/canvas?from=capture)`
  (`CaptureScene.tsx:1220`, `ReviewSheet.tsx:584`).
- The standard: ≤2 decisions (which song; optionally which part). A child can
  do it. "Add to canvas" is the only verb.

STATION 3 — THE ARRIVAL (walking into the room behind your idea)
- THE LAW OF THE LIT DOORWAY: when you arrive `from=capture`, the room must
  greet the idea you just filed — the fresh card wears a one-time warm pulse
  at the top of the feed, and the room says nothing else. You never arrive to
  a silent crowd wondering which card is yours.
- The feed model already guarantees the anchor: newest sparks sort first
  (`feedModel.ts:39-44,74`). The arrival glow rides that.
- First room ever: `RoomWelcome` teaches the metaphor once per device, in one
  breath, then dissolves forever (`RoomWelcome.tsx`). The coach tour waits —
  one bold thing, never two tips.

STATION 4 — THE HALLWAY INTERIOR (the Glory Feed — Ideas ⇄ Final)
- Two full-screen pages, one journey: IDEAS (gold, grouped by song part) ⇄
  FINAL (sage, the set list in listen mode). The pager tracks the finger and
  commits on distance or velocity (`CanvasFeed.tsx:135-202`).
- One primary action per state (LAW below). The creation dock lives on Ideas
  only; Final owns its own transport (`CanvasFeed.tsx:418-420`).
- Promoting an idea is CINEMA, not administration: swipe (or →Final) flies a
  ghost into the Final tab, the tab pulses warm, the toast offers "Hear it"
  (`CanvasFeed.tsx:109-133`). The idea moves; the user watches it go.
- The standard: GarageBand's track view — dense capability, one obvious
  gesture, chrome that recedes the moment the music starts. Then better:
  GarageBand never tells you what to do next; the hallway always does.

STATION 5 — THE FAR END AND THE OPEN DOOR
- Final plays the song top to bottom; finishing offers the next act (invite —
  "someone should hear this"), because a finished song wants ears.
- The invited person's link lands them INSIDE the room, greeted by name and
  role in plain words. Both ends of the loop are confirmed: the owner hears
  the arrival; the arrival hears where they are.

============================================================
PART 3 — THE HALLWAY LAWS (the simplicity constitution, enforced)
============================================================

LAW 1 — THE IDEA IS NEVER LOST. Every failure path (denied mic, dropped
upload, backgrounded tab, double-tap, reload mid-flow, offline) retains the
take and offers retry. A failure may pause the hallway; it may never eat the
traveler. (The stacking spine, outbox, and interruption salvage exist — every
new feature inherits this covenant before it ships.)

LAW 2 — ONE BOLD THING. At any instant the screen has exactly one gold
primary act. Two competing primaries = a defect with a file:line.

LAW 3 — ONE BOTTOM SURFACE. The bottom safe-area has exactly one owner per
state (dock / transport / recorder / sheet). `isBottomWorkflowActive` is the
single gate; any state where two bottom surfaces coexist is a P1.

LAW 4 — THE NEXT ACT IS STANDING THERE. After every completed act, the most
likely next act is one tap away: record → "Add to canvas" → arrival glow →
tap = hear it → "Layer over this" → stack shows both → swipe = it flies to
Final → "Hear it" → the song plays → "someone should hear this." Momentum,
never a dead stop. Never a form wall.

LAW 5 — TAUGHT ONCE, IN ONE BREATH. The metaphor is taught by RoomWelcome
exactly once per device, in two sentences. Everything else teaches itself by
doing what it looks like it does. If a feature needs a second sentence of
teaching, the feature is wrong, not the sentence.

LAW 6 — THE ROOM SPEAKS HUMAN. Song, idea, spark, take, layer, part, final.
Never node, edge, sync, queue, permission, conflict. Errors say what is safe
("Your recording is still here"), never what failed technically.

LAW 7 — CALM IS THE FEATURE. No red, no badges, no notification energy. A
co-writer's arrival is an announcement by ONE announcer; a change is a quiet
"what changed" briefing; encouragement (Amen) is a warmth, not a metric.

LAW 8 — EVIDENCE BEFORE CLAIMS. `npx tsc --noEmit` clean, `npx vite build`
green, `npx vitest run` green, and the walkthrough (PART 5) traced in code —
before any "done." Root causes, never symptoms.

============================================================
PART 4 — THE FEATURE COVENANTS (every feature, its hallway duty)
============================================================

Each feature exists ONLY as a stretch of the hallway. Audit each against its
covenant — a feature meeting its covenant is DONE (say so); one missing it
gets a finding with file:line.

| Feature | Its hallway duty | The covenant |
|---|---|---|
| Voice upload | The idea's feet | Take safe locally first; upload retries on 'online'; reload never orphans; temp→server id swap keeps stack links (memoKey seam) |
| Stacking ("Layer over this") | Two voices, one idea | Layer = child, never overwrite; base stays; stack plays as one mix (mute/solo); survives reload + other devices (`parent_memo_id` hydrated) |
| Transcription (F12) | The hum becomes words | Async, best-effort, never blocks; card shows words when ready; failure looks like "no words yet," never like a lost memo |
| BPM/key/chords (F13) | The idea learns its music | Quiet suggestion, never a demand; feeds metronome/chord card; absence is silence, not an error |
| Metronome/Pad | The room keeps time | One session-gated engine; never bleeds into a recording or a listen |
| Promote (→ Final) | The idea is chosen | Non-destructive; original dims to "Already in the song"; Undo in the toast; ghost-flight confirms the move visibly |
| Final listen | The song, heard | Running order = the one comparator; transport owns the bottom; finishing offers the next act |
| Collaboration/presence | The room is alive | One announcer; contributor color+name (never color alone); realtime cards arrive calmly; roster truth when not live |
| Amens | Encouragement | Device-local until backend lands; never a counter-chasing UI |
| Invite | The open door | ≤2 taps to share; invited lands INSIDE the room, greeted by name+role in plain words |

============================================================
PART 5 — THE WALKTHROUGH (the stress test, end to end)
============================================================

Run this as Jordan (worship leader, one thumb, ninety seconds), every pass:

1. Open mic → hum 4 seconds → stop. The take is visibly safe.
2. "Add to canvas" → pick the song. Count decisions (≤2).
3. ARRIVE in the room. Within 1 second, can Jordan point at their idea?
   (The lit doorway — the fresh card pulses once at the top.)
4. Tap the card → it plays. Tap "Layer over this" → sing → the stack shows
   both voices. Play the stack → both are heard, in time.
5. Swipe the card right → it flies to Final; the tab pulses; "Hear it."
6. Swipe to Final → press play → the song plays through in order.
7. The song finishes → the room offers the door ("someone should hear this").
8. NOW BREAK EVERYTHING: airplane mode at step 4 (layer queued, told the
   truth); reload at step 5 (nothing lost, stack intact); double-tap every
   primary (no duplicates); background the tab mid-recording (take salvaged);
   deny the mic (calm recovery, path to settings); second device open the
   whole time (every event arrives calmly, exactly once).

A pass fails at the FIRST step where Jordan hesitates, is lied to, or loses
work. Fix that step before looking at the next.

============================================================
PART 6 — CURRENT STATE (traced 2026-08, clean main)
============================================================

CONFIRMED WORKING (verified at file:line — do not rebuild):
- Stacking spine end-to-end: `parent_memo_id` hydrated + card built in base
  id-space (`canvasBoardSource.ts:234-292`); parent normalized at the choke
  point (`SongCanvasExperience.tsx:1269`); stack player resolves via memoKey
  with per-id offsets (`useStackPlayer.ts:276-341`); MemoSheet heals from
  server truth in memo-id space (`MemoSheet.tsx:94-157`); orphaned layers
  promote to bases (`feedModel.ts:35-36`).
- The feel pass: pager tracks the finger, commits on distance OR velocity,
  settles on cancel; one-pointer ownership (`CanvasFeed.tsx:135-202`).
- Entrance cascade assigns each card's delay once, forever (`CanvasFeed.tsx:99-107`).
- RoomWelcome: once per device, tap-anywhere/Escape/gold-button dismiss,
  reduced-motion safe, storage-blocked safe (`RoomWelcome.tsx`).
- Interruption salvage persists durably; online listener re-runs the pending
  sweep (`SongCanvasExperience.tsx:622,1545`).
- Resting layer chip on voice cards ("≡ N layers", `FeedCard.tsx:179-187`).
- webAudioOk resets; fallback transport wires to the first loaded element
  (`useStackPlayer.ts:175,341`).

THE GAP LEDGER — PASS 1 (2026-08): audited by three deep traces (voice-upload
reliability · transcription/chords · feed surface inventory). FIXED items
shipped with this doc's commit; FILED items are the next passes' work.

FIXED THIS PASS:
- H1 ✅ (P1, the lit doorway): `?from=capture` was emitted by both capture
  exits and promised in writing ("the new nodes pulse", `CommitRibbon.tsx:19`)
  but never consumed. Now: the host reads it once, strips it from the URL,
  and the writer's freshest cards greet them with one warm pulse
  (`SongCanvasExperience` arrival effect → `FeedCard` `arrived` prop).
- H2 ✅ (P0, the false "Saved"): `audioCache.set` swallowed IDB write
  failures (iOS private mode / storage pressure); enqueue then reported
  durable and DELETED the interruption fallback — a take's only copy could
  vanish behind a "Saved" toast. Now `setDurable` tells the truth,
  `enqueuePendingUpload` throws on an unconfirmed write, the salvage backup
  survives, the saved toast fires only after durability, and the failure is
  narrated honestly.
- H3 ✅ (P1, cache poisoning): `getSignedPlaybackUrl` returned `""` on a
  missing URL → `fetch("")` cached the app's own HTML under the memo id,
  permanently silencing the take. Now it throws; `audioCache.prefetch`
  refuses empty URLs and text/html bodies; the three practice-player
  fetch→cache sites guard `resp.ok`.
- H4 ✅ (P1, F12's missing heartbeat): `subscribeSongRoom` never watched
  `voice_memo_transcripts` — a solo writer's transcript completed ~30s after
  save and the card stayed wordless until reload. Now the room subscription
  re-hydrates on transcript change.
- H5 ✅ (P1, one-bottom-surface law): `isBottomWorkflowActive` was computed
  but only consumed by the retired map dock. Now the FEED dock yields to any
  bottom workflow, and WeaveBar / LineLabSheet / FinalArrangementBar are all
  map-gated with merge-parity conditions.
- H6 ✅ (P2, one gold): the active pager tab wore a solid gold fill —
  competing with Record memo for "the one thing to do." Tabs now wear their
  space's PALE tone with dark text (the Apple segmented-control register).
- H7 ✅ (P2, resting clutter): every resting voice card carried a standing
  "Layer over this" pill (6 memos = 6 CTAs). The verb moved into the
  selected action row; rest shows only the quiet "≡ N layers" state.
- H8 ✅ (P2, the wedged review): ReviewSheet awaited `requestTranscript`
  (no timeout) BEFORE starting the 45s never-dead-end poll — a stalled
  kickoff froze "Listening back…" forever. The kickoff is now fire-and-forget.
- H9 ✅ (P3 sweep): MemoSheet joins the shared focus trap (`TrappedDialog`);
  Final set-list chevrons 40→44px; RoomWelcome no longer shows viewers a
  "Start writing" they can't act on; raw backend error strings in ReviewSheet
  replaced with calm, honest copy; baseline test suite repaired (9 stale/flaky
  tests re-pinned to current, intentional contracts) and new regression pins
  added: the P0 durable-write throw (`pendingUploads.test.ts`) and the
  verbs-on-selection card contract (`FeedCard.test.tsx`).

FIXED IN PASS 2 (2026-08 — executed with the companion vision doc
THE-HALLWAY-FUNNEL-GARAGEBAND-VISION.md):
- F1 ✅ (P1, the GarageBand covenant): `FailedCapture` now carries
  `parentMemoId` + `origin`; the canvas RECLAIMS its own salvaged takes on
  room open — re-enqueued with parentage intact, flushed through the normal
  pipeline, invisible recovery. The capture scene's retry shelf no longer
  offers canvas-origin rows (no double-claim), and a take whose review sheet
  is still open this session is never reclaimed under it.
- F2 ✅ (P1): a full storage plan is narrated as a full storage plan — the
  take is safe on device, with an "Add storage" action — never "when you're
  back online" to an online writer (`isStorageQuotaError` now exported and
  branched in the canvas flush).
- F5 ✅ (P2): rows still "uploading" no longer hydrate as board mirrors — the
  uploader's device showed the same take twice for seconds, and every other
  device showed a card with no audio behind it. A card appears everywhere
  the moment finalize lands.
- F7 ✅ (P2): the REAL plan reaches the review sheet on BOTH surfaces (the
  canvas never passed `isPro` either) and the upload drop zone — a paying
  writer's transcribe toggle and upload ceiling now match what they pay for.
- F8 ✅ (P2): the threshold dropped to two chrome bands. Review + Invite
  live at the title row's right edge (iOS nav-bar register); the status line
  is mounted always for aria-live but VISIBLE only when it has something to
  say; viewers keep their one quiet line of role clarity.

FIXED IN PASS 3 (2026-08-16, the reliability tail):
- F3 ✅ (P2): the capture outbox and the seed-idea shelf CONFIRM their
  durable writes (`setDurable` + throw on refusal); every caller retains and
  narrates — CaptureScene's retention catch, SeedReviewSheet's honest toast,
  VoiceMemosPage now keeps the review open + parks a recovery copy. The
  never-eat-a-take covenant holds on every save path in the app.
- F4 ✅ (P2): the layer alignment offset rides the OUTBOX path too — the
  default uploader reads the alignment store at upload time and success
  rekeys it, exactly like the canvas pipeline. Cross-device stacks seat on
  the base's grid wherever the layer was saved.
- F6 ✅ (P2): PERMANENT server rejections (stable CogError codes only:
  INVALID_INPUT / FORBIDDEN / NOT_A_MEMBER / SONG_NOT_FOUND / SONG_DELETED /
  METHOD_NOT_ALLOWED) park the pending row — blob retained, sweeps stop
  replaying, canvas narrates the truth. Offline / quota / 5xx never park.
- F11 ✅ (P3): a transcript block the server's own segmentation flagged
  (`confidence < 0.6`) wears a quiet "worth a quick listen" cue in Review.

FIXED IN PASS 4 (2026-08-16 — THE 8-YEAR-OLD PASS; vision Part 1.5 of the
funnel doc; a full word census + a details-within-details walk of the layer
flow, executed):
- G1 ✅ (P1): the save narrator EXISTED ONLY IN NAME — SongRoomSaveToast's
  four CSS classes were defined in no stylesheet, so every "Saved to this
  song" moment rendered as an unstyled invisible div. It speaks now (fixed,
  above the sheets, safe-area aware, reduced-motion safe).
- G2 ✅ (P1): the 400ms of dead feed after "Sing over this" — the recording
  sheet now opens on the TAP (requesting-permission narrates "Opening the
  mic…"), never claiming "Recording" before it's true.
- G3 ✅ (P1): a layer take now NAMES ITS BASE the whole time ("Singing over
  'X'") and tells the guide's truth: "playing in your earbuds" or "put in
  earbuds to hear it" — never unexplained silence. The base's audio warms
  at the tap. The section chip (whose list didn't even contain "Layer") no
  longer renders for layers.
- G4 ✅ (P1): a stack that resolved NOTHING (offline) no longer flips to a
  Pause button over silence — Play disables honestly ("Can't reach this
  audio yet"), with aria-busy while decoding.
- G5 ✅ (P1, one act = one name): the layering verb is "Sing over this" on
  every surface (was "Layer over this" / "Record a layer" / spec's "Record
  over this" — three names, one tap apart). "playing now" everywhere (was
  also "sounding now"). "Record memo" everywhere (was also "Record idea").
  Solo → "Just this" ("Unsolo" is not a word). "Ideas tree"→"Ideas" in
  user-facing toasts. Arrangement arias match Final's child-parseable
  "Move earlier/later in the song."
- G6 ✅ (P2 sweep, the words contract at grade 3): count-in copy, welcome
  teaches the tab's actual name ("swipe left for Final"), sparks→ideas,
  "Just added" group, transcribe row ("Turn my words into lyrics"),
  Discard→Delete, jargon-free error copy ("we're finishing the first one"),
  keeper hint, merge/compare labels, "New order saved", try/take vocabulary
  unified, ~30s notation → words, plus the detail pass: selected verbs
  ARRIVE (180ms) instead of popping, arrival glow runs once, action labels
  never overflow, dev "Loading..." → "One moment…".
- F10 ✅ (P3): the dormant transcript→section client flow is deleted (zero
  callers; the DB RPCs remain; `git log -S` resurrects it when the sheet
  lane's UI moment arrives).

FIXED IN PASS 5 (2026-08-16 — THE SEAMLESS LAYER):
- G8 ✅: a layer's review sheet KNOWS what it is — the name defaults to
  "{base} — layer", and the section picker never renders (the destination
  line says "Goes with 'X' — both voices play together"). 3 decisions → 1.
- G9 ✅: the stack SCRUBS — seek() (built, wired to nothing) now drives a
  pointer-captured slider with keyboard arrows and spoken position. To
  re-hear the bar where the harmony lands, you drag.
- G10a ✅: CaptureSheetShell joined the shared focus trap (Tab wraps, focus
  returns) — with Escape routed through onBackdropClick, which is undefined
  during a live take, so a keyboard can never discard a recording.
- G11 (partial) ✅: gain sliders speak percentages (aria-valuetext); the
  Stop button's press state moved to CSS :active via cog-press (iOS never
  rendered the mouse-event version under a thumb).

STILL FILED FOR PASS 6+:
- F9 (P3): take_id → "hear where this line came from", held for its UI moment.
- G7 (P2): ONE persistent scrim under the layer flow's three sheet hand-offs
  (stack→record→review→stack) — the last bare-canvas flash mid-flow.
- G10b (P3): the new layer announces itself in the stack (arrival glow +
  role=status "Your layer is in the stack").
- G11 (rest, P3): earbuds toggle reachable without a BPM (hoist from
  MetronomeStrip); stop-button label during count-in ("cancel the
  count-in"); end-of-stack announcement for screen readers.

============================================================
PART 7 — SHIP PROTOCOL (Concurrent-Tree — mandatory every pass)
============================================================

`git branch --show-current` must be `main` before commit AND push · stage ONLY
this lane's files by path (never `git add -A`; never touch `.agents/`, `tmp/`,
other lanes' regions of shared files) · commit messages tell the hallway story
and end `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ·
`git -c core.autocrlf=false pull --rebase origin main` · push · stash-protect
any changes you didn't make. End every pass by naming the next slice of
hallway. Do not stop until PART 5 passes end to end with every break in step 8
surviving.
