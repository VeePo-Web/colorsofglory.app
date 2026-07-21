# Colors of Glory Canvas — World-Class Mobile UI/UX Audi

**Date:** 2026-07-21
**Scope:** `/songs/:id/canvas`, its canvas components, collaboration surfaces, and the source handoffs for Features 04, 05, 07, 09, 10, 14, and 18–23.
**Audit stance:** mobile-first collaborative songwriting, owner curation, game-quality spatial interaction, and Colors of Glory's “creative sanctuary” standard.

## Executive verdic

The Canvas has unusually strong feature breadth and several high-quality atoms: typed idea cards, safe Ideas-to-Final promotion, contributor identity, owner review, voice capture, listen paths, compare, merge, line suggestions, arrangement, recap, Amens, and reduced-motion handling. The product already understands songwriting far better than a generic whiteboard.

The primary UX molecule is not yet world-class. On a phone, the user is still operating a 1600×3200 desktop board through pan, pinch, fit, and fly-to controls. Ideas and Final are two columns on one huge coordinate plane. This architecture makes navigation itself part of the work, places too many advanced modes in the same surface, and weakens the core promise: many people can add ideas freely while the owner can calmly shape a final song.

**Current product-quality estimate:** 6.2/10 overall.

- Songwriting domain intelligence: **8.5/10**
- Breadth of useful mechanics: **8/10**
- Mobile orientation and reachability: **5/10**
- Multi-person contribution clarity: **6/10**
- Owner triage and organization: **6.5/10**
- Final-song clarity: **5.5/10**
- Safety and provenance: **7/10**
- Feature discoverability without overload: **5/10**
- Accessibility fundamentals: **7/10**, with significant gesture and focus work still required

The redesign should not add more controls. It should establish two unmistakable full-screen modes:

1. **Ideas Canvas** — the default, full-screen creative room for capture, exploration, clustering, listening, and collaboration.
2. **Final Song** — one horizontal swipe to the right, presented as an ordered, readable, playable song rather than the right half of a whiteboard.

The owner’s central loop becomes: **Receive → Review → Place → Shape → Hear → Publish**. A collaborator’s loop becomes: **Capture → Place lightly → Know it landed → Stay credited**.

---

## 1. Product model: what the Canvas must be

The Canvas is not primarily a whiteboard. It is a **song-forming game board** with asymmetric roles:

- Contributors create possibility.
- Reviewers improve precision.
- The owner creates coherence.
- Viewers experience progress without disturbing it.

Like a good cooperative game, it needs a visible goal, a legible shared state, lightweight turns, reversible moves, and clear ownership of consequential decisions. It must never feel competitive: no leaderboards, vote totals, red notification pressure, or “winning” ideas. Contributor color is provenance, not score.

### North-star experience

> Open the song and land in a full-screen field of ideas. Add anything in seconds. See where everyone’s contributions belong. Swipe right and the noise resolves into the final song.

### Non-negotiable mental model

```tex
IDEAS CANVAS  → swipe right →  FINAL SONG
explore                         decide
many voices                     one arrangemen
spatial                         ordered
non-destructive                 versioned
```

The transition must feel like moving from a studio wall into the performance sheet—not like panning to another coordinate range.

---

## 2. Evidence from the current implementation

### What is already strong

- `CanvasBoardCard` carries type, contributor, status, section, provenance, timestamps, review state, contribution type, audio metadata, and dimmed-source state. The domain object is rich enough for excellent UX.
- Ideas-to-Final preserves the source reference instead of deleting it.
- The Final tree is explicitly ordered top-to-bottom and exposes Play Final.
- Canvas cards are typed and visually differentiated rather than generic sticky notes.
- Owner review is a focused queue instead of a noisy social feed.
- What Changed can deep-link to changed cards.
- First-run capture offers meaningful verbs: Hum a melody, Write a lyric, Add chords.
- Realtime presence, invite access, roles, Amens, contributor attribution, and return recap support a real room metaphor.
- Advanced mechanics generally preserve originals: compare, merge, weave, final arrangement, and suggestions.
- Reduced motion and keyboard pan/zoom have been considered.

### Structural weaknesses

- `CANVAS_WIDTH = 1600` and `CANVAS_HEIGHT = 3200`; Ideas and Final each occupy half of the same board.
- The viewport uses `touchAction: none`, owns all gestures, and exposes pan/pinch/keyboard zoom as a `role="application"` surface.
- Mobile navigation uses `goToZone()` to fit and animate to board bounds. It is a camera move, not a stable app-level mode.
- The canvas initially zooms to `0.8`, while Fit can reach `0.25`. On a 390px phone, readable card content and whole-board orientation are inherently in tension.
- Final Arrangement is a bottom toolbar layered on top of the canvas. Final is still treated as a canvas mode, although its actual user job is ordered editing and playback.
- Per-card overflow contains high-value but conceptually different actions: weave, suggest, compare/create variant, listen path, merge, and ordering. Discoverability is low and mode switching is cognitively expensive.
- Multiple fixed bottom surfaces can exist: merge, listen path, arrangement, recording, tab/navigation chrome, and sheets. The implementation attempts collision management, but the information architecture creates the collisions.
- The current first-run coach mark teaches “left” and “right” on a large board. It explains the implementation rather than establishing the desired mobile gesture model.
- The app contains a sophisticated tool set but lacks one durable owner inbox/triage state that organizes all unreviewed contributions before spatial housekeeping is required.

---

## 3. The recommended mobile architecture

### 3.1 Two full-screen pages, one shared song

Use a horizontally paged shell with exactly two primary pages:

- Page 0: **Ideas**
- Page 1: **Final**

The canvas itself pans only inside the Ideas page. Final never lives inside the pan/zoom plane.

#### Header

- Leading: back to song catalog/workspace.
- Center: song title, save state beneath it.
- Trailing: collaborators/presence stack; tap opens Room sheet.
- Below: a compact two-state segmented control, **Ideas** / **Final**, with an animated underline.
- The segmented control is both a clear fallback and a state indicator for the swipe gesture.

#### Swipe contrac

- Horizontal swipe beginning on empty canvas space changes pages when horizontal intent exceeds vertical intent and no object drag is active.
- Swipe left on Ideas reveals Final to the right; swipe right on Final returns to Ideas. In product language, the user “swipes to the right side” to reach Final.
- A narrow gold edge glow and the word `Final` peek from the right after the first meaningful idea is added.
- Card drags, waveform scrubbing, sheet gestures, and two-finger pan/zoom win gesture priority over page swipe.
- Never require the swipe: the segmented control remains a 44px target.
- Respect reduced motion; use a 250–320ms physical page settle.

### 3.2 Ideas becomes a true full-screen canvas

The visible area from below the header to above the capture dock is entirely the Ideas field. Remove the internal Ideas/Final divider and empty right-side world.

#### Camera behavior

- Default scale is readable card scale, not whole-world scale.
- One finger pans empty space.
- One finger drags a card only after a 180–250ms hold or drag-handle contact; this prevents accidental rearrangement while scrolling/exploring.
- Two fingers pinch to zoom.
- Double tap empty space fits the active cluster; a second double tap returns to 100%.
- A small “home” compass appears only after meaningful displacement.
- Auto-frame newly created content without moving existing cards unexpectedly.
- Persist the user’s local camera separately from shared card positions.

#### Progressive spatial model

Do not start with an infinite plane. Start with **guided section neighborhoods**:

- Unsorted / Inbox
- Verse
- Pre-Chorus
- Chorus
- Bridge
- Outro
- Meaning & Scripture

These are soft magnetic zones, not rigid columns. Owners can rename or add sections. Contributors can capture without choosing; the card lands in Inbox. Spatial organization is optional at capture time and useful during curation.

### 3.3 Final becomes the final song

Final should be a full-screen ordered document with tactile section cards—not a second whiteboard.

#### Default Final view

- Hero line: `Final song` plus readiness state (`3 sections forming`, `Ready to rehearse`).
- Primary CTA: **Play from top**.
- Ordered sections, each showing section label, key lyric excerpt, chord summary, selected take, contributors, and review state.
- Between-section insertion targets appear only during Arrange mode.
- Sticky bottom actions: **Arrange** and **Open song sheet**.
- Empty state: “Your keepers will gather here” with a restrained animated arrow back toward Ideas.

#### Arrange mode

- Full-screen focused mode, not a small bottom toolbar.
- Large drag handles; press-and-lift physical feedback; auto-scroll near edges.
- Tap alternatives: Move earlier, Move later, Duplicate, Remove from Final.
- Every reorder autosaves; a single Undo snackbar names the change.
- Section repeats are explicit instances (`Chorus 2`) linked to one source section, not accidental duplicate cards.
- Preview remains available throughout.

---

## 4. Atomic and molecular feature audi

### A. Canvas shell and orientation

**Current:** technically capable pan/zoom board with Ideas/Final/Fit navigation.
**Problem:** the user must operate the camera before they can operate the song. At 390px, fitting a 1600×3200 board makes content too small; reading content makes the map disappear.
**Redesign contract:** Ideas is the only spatial plane; Final is a page. The header always communicates song, mode, save, and people. Camera controls are contextual and mostly implicit.
**Success test:** after a cold entry, 5/5 users can answer “where am I, what changed, what can I add, and where is the final song?” in five seconds.

### B. Root song card

**Current:** central root anchors branches and title.
**Value:** reinforces “one song, one room.”
**Problem:** a persistent large root consumes precious mobile map space and can become an ornamental waypoint.
**Redesign:** the header is the persistent song identity. On Ideas, use a compact movable/non-interactive “song heart” only at Home: title, key/BPM, theme/scripture, and next milestone. It becomes a re-centering anchor, not a card users must route around.

### C. First action promp

**Current:** Hum, Lyric, Chords is a strong first-run atom.
**Problem:** it omits Note/Scripture and does not teach that capture can be unsorted. The large modal/aura blocks exploration.
**Redesign:** a short bottom invitation: “What arrived?” with Voice, Lyric, Chords, Note. Scripture lives under Note’s secondary type. After first capture, dissolve into the persistent capture dock.
**Microcopy:** “Add it now. Place it later.” This removes organizational anxiety.

### D. Persistent capture dock

**Current:** capture entry points are distributed through prompt, FABs, sheets, and card actions.
**Problem:** collaborative contribution needs one stable muscle-memory location.
**Redesign:** centered gold `+ Idea` button above the safe area; press opens a radial/fan menu, hold begins voice capture after haptic confirmation. Adjacent small buttons: Inbox and Undo. Never more than three persistent controls.
**Safety:** holding must not be the only way to record; tap opens a full accessible recorder.

### E. Idea cards / fragment pipeline

**Current:** excellent type breadth and metadata.
**Problem:** cards risk displaying status, contributor, media, actions, and content simultaneously. At canvas scale this becomes visual noise.
**Redesign:** three information levels:

1. **Far zoom:** shape, type color, contributor dot, title/waveform silhouette.
2. **Working zoom:** title/body excerpt, section, contributor, play state, pending marker.
3. **Focused:** bottom sheet/full card with edit, lineage, comments, and actions.

Only one primary action appears on selection. Actions are ranked by context, not a universal menu.

### F. Card creation

**Current:** feature-specific sheets and real persistence paths exist.
**Problem:** users can be asked for metadata before the idea has safely landed.
**Redesign:** optimistic creation within 100ms. Save raw content first, then offer optional placement/name/section. A card shows `Saving…`, then `Saved in this song`; offline shows `Saved on this phone · will sync`. Never close a recorder or editor before durable local capture.

### G. Card dragging and placemen

**Current:** pointer-capture dragging writes positions and crossing toward Final is part of the model.
**Problem:** direct drag conflicts with canvas pan and with page swipe. Dragging across a 1600px divider is unsuitable on mobile.
**Redesign:** drag is exclusively for arranging Ideas. Moving to Final is a deliberate `Keep for Final` action or owner review decision. Long-press lifts the card; nearby zones magnetize; edge auto-pan is capped and predictable. Announce destination and provide Undo.

### H. Ideas → Final promotion

**Current:** preserves source and creates a dimmed reference; this is conceptually excellent.
**Problem:** “drag across” is discoverable on desktop but strenuous and ambiguous on mobile. A dimmed source can look disabled or rejected.
**Redesign:** on focus, the owner sees a gold **Keep for Final** action. Animation creates a warm thread toward the right-edge Final peek; source gains a small `In Final` link, not generic dimming. Contributors see **Suggest for Final** unless their role permits promotion. Undo is immediate and versioned.

### I. Contributor identity and live presence

**Current:** names/colors, room presence, invite, and realtime exist.
**Problem:** identity can become social-feed noise or fail contrast when color carries too much meaning. Presence does not itself show where collaborators are working.
**Redesign:** colors are secondary to initials/name. The header stack shows live people; tapping opens “In this room” with each person’s current section and role. Active card editing shows a calm outline and “Sarah is writing”; never allow silent overwrite. Presence fades after 8–12 seconds of inactivity.

### J. Collaboration Inbox / Owner Review Queue

**Current:** focused one-at-a-time review with approve, keep, dismiss, line decisions, and see-on-canvas. Strong foundation.
**Problem:** “pending” is one property among many and the owner must still infer workload from the board. Dismiss language can feel like rejecting a person.
**Redesign:** Inbox is a first-class owner destination with grouped counts by section and contributor, not red badges. Review one card at a time with:

- **Keep in Ideas**
- **Keep for Final**
- **Ask a question**
- **Set aside**

Avoid Reject/Dismiss in user-facing copy. Batch review is allowed only for safe actions such as “Mark seen.” Every decision states credit preservation.

### K. What Changed recap

**Current:** calm return sheet, real activity integration, deep links.
**Problem:** a modal on entry can interrupt immediate capture; duplicate recap paths can compete.
**Redesign:** show a non-blocking morning-card at the top of Ideas: “While you were away · 4 ideas · 1 final change.” Expand on tap. Highlight changed cards with a temporary halo after deep-link. Auto-open only when an owner has a consequential conflict or pending final decision.

### L. Voice memo and instant hum capture

**Current:** recording, review, notes, waveform, layering, melody contour, and metronome integration are substantial.
**Problem:** recording has high emotional urgency; routing through multiple sheets or controls risks lost ideas. Hold gestures exclude some users and conflict with canvas gestures.
**Redesign:** tap-to-record is canonical; hold-to-record is expert acceleration. Show one large timer, input level, section target, and `Stop`. On stop, audio is already safe; naming is optional. Allow `Save raw` immediately. Show upload/sync independently from recording success.

### M. Voice memo cards and layers

**Current:** typed cards, waveform/pitch, duration, layered takes.
**Problem:** a canvas card cannot also be a miniature DAW. Playback, stack comparison, notes, and actions compete.
**Redesign:** card has play/pause, duration, waveform, contributor, and layer count only. Tap stack opens a focused Take Stack with three verbs: **Add layer**, **Compare**, **Mark keeper**. One shared audio transport prevents simultaneous playback. Scrubbing must not trigger page swipe or card drag.

### N. One-tap metronome

**Current:** BPM is available and recorder can receive a count-in.
**Problem:** persistent metronome controls add chrome and changing the song tempo can exceed role permission.
**Redesign:** show a compact `♩ 72` chip in the header only when BPM exists; tap toggles local audition, long press/edit opens tempo sheet for permitted roles. A contributor may audition another BPM without changing the canonical song. Recording count-in is opt-in and remembers preference.

### O. Section nodes and clusters

**Current:** cards can be sectioned and dense groups can collapse into clusters.
**Problem:** clusters are a rescue mechanic for a canvas that grows without a stronger information architecture. Users may not understand whether collapsing hides work from collaborators.
**Redesign:** sections are first-class neighborhoods with title, card count, new count, play-all, collapse, and overflow. Collapse is a personal view preference; shared content remains unchanged. Dragging near a neighborhood previews placement. Inbox absorbs unsectioned ideas.

### P. Story / Scripture / Meaning zone

**Current:** supported as types/zone concepts.
**Problem:** meaning can become a miscellaneous dumping ground or visually compete with musical work.
**Redesign:** use a distinct quiet “Song heart” lane with scripture, theme, audience, and theological questions. These cards can pin to sections but do not participate in Final order. Reviewer comments can flag “meaning alignment” without using error-red.

### Q. Listen Path

**Current:** flexible queue, play/pause, step, save, collapsed/expanded bar; Play Final reuses it.
**Problem:** adding cards through overflow is slow, the fixed bar competes with other modes, and users may confuse a temporary listen path with Final order.
**Redesign:** enter a dedicated **Audition path** mode. Tapping cards numbers them directly; a single bottom transport displays the path. Name it “Audition,” never “Final.” Saving offers: `Save audition` or, for owner, `Use as Final order` with confirmation and source preservation.

### R. Compare A vs B

**Current:** context-aware compare and create-variant affordance.
**Problem:** hidden in overflow and framed as a generic action; side-by-side layouts are cramped on mobile.
**Redesign:** surface Compare automatically when a section has two plausible variants. Mobile uses one focused card area with an A/B toggle or vertical pair, a persistent shared transport, synchronized playback positions, and semantic lyric differences. Decision verbs: **Keep A**, **Keep B**, **Combine**, **Not yet**. The unchosen idea remains visible and credited.

### S. Merge and Splice

**Current:** two-card selection and merge bar create a new object with provenance.
**Problem:** selection through repeated overflow actions is undiscoverable; two-card-only selection underserves line-level songwriting; a small bar cannot preview a composite confidently.
**Redesign:** selection mode begins from `Combine ideas`. Selected cards lift into a tray. Then open a full-screen composition flow with source fragments above and live result below. Users can select lines/clips, reorder them, hear sources, and see credits before saving. The button is **Create new draft**, never Merge Save.

### T. Weave / line lab

**Current:** a differentiated line-by-line composition mechanic connects Ideas to a Final section.
**Problem:** “Weave” is beautiful brand language but opaque without explanation; switching back to Ideas while targeting Final increases working-memory load.
**Redesign:** in a Final section, `Build from ideas` opens a split-focus flow: target section fixed at top, matching idea lines in a scrollable tray below. Use “Weave” as the mode title with a plain-language subtitle. Every placed line shows source credit; swaps animate in place and Undo is granular.

### U. Line-level suggestions

**Current:** preserves original/proposed line and transmits suggestions with fallback.
**Problem:** the current action is hidden; Viewer/reviewer permission semantics need exact language; accepting a line must never obscure the original.
**Redesign:** selecting text exposes `Suggest a change`. The owner sees inline underlines and a calm count per section. Review shows Original / Suggested / Why. Actions: **Use suggestion**, **Keep current**, **Discuss**. Acceptance creates a version event and retains author attribution to both original and suggestion.

### V. Final Song view

**Current:** the Final tree is a spatial column with order numbers.
**Problem:** a finished song should read and play like a song. A card column on a zoomable board still communicates “work pile.”
**Redesign:** make the swiped-to page a clean ordered score. Cards can expand to lyrics/chords/take, but the default shows continuous song structure. Add a readiness strip: Missing lyrics, no selected take, review open—not as errors, but gentle next steps.

### W. Final Arrangemen

**Current:** fixed bottom toolbar, up/down controls, save/cancel, play final.
**Problem:** 36–40px controls miss the project’s 44px target; the bottom sheet reduces already-limited viewport space; Save/Cancel implies a fragile transaction while other parts autosave.
**Redesign:** full-screen Arrange mode with 48px targets, direct drag, tap alternatives, autosave, and Undo. Remove Save unless changes truly remain local. On exit, state is already durable. “Play from here” appears per section.

### X. Card actions and overflow

**Current:** feature-rich dynamic sheet.
**Problem:** the menu is becoming the product’s junk drawer. Different card states may produce six or more unfamiliar actions.
**Redesign:** one prominent context action, two secondary actions, then More. Rank by role and lifecycle:

- Raw idea: Play/Open, Keep for Final, Comment.
- Variant: Compare, Open, Comment.
- Final section: Open, Build from ideas, Play from here.
- Pending contribution: Review, See in context, Ask question.

Advanced actions appear only when prerequisites exist.

### Y. Amens and lightweight response

**Current:** a calm encouragement layer that feeds recap.
**Risk:** reaction mechanics can drift toward engagement metrics.
**Redesign:** one Amen per person, no competitive totals at far zoom, no push-notification pressure. Use it to communicate “I heard this,” not popularity. Owners must never treat Amen count as automated ranking.

### Z. Roles and permissions

**Current:** owner/contributor/reviewer/viewer concepts and many gates exist, but some lower-level local actions have historically bypassed capability checks.
**Redesign contract:** permissions must be stated at the verb level:

- Owner: decide Final, arrange, archive, manage roles.
- Contributor: create/edit own ideas, comment, suggest for Final.
- Reviewer: comment, suggest lines/order, approve when explicitly delegated.
- Viewer: read/listen/Amen only.

Disabled controls should generally disappear; when educationally valuable, show them with “Owner decides Final.” Server enforcement must match UI enforcement.

### AA. Save, offline, conflict, and undo

**Current:** real server paths coexist with local-first/fallback behavior.
**Problem:** collaboration trust collapses if some operations are private local truths or if “Saved” does not mean visible to others.
**Redesign:** distinguish three states clearly:

- `Saved to this phone`
- `Synced to the room`
- `Needs attention`

Queue offline work, preserve order, and show a room-level sync detail sheet. Concurrent text editing needs soft locks or merge review. Every destructive-looking action is reversible; “Set aside” replaces deletion in the primary flow.

### AB. Empty, loading, and large-room states

**Empty Ideas:** immediate capture, sample ghost cards only if clearly labeled examples.
**Empty Final:** explain the keeper flow and offer Review Inbox if pending items exist.
**Loading:** render stable header and skeleton neighborhoods; never zoom from arbitrary origin after data arrives.
**50+ cards:** cluster by section, virtualize offscreen heavy faces/waveforms, offer Search/Filter as a temporary lens, and show Home/Inbox.
**10+ collaborators:** avatar stack becomes count; roster groups Active now / Contributed / Invited.

---

## 5. Gesture arbitration: the critical mobile contrac

The product cannot be world-class until gestures are deterministic.

| Gesture           | Context                          | Result                         | Must not trigger                          |
| ----------------- | -------------------------------- | ------------------------------ | ----------------------------------------- |
| Horizontal swipe  | Empty Ideas field, one finger    | Page toward Final              | Canvas pan after page lock                |
| Horizontal swipe  | Final document                   | Return to Ideas / natural page | Section reorder                           |
| One-finger drag   | Empty Ideas field after pan lock | Pan canvas                     | Page change after vertical/spatial intent |
| Long-press + drag | Card                             | Lift and reposition card       | Page swipe or canvas pan                  |
| Drag handle       | Final section in Arrange         | Reorder section                | Page swipe                                |
| Pinch             | Ideas                            | Zoom around centroid           | Browser zoom/page swipe                   |
| Scrub waveform    | Audio card                       | Seek audio                     | Card drag/page swipe                      |
| Swipe down        | Modal sheet handle               | Dismiss when safe              | Canvas movement                           |

Implementation needs a gesture state machine, not independent handlers. Suggested states: `idle`, `pageCandidate`, `canvasPan`, `cardLift`, `cardDrag`, `pinchZoom`, `audioScrub`, `sectionReorder`, `sheetDrag`. Once intent locks, it cannot switch until pointer release.

---

## 6. Visual system direction

The current warm spectrum is compatible with the brand, but the Canvas needs stronger hierarchy than more color.

- Cream field remains dominant; gold communicates commitment and owner decisions.
- Idea types use muted tints and distinct icons/shapes; never rely on hue alone.
- Contributor colors appear as a slim provenance edge/dot, not the card’s full fill.
- Final uses cleaner white/cream cards, more serif typography, less freeform rotation, and stronger vertical rhythm.
- Pending review uses a soft breathing dot, not a badge count.
- Movement to Final uses a short gold thread/reveal, then settles. Avoid celebratory confetti; this is discernment, not gamified winning.
- Shadows communicate lifted/dragging layers only. Resting cards should feel pinned, not floating SaaS tiles.
- Minimum interactive target: 44×44px; preferred dock/record/arrange controls: 48–56px.

---

## 7. Accessibility requirements

- Avoid making the entire dense canvas a monolithic `role="application"` without an equivalent structured navigator. Provide a “List view” that exposes Ideas by section and card in normal document semantics.
- Every spatial action must have a non-drag alternative: Move to section, Move earlier/later, Keep for Final, Return to Ideas.
- Screen reader order must be meaningful independent of x/y position.
- Announce: card created, sync state, card moved to section, kept for Final, order changed, Undo availability, collaborator editing.
- Use visible focus rings and focus restoration when closing sheets.
- Trap focus in modal sheets; Escape/back dismisses only when data is already safe or after confirmation.
- Do not encode contributor, card type, review state, or Final membership by color alone.
- Waveforms require text duration and play-state labels.
- Record has tap control, not hold-only control.
- Respect reduced motion for page transitions, fly-to, pulsing, connector drawing, and drag spring.

---

## 8. Priority plan

### P0 — fix the product model

1. Split Ideas and Final into horizontally paged full-screen surfaces.
2. Remove Final from the canvas coordinate plane on mobile.
3. Make Ideas fill the screen beneath the persistent song header.
4. Introduce deterministic gesture arbitration.
5. Make Final a readable/playable ordered song with full-screen Arrange.
6. Establish explicit sync states and ensure every collaborative mutation reaches the room.

### P1 — make collaboration calm and scalable

1. Promote Inbox/Review to a first-class owner workflow.
2. Add soft section neighborhoods and an Unsorted Inbox.
3. Simplify each card to progressive disclosure.
4. Replace cross-board drag with Keep for Final / Suggest for Final.
5. Consolidate persistent bottom chrome into one context-sensitive dock.
6. Provide structured List view and all non-gesture alternatives.

### P2 — make advanced tools feel inevitable

1. Dedicated Audition Path mode.
2. Full-screen Compare and Combine flows.
3. Reframe Weave as Build from ideas with brand language retained.
4. Improve take stacking around Add layer / Compare / Mark keeper.
5. Add readiness cues and worship-handoff path in Final.

### P3 — polish and scale

1. Large-board clustering/virtualization.
2. Cross-device conflict review.
3. Spatial search and filters as temporary lenses.
4. Contextual haptics, edge affordances, and refined physical motion.
5. Instrument the core funnels and validate them with real worship-writing teams.

---

## 9. Validation plan and measurable acceptance criteria

Test at 390×844 first, then 320×568, 430×932, tablet, and desktop.

### Core usability tasks

1. A new contributor adds a voice idea without choosing a section.
2. The contributor confirms it is synced to the room.
3. The owner returns, understands what changed, and reviews three ideas.
4. The owner keeps one in Ideas, asks a question on one, and keeps one for Final.
5. The owner swipes into Final, arranges Verse–Chorus–Verse–Chorus–Bridge–Chorus.
6. The owner plays the song from top and changes the selected Chorus take.
7. A keyboard/screen-reader user completes the same structural moves without drag.

### Targets

- First idea capture initiated in **≤5 seconds** from entering an empty canvas.
- Returning owner reaches first pending idea in **≤2 taps**.
- Owner promotes an idea to Final in **≤2 taps** from focused card.
- **90%+** of test users correctly identify Ideas vs Final without instruction.
- **90%+** discover Final by segmented control; **70%+** naturally use swipe after one cue.
- Zero accidental page changes during card drag, waveform scrub, or Final reorder in 50 repeated trials.
- Zero data loss under airplane-mode capture, reconnect, refresh, and second-device verification.
- Every primary action has ≥44px target and AA contrast.
- Panning/dragging remains visually responsive at 60fps on a mid-range mobile device with 75 cards; heavy card faces outside the viewport do not render continuously.

### Instrumentation

- `canvas_opened` with role, card count, pending count, entry source.
- `idea_capture_started/saved/synced` with type and time-to-safe-save.
- `review_opened/decision_made` with non-content decision type.
- `final_view_opened` with tap vs swipe source.
- `idea_kept_for_final`, `final_reordered`, `final_play_started/completed`.
- `gesture_cancelled` categorized by conflict.
- `undo_used` by action type.
- Never log lyric/audio content in analytics.

---

## 10. Recommended information architecture

```tex
Song Canvas
├── Persistent song header
│   ├── Back
│   ├── Title + sync
│   ├── Presence / Room
│   └── Ideas | Final
├── Ideas (full-screen spatial field)
│   ├── Home / song hear
│   ├── Inbox
│   ├── Section neighborhoods
│   ├── Idea cards
│   ├── Capture dock
│   └── Context modes
│       ├── Review
│       ├── Audition
│       ├── Compare
│       ├── Combine
│       └── Build from ideas / Weave
└── Final (full-screen ordered song)
    ├── Readiness + Play from top
    ├── Ordered sections
    ├── Selected takes / lyrics / chords
    ├── Arrange mode
    └── Open song sheet / Prepare handoff
```

---

## Final recommendation

Keep the domain engine. Replace the mobile spatial shell.

The existing work has already built many of the hard songwriting primitives. The next world-class move is not another feature; it is ruthless orchestration. Ideas should feel expansive but immediately usable. Final should feel settled, readable, and playable. Collaboration should add possibility without adding owner anxiety. Every action should communicate safety, authorship, and the next meaningful decision.

If Colors of Glory adopts the two-page model—**full-screen Ideas Canvas, swipe-right Final Song**—the Canvas can become the product’s defining interaction: a living room where many voices gather, and a single song gradually comes into focus.

## Audit limitations

This report is grounded in the current source implementation, existing repository contracts/audits, and the authoritative local PDF handoffs. The in-app browser connection did not initialize during this audit, so visual/runtime observations should be followed by a dedicated 390×844 interaction pass before implementation sign-off. No production code was changed.
