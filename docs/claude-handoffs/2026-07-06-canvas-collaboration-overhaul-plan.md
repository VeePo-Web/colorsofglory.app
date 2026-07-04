# Song Whiteboard Canvas — Collaboration & UX Overhaul: 5–7 Step Plan (with ready-to-run prompts)

**Date:** 2026-07-06 · **Scope:** the canvas (`src/components/canvas/*`) — where the song is
actually written and where people collaborate. Reported: "none of the features work, UI/UX
terrible, feels awful." · **Note:** `SongCanvasExperience.tsx` (~2000 lines) is under **active
concurrent overhaul** by another agent — each step below is written as a **self-contained,
dispatchable prompt** so work parallelizes without colliding rewrites. Do the steps in order;
verify each before the next.

---

## The vision (from the COG docs — the bar every step is held to)

- **The song is the interface; the canvas disappears behind the idea.** One root song at the
  center, ideas branch around it. NOT Miro, NOT a DAW, NOT a dashboard, NOT "nodes/edges".
- **Ideas branch freely; Final stays clean.** Two emotionally distinct surfaces + Compare.
- **Capture before organize.** An idea is saved the instant it's made; metadata comes after.
- **Add-to-Final is non-destructive and keeps lineage** (source idea, contributor, timestamp,
  credit all survive).
- **The room is multiplayer by default** — real presence, contributor color+name, optimistic
  writes, lossless conflict ("review both versions"), owner-controlled Final, credit memory.
- **Copy-link invite is one tap** and the payoff is *seeing the person arrive in the room*.
- **Powerful in reserve, calm on the surface. Instant.** Mobile-first, thumb-first.

## World-class collaboration research (what to steal, what to avoid)

| Product | Steal | Avoid |
|---|---|---|
| **Figma / FigJam** | Live cursors w/ name+color; "share = copy link" as the default; presence avatars top-right; follow-a-collaborator | Dense toolbars, infinite-canvas disorientation |
| **Liveblocks (presence infra)** | Optimistic local writes + reconcile; conflict = keep both; presence as first-class | — |
| **Google Docs / Notion share** | Copy-link-first hierarchy; role picker *secondary* to the link; "N people here" | Permission jargon ("scope", "ACL") |
| **Apple Freeform** | Calm board, direct manipulation, "jump to what changed", bottom-sheet detail | — |
| **Apple Voice Memos / Music** | Tactile cards, one obvious action, arrival/confirmation moments | — |

**The through-line for a songwriter:** I should always know (1) *where I am* (which surface),
(2) *who's here* and *what changed since I left*, (3) *how to bring someone in* (one tap → link),
and (4) that *my contribution and everyone's is safe and credited*. Friction in any of these
makes the room feel broken.

---

## Ideal-customer friction audit (as a songwriter in a co-write)

- **Nav between collaboration surfaces is a flat 6-tab strip** (Canvas/Lyrics/Voice/Chords/Notes/
  People). It doesn't tell me *where the action is* — no unread/changed indicators per surface,
  no sense of "3 new voice memos" or "someone's in Lyrics right now". Switching feels like
  tabs, not like moving around one shared room.
- **"People" is a destination tab**, not an ambient presence you feel everywhere. Presence should
  be felt on the board (cursors/avatars), not only on a tab.
- **Inviting** works (ShareSongSheet is genuinely good — copy-first, role-cached), but its
  *entry point* and the *arrival payoff* need to be unmissable and celebrated.
- **Card actions** (the reported "features don't work"): every card's tap/drag/•••/add-to-Final
  must be consistent and reliable; today they're spread across many sheets (CardActions, CardEdit,
  Compare, LineSuggestion, ReviewQueue, WhatChanged) with uneven behavior.
- **"What changed since you left"** exists (WhatChangedRecapSheet) but must be the *first thing*
  a returning collaborator sees, calm and one-tap-to-jump.

---

## The 5–7 steps (each is a ready-to-run prompt)

### STEP 1 — Collaboration-aware navigation (the room, not tabs)
**Prompt:**
> In `SongCanvasExperience.tsx`, rework the layer switcher (`LAYERS`) so it reads as *moving
> around one shared room*, not flat tabs. (a) Add a quiet per-surface **signal** — a small gold
> dot / count when a surface has unseen changes (new voice memos, new lyric lines, pending
> suggestions), sourced from the same activity the WhatChanged recap uses; never a red badge.
> (b) Show **live presence per surface** — if a collaborator is currently in Lyrics, their color
> dot rides that tab. (c) Keep it thumb-reachable and calm; the active surface is obvious in <1s.
> Persist last surface per song. Verify: switching surfaces feels like walking the room; changed
> surfaces are glanceable; `tsc` + build green; no red badges.

### STEP 2 — Copy-link invite: unmissable entry + celebrated arrival
**Prompt:**
> Make bringing someone in the most obvious action in the room. Keep `ShareSongSheet` (already
> copy-first) but: (a) ensure the **Invite** entry is a persistent, high-visibility affordance in
> the canvas header (not buried), with first-run coach mark. (b) The sheet leads with **one giant
> "Copy invite link"** (link pre-minted on open, clipboard write inside the gesture), role picker
> secondary, native **Share** as a second button. (c) Wire the **arrival moment**: when the
> invited person joins (presence), everyone sees a calm "Sarah just joined" and her avatar lands
> in the stack. Verify on two devices: copy link on A → open on B → A sees B arrive within ~2s;
> clipboard works on iOS Safari (inside gesture); reduced-motion safe.

### STEP 3 — Presence you feel everywhere (not a tab)
**Prompt:**
> Surface `useSongPresence` as ambient presence on the board: (a) a top-right **avatar stack** of
> who's here now (color+name+initials), (b) optional **live cursors/labels** for others on the
> canvas, (c) tap an avatar → **jump to that person's latest idea** (the `onJumpTo` already exists
> in ShareSongSheet — promote it to the header stack). Keep "People" as the roster/credits detail,
> but presence must be felt without opening it. Verify: with 2+ present, the stack is always
> visible; jump-to-person pans/zooms smoothly; solo user sees no clutter.

### STEP 4 — One reliable card interaction model (fix "features don't work")
**Prompt:**
> Audit every card type (Lyric/Voice/Hum/Chord/Note/Section) + the root song card for a **single
> consistent interaction grammar**: tap = open detail bottom-sheet; press-and-hold or ••• = one
> actions sheet (not 6 divergent ones); drag = move (role-permitted, with tap/menu fallback);
> primary action always visible. Consolidate the scattered sheets behind one predictable
> `CardActionsSheet`. Every action (rename, add-to-Final, record-over, suggest line, move zone,
> archive) must actually fire, be optimistic, and never lose data. Verify each action end-to-end;
> top-2 failure paths (double-tap, offline) confirmed; `tsc`+build+tests green.

### STEP 5 — Ideas → Final, non-destructive, with lineage & credit
**Prompt:**
> Make the core creed real: **Add-to-Final copies/links, never moves or deletes** the source
> idea; the original stays (dimmed "Used in Final"); every add writes a `SourceLink` +
> `VersionEvent`, preserves `sourceIdeaIds` + `contributorIds`, and offers **Undo** (calm 6–8s
> toast, never a scary modal). Contributors *suggest* for Final ("Suggested — waiting for owner
> review"); only the owner promotes. Conflicts say "the arrangement changed — review the latest
> version", never "version conflict". Verify: add-to-Final keeps the source; credit follows the
> idea; owner-gating holds; undo restores exactly.

### STEP 6 — "What changed since you left" as the returning-collaborator homepage
**Prompt:**
> Promote `WhatChangedRecapSheet` to auto-surface (calm, dismissible) the first time a
> collaborator opens a room with unseen activity: "3 new ideas · Sarah added a bridge · 1 needs
> your review", each row one-tap-to-jump. Sourced from the real activity/version events; content-
> free analytics. Verify: returning after changes shows the recap once; jumping lands on the
> exact card; no recap when nothing changed.

### STEP 7 — Visual overhaul + instant performance + stress tests
**Prompt:**
> Bring the whole board to Fantasy.co × Apple calm: COG tokens only, cream/charcoal/restrained
> gold, one soft elevation, generous space, serif song title; connectors 1–1.5px muted curves;
> motion confirms (no toy springs/confetti/pulsing). Performance: animate only transform/opacity,
> rAF for any meters, release decoders off-screen, `100dvh`/safe-area, 48px targets. **Stress
> tests (must pass):** dropped network mid-write (retain+retry), backgrounded tab, double-tap,
> 5+ simultaneous collaborators, offline edit then reconnect (lossless), reduced-motion, low-end
> Android. Verify with `tsc`+`vite build`+tests and the top failure paths confirmed in code.

---

## Sequencing & ownership
- **Order:** 1 → 2 → 3 (collaboration nav + invite + presence: the "main part") first, then 4 → 5
  (interaction reliability + Ideas/Final creed), then 6 → 7 (recap + visual/perf/stress).
- **Concurrency:** coordinate with the agent overhauling `SongCanvasExperience.tsx`; prefer
  landing each step as a focused commit and rebasing often. Leaf components (ShareSongSheet, the
  card sheets, presence hooks) are safer to edit in parallel than the 2000-line experience file.
- **Gate every step:** `npx tsc --noEmit` + `npx vite build` green, top-2 failure paths verified,
  and the real path walked on two devices for anything multiplayer.

**North star:** a songwriter opens the room and instantly knows where they are, who's here, what
changed, and how to bring someone in — and every idea they or anyone adds is safe, credited, and
one tap from becoming part of the song.
