# CANVAS — Voice-of-Customer + World-Class UI Dossier
## Research-only handoff → the Canvas Architect lane (from the Collaboration & Song Memory lane)
## Subject: the Song Whiteboard Canvas (multiplayer group-songwriting room)

> Produced via the `/research` VoC method (Fitzpatrick/Ulwick/Dunford). **Nothing in the Canvas lane was
> touched** — this is a sourced research gift. Findings carry working links; Reddit/FB are uncrawlable by the
> agent, so community sentiment is filed as **Hypotheses (§8)**, never fabricated. Build decisions remain the
> Canvas lane's; this dossier stops at evidence.

---

## 1. EXECUTIVE SUMMARY

**The single most important strategic finding:** the market independently confirms the Canvas Architect's
anti-Miro thesis. A literal infinite canvas **fails on mobile and overwhelms non-creators** — and the prescribed
remedy is exactly COG's model. From a canvas-UI critical review:

> *"On the very devices built for pinching, swiping, and tapping, the canvas is decidedly a second-class
> citizen."* … infinite canvases *"encourage accumulation without structure,"* suffer *"spatial memory
> failure"* (*"no start and end points standardised by the format"*), and the fix is to *"consider structural
> alternatives — columns, stacks, or nested lists — instead of literal canvas mechanics."*
> ([joodaloop — Canvas UIs: A Critical Review](https://joodaloop.com/canvas-ui/))

COG's **root-song-center → Ideas branches → owner-controlled Final tree** *is* that structural alternative. The
research says: **hold this line hard.** The canvas's value is the *branching metaphor on top of imposed
structure*, never a free-floating infinite plane.

**Top moves (ranked, §2):**
1. **Keep it FigJam-simple, not Miro-complex** — the #1 differentiator. FigJam wins because it's "Miro stripped to the core"; clients "understand FigJam better than Miro."
2. **Structure beats space on mobile** — semantic zoom / zone-jumps + stacks/tree, NOT free pan-zoom (touch's worst interaction). This is the make-or-break mobile decision.
3. **Multiplayer co-writing memory is the moat** — 82% of CCLI Top 100 are co-written; no competitor (Hum, Music Memos, Songspace) is a true multiplayer branching song-room with voice stacking + clean Final.
4. **Voice-memo stacking ("record over this")** is the unserved, song-native superpower — nobody does layered reply-by-audio.
5. **Lossless multiplayer** (CRDT-style, per-user undo, spring cursors) — table stakes for "many hands, nobody's idea lost."

---

## 2. RANKED DESIGN-PRIORITY TABLE (Demand = Freq × Pain × WTP × Buildability)

| # | Design move | Freq | Pain | WTP | Build | Why it wins | Evidence |
|---|---|---|---|---|---|---|---|
| 1 | **Structure-first canvas (tree + zones), NOT free infinite plane** | Very high | **Very high** | Indirect (retention) | Med | Solves the documented canvas-fails-on-mobile + overwhelm problem | [joodaloop](https://joodaloop.com/canvas-ui/) |
| 2 | **FigJam-grade simplicity (one obvious action, tutorial-free)** | Very high | High | Indirect | Med | "Miro's MVP… in a good way"; non-tech users "understand FigJam better" | [Miquido](https://www.miquido.com/blog/figjam-vs-miro/), [Startup House](https://startup-house.com/blog/figjam-vs-miro) |
| 3 | **Multiplayer presence + lossless conflict (CRDT, per-user undo)** | High | High | Indirect (team seats) | High | "Many hands, one song"; co-writing is the norm (82%) | [Liveblocks](https://liveblocks.io/multiplayer), [Baptist Standard](https://baptiststandard.com/news/faith-culture/most-hit-worship-songs-are-a-team-effort/) |
| 4 | **Voice-memo stacking ("record over this" layered takes)** | Med-high | High | **Direct-ish** | High | Song-native, unserved; turns audio into reply-by-audio | competitor gap (Music Memos/Hum are single-take capture) |
| 5 | **Compare mode (Chorus A vs B) + clean Final arrangement** | Med | Med | Indirect | Med | Non-standard arrangements are real craft; discernment needs A/B | [MusicRadar](https://www.musicradar.com/how-to/song-sections-explained-intro-verse-chorus-middle8-outro-tag-bridge) |
| 6 | **Quick-duplicate to explore variations** | Med | Med | Indirect | Low | The one canvas affordance the critic says to *steal* | [joodaloop](https://joodaloop.com/canvas-ui/) |

---

## 3. WORLD-CLASS UI BENCHMARKS — STEAL vs AVOID (the heart of this dossier)

| Benchmark | STEAL | AVOID |
|---|---|---|
| **FigJam** ([Miquido](https://www.miquido.com/blog/figjam-vs-miro/)) | Minimal, large/obvious tools; "playful UX → better engagement with non-technical participants"; flow-preserving | Its open-plane freeform for serious branching (gets messy) |
| **Miro** ([Startup House](https://startup-house.com/blog/figjam-vs-miro)) | Clustering/synthesis power (conceptually) | The overwhelm — "spend more time figuring out how to use it than collaborating." **This is the cautionary tale.** |
| **tldraw** ([tldraw.dev](https://tldraw.dev/), [TechCrunch](https://techcrunch.com/2022/12/16/tldraw-offers-a-collaborative-whiteboard-without-any-login/)) | The infinite-canvas SDK that powers ClickUp/Padlet; no-login instant collab; "arrows are amazing"; a real **build-vs-buy** option for the canvas engine | Generic whiteboard framing — COG is song-native, not a diagram tool |
| **Apple Freeform** ([guide](https://nerdymomocat.github.io/posts/a-quick-guide-to-apples-freeform-app/)) | Simple, fast, on every device; calm; Pencil on iPad | Still desktop/iPad-first; not a multiplayer creative *system* |
| **Muse** ([Metamuse 59](https://museapp.com/podcast/59-infinite-canvases/)) | Thoughtful spatial canvas, calm taste | Niche Apple-only; spatial-memory-dependent |
| **Liveblocks** ([multiplayer](https://liveblocks.io/multiplayer), [cursor animation](https://liveblocks.io/blog/how-to-animate-multiplayer-cursors)) | **Spring-physics cursors** (stiffness/damping = organic); **100ms default throttle (16ms = 60fps)**; **per-user undo stack**; **CRDT concurrent edits** | Building presence from scratch — these are solved patterns to mirror |

**The synthesized rule for COG's canvas:** *FigJam's calm + Apple's gesture craft + Liveblocks' lossless multiplayer, on top of a structured tree (not Miro's infinite plane), with semantic-zoom instead of free pan/zoom on mobile.*

---

## 4. JOBS & TRIGGERS (JTBD)

- **When** we're co-writing and ideas are flying, **I want** every fragment (a hum, a line, a chord) captured as its own card on the song, **so I can** explore branches without losing anything. → *Idea cards + capture-first.*
- **When** I have a melody idea over someone's memo, **I want** to record *on top of* their take, **so I can** answer with audio instead of explaining. → *Voice stacking.*
- **When** we have two choruses, **I want** to hear A vs B back-to-back, **so I can** decide together. → *Compare mode.*
- **When** the room gets busy, **I want** the Final to stay clean and owner-controlled, **so I can** branch freely without wrecking the arrangement. → *Ideas/Final separation.*
- **When** I'm on my phone at rehearsal, **I want** to move through the song by zones/jumps, **so I** never fight pan-and-zoom. → *Semantic zoom, mobile.* ([joodaloop](https://joodaloop.com/canvas-ui/))

---

## 5. COMPETITOR / SWITCH MAP

| Tool (what songwriters use now) | The gap (sourced) | Implies for COG canvas |
|---|---|---|
| **Music Memos / Hum** | Single-player idea capture (auto tempo/chord, Dropbox sync) — **no multiplayer, no branching, no Final** ([Church Production](https://www.churchproduction.com/education/best-apps-for-worship-leaders/)) | The multiplayer branching room is the whitespace |
| **Songspace** | Collaborative *feedback/playlists/pitch tracking* — a library/feedback layer, **not a live branching writing canvas** ([Church Production](https://www.churchproduction.com/education/best-apps-for-worship-leaders/)) | Live co-writing room, not asset management |
| **Miro / FigJam** | Generic whiteboards — overwhelm (Miro) or non-song-native (both) ([Startup House](https://startup-house.com/blog/figjam-vs-miro)) | Song-native cards + tree, not sticky notes |
| **Slack + Trello + voice memos (the real stack)** | The scattered-tools problem itself ([Church Production](https://www.churchproduction.com/churchdesign/best-apps-for-worship-leaders/)) | One room replaces the 3-app scramble |

---

## 6. CUSTOMER LEXICON (verifiable phrases — feed `/hero` + `/convert`, not edited here)

- "the collective voice is much stronger than the individual voice" (co-writing value)
- "bring a gift to the party" (co-writing etiquette → contributor framing)
- "each person should have a specific role" (validates roles in the room)
- "burst writing" (10-min individual idea bursts → quick-capture cards)
- "a team effort" / "82% co-written" (collaboration is the norm)
- "second-class citizen" on touch (the mobile-canvas pain to defeat)

---

## 7. MULTIPLAYER ENGINEERING BENCHMARKS (for the Canvas lane's presence layer)

From Liveblocks (mirror the patterns, not necessarily the vendor):
- **Cursors:** spring physics (stiffness/damping) for organic motion; throttle 100ms default, 16ms for 60fps where it matters. ([cursor animation](https://liveblocks.io/blog/how-to-animate-multiplayer-cursors))
- **Presence:** ephemeral per-user state (cursor, selection, "in this room"); split into a new "room" when one gets too busy. ([presence](https://liveblocks.io/presence))
- **Conflict:** CRDTs under the hood for concurrent edits; **per-user undo stack** (like Google Docs) — critical for "nobody's idea is lost." ([multiplayer](https://liveblocks.io/multiplayer))

---

## 8. AUTOMATION / DESIGN RISK REGISTER

| Risk | Why | Mitigation (research-backed) |
|---|---|---|
| **Canvas becomes Miro** (the #1 failure mode) | Infinite plane → accumulation without structure → overwhelm | Impose structure: root song + Ideas/Final tree; FigJam-simple surface ([joodaloop](https://joodaloop.com/canvas-ui/), [Miquido](https://www.miquido.com/blog/figjam-vs-miro/)) |
| **Mobile pan/zoom hell** | Touch is "second-class" at canvas's core interactions | Semantic zoom / zone-jumps / stacks, not free pan-zoom ([joodaloop](https://joodaloop.com/canvas-ui/)) |
| **Spatial-memory reliance** | No enforced permanence → only the creator can navigate | Anchor everything to the song tree; don't rely on remembered positions |
| **Lost contributions in multiplayer** | Concurrent edits clobber | CRDT + per-user undo + optimistic-then-reconcile ([Liveblocks](https://liveblocks.io/multiplayer)) |

---

## 9. HYPOTHESES (plausible, NOT yet evidenced — Reddit/FB uncrawlable by agent)

- **H1**: Worship co-writers lose *audio* ideas (hums/melodies) far more than lyric ideas between sessions — audio is hardest to organize. → *Confirm: r/worshipleaders, r/Songwriting, App Store reviews of Music Memos/Hum.*
- **H2**: The "record over this" layered take is a wow-moment that drives word-of-mouth among worship teams. → *Confirm: worship songwriting FB groups, demo reactions.*
- **H3**: Teams want a single shared "song room" specifically to escape the Slack+Trello+voice-memo scramble. → *Confirm: worship-tech buyer interviews.*
- **H4**: On mobile, users prefer tapping a zone/section to jumping there over pinch-zoom navigation. → *Confirm: usability test of semantic-zoom vs free-pan prototypes.*

---

## 10. HANDOFFS (research stops here)
- Lexicon (§6) → `/hero`, `/convert`.
- Build decisions (§2, §3) → the **Canvas Architect lane** + `/canvas` / `/feature`. I do not build in that lane.
- Multiplayer patterns (§7) → Canvas lane + Lovable (realtime backend).
- Hypotheses (§9) → confirm via the named (uncrawlable) communities.

## 11. SOURCES
- [joodaloop — Canvas UIs: A Critical Review](https://joodaloop.com/canvas-ui/) *(the key strategic source)*
- [Miquido — FigJam vs Miro (designer view)](https://www.miquido.com/blog/figjam-vs-miro/) · [Startup House — FigJam vs Miro](https://startup-house.com/blog/figjam-vs-miro)
- [tldraw.dev](https://tldraw.dev/) · [TechCrunch — tldraw](https://techcrunch.com/2022/12/16/tldraw-offers-a-collaborative-whiteboard-without-any-login/)
- [Apple Freeform guide](https://nerdymomocat.github.io/posts/a-quick-guide-to-apples-freeform-app/) · [Metamuse — Infinite Canvases (Steve Ruiz)](https://museapp.com/podcast/59-infinite-canvases/)
- [Liveblocks — Multiplayer](https://liveblocks.io/multiplayer) · [Cursor animation](https://liveblocks.io/blog/how-to-animate-multiplayer-cursors) · [Presence](https://liveblocks.io/presence)
- [Worship Leader — Collaboration in Worship Songwriting](https://worshipleader.com/outreach/education/collaboration-and-community-in-worship-songwriting/) · [Worship Ministry Training — co-write with a group](https://www.worshipministrytraining.com/how-do-i-co-write-a-worship-song-with-a-group-of-songwriters/)
- [Church Production — Apps for Worship Leaders](https://www.churchproduction.com/education/best-apps-for-worship-leaders/) · [Baptist Standard — 82% co-written](https://baptiststandard.com/news/faith-culture/most-hit-worship-songs-are-a-team-effort/)
- **Could NOT verify (agent-blocked):** Reddit (r/worshipleaders, r/Songwriting, r/WeAreTheMusicMakers), Facebook worship-songwriting groups → §9.
