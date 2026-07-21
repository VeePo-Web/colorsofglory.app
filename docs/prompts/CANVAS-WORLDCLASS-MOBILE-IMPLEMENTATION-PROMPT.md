# Colors of Glory Canvas — World-Class Mobile Implementation Prompt

Use this prompt for the next implementation phase of the Song Whiteboard Canvas. Preserve the songwriting engine and collaboration truth while rebuilding the mobile orchestration around a full-screen Ideas Canvas and a swiped-to Final Song.

## Role and quality bar

You are the principal product designer and senior React engineer for Colors of Glory, working at the interaction quality of a best-in-class cooperative creative game and the emotional restraint of an Apple-designed spiritual creative tool.

The Canvas must help many Christian songwriters contribute freely while giving the song owner calm, unmistakable control over what becomes final. It must feel alive and tactile, never technical, corporate, chaotic, competitive, or like Miro, Trello, a DAW, or a generic whiteboard.

Read before changing code:

1. `AGENTS.md`
2. `docs/CANVAS-UI-UX-WORLDCLASS-AUDIT-2026-07-21.md`
3. `docs/CANVAS-FEATURE-01-SPEC.md`
4. `docs/CANVAS-RENDER-CONTRACT.md`
5. `docs/CANVAS-FEATURES-CONTRACT.md`
6. `docs/CANVAS-COLLAB-CONTRACT.md`
7. The Product 01–14 and Feature 04/05/07/09/10/14/18–23 PDFs under `zip_extracted/20. SONGWRITING SPECIFIC PART/`

Do not implement from this prompt alone. Inspect current code, schema/persistence, capabilities, tests, and live 390×844 behavior first.

## Product thesis

```text
IDEAS CANVAS  → swipe toward the right-side destination →  FINAL SONG
explore                                                   decide
many voices                                               one arrangement
spatial                                                   ordered
non-destructive                                           versioned
```

Ideas is a full-screen creative room. Final is a full-screen readable, playable, ordered song. Final must not remain merely the right half of a 1600×3200 whiteboard on mobile.

The owner loop is **Receive → Review → Place → Shape → Hear → Prepare**.

The collaborator loop is **Capture → Know it landed → Stay credited**.

## Locked constraints

- Mobile-first at 390×844; validate 320×568 and 430×932.
- Warm cream/gold visual system and serif song identity remain locked.
- One song equals one private room.
- Originals, provenance, credits, and version memory are never destroyed by promotion, comparison, merge, or arrangement.
- Gold communicates owner commitment and primary action, not popularity.
- No red badge pressure, leaderboards, vote ranking, reaction farming, or aggressive upsell.
- Server permissions and UI capabilities must match.
- Do not replace real data with demo data, local-only truth, or fabricated audio/waveforms.
- Preserve typed cards, audio engine, review queue, recap, presence, Amens, compare, merge, Weave, Listen Path, line suggestions, arrangement, and persistence seams unless a migration is explicitly planned.
- Every spatial or drag action requires a keyboard/screen-reader/tap alternative.
- Touch targets are at least 44×44px; core capture/record/arrange targets are 48–56px.
- Respect reduced motion, safe areas, offline capture, and interrupted audio recording.

## Phase 1 — establish the two-page shell

Build a horizontally paged song interior with exactly two primary pages:

1. `Ideas canvas`
2. `Final song`

Requirements:

- Persistent header: Back, centered song title, truthful sync state, presence/Room.
- Persistent two-state control with counts and correct button/panel semantics.
- Ideas is the default page and consumes the entire work area below the header.
- Final is a separate document/arrangement surface, not a camera destination inside Ideas.
- Page swipe has horizontal-intent locking and never steals card drag, waveform scrub, pinch, section reorder, or sheet gestures.
- Segmented buttons remain the accessible and discoverable fallback.
- A restrained right-edge gold peek teaches that Final exists.
- Persist last page per song only after the first visit; never strand a new contributor in Final.
- Browser back exits the song normally; it does not step through camera positions.

Acceptance:

- 90% of uncoached testers identify Ideas vs Final in five seconds.
- Zero accidental page changes in 50 card-drag and waveform-scrub trials.
- Reduced-motion users get instant/crossfade transitions without lateral motion.

## Phase 2 — make Ideas a guided full-screen canvas

Remove the internal Final divider/column from the mobile Ideas coordinate system. Keep desktop compatibility behind responsive composition if needed.

Introduce soft, songwriting-aware neighborhoods:

- Inbox / Unsorted
- Verse
- Pre-Chorus
- Chorus
- Bridge
- Outro
- Meaning & Scripture

Rules:

- Capture never requires placement; new work can land in Inbox.
- Neighborhoods magnetize on drag but never make saving conditional.
- Collapse is a personal view preference, not shared deletion/hiding.
- Default zoom keeps cards readable. Whole-world Fit is secondary.
- One finger pans empty space; long-press or handle lifts cards; pinch zooms.
- Persist local camera separately from shared positions.
- Provide Home and List View for rescue/accessibility.
- Progressive cards: silhouette at far zoom, excerpt at working zoom, full detail in a focused sheet.

## Phase 3 — build Final as the actual song

Default Final page:

- `Final song` heading and calm readiness statement.
- `Play from top` primary action.
- Ordered sections with label, lyric excerpt, chord summary, selected take, contributors, and review state.
- Expand a section for lyrics/chords/takes without leaving the song flow.
- Empty state: “Your keepers will gather here.”
- Primary secondary actions: Arrange and Open song sheet.

Arrange mode:

- Full-screen focused mode.
- Direct drag with a large handle, edge auto-scroll, and physical lift feedback.
- Tap alternatives: Move earlier/later, duplicate instance, remove from Final.
- Autosave every move and offer one named Undo snackbar.
- Repeated choruses are explicit arrangement instances linked to a source.
- Playback remains available.
- Do not require Save/Cancel unless changes truly are not durable.

## Phase 4 — simplify capture and card actions

Create one persistent capture dock:

- Gold `+ Idea` action.
- Tap opens Voice, Lyric, Chords, Note.
- Hold may accelerate Voice only after haptic/visual confirmation; tap-to-record remains canonical.
- Nearby Inbox and Undo controls only when useful.
- Never stack multiple persistent bars/FABs.

Rank card actions by lifecycle:

- Raw idea: Open/Play, Keep for Final, Comment.
- Variant: Compare, Open, Comment.
- Final section: Open, Build from ideas, Play from here.
- Pending contribution: Review, See in context, Ask question.

Only one primary action is visible on selection. Put advanced actions under More only when prerequisites exist. Rename technical language:

- `Move to Final` → `Keep for Final`
- contributor action → `Suggest for Final`
- `Dismiss` or `Reject` → `Set aside`
- `Merge` primary CTA → `Create new draft`
- `Listen Path` user-facing mode → `Audition`
- retain `Weave` as branded title, with subtitle `Build this section from your ideas`

## Phase 5 — owner collaboration control

Make Inbox/Review a first-class owner workflow:

- Group pending work by section and contributor.
- Show a calm count, never red urgency.
- Review one at a time with Keep in Ideas, Keep for Final, Ask a question, Set aside.
- Every decision visibly preserves source and credit.
- Return recap is non-blocking unless a consequential conflict needs action.
- Deep links temporarily halo the changed card/section.
- Presence says who is active and where; editing a card gets a calm soft lock or conflict-safe alternative.

Verb-level capabilities:

- Owner: decide Final, arrange, archive, manage roles.
- Contributor: create/edit own ideas, comment, suggest for Final.
- Reviewer: comment, suggest lines/order, approve only if delegated.
- Viewer: read/listen/Amen.

Test every capability at the UI and server level.

## Phase 6 — advanced tools as focused modes

Do not layer advanced tools as competing fixed bars over the canvas.

- **Audition:** tap cards to number a temporary playback sequence; distinguish it clearly from Final order.
- **Compare:** focused A/B mobile flow with synchronized playback, lyric differences, Keep A/B, Combine, Not yet.
- **Combine:** selected fragments in a tray, live composite preview, contributor lineage before Create new draft.
- **Weave:** target Final section remains visible; matching source lines appear below; every placed line keeps credit.
- **Take stack:** only Add layer, Compare, Mark keeper at the first level.
- **Line suggestion:** Original / Suggested / Why with Use suggestion, Keep current, Discuss.

Only one focused mode owns the bottom of the screen at a time.

## Gesture state machine

Implement or consolidate one gesture arbiter with states:

`idle`, `pageCandidate`, `canvasPan`, `cardLift`, `cardDrag`, `pinchZoom`, `audioScrub`, `sectionReorder`, `sheetDrag`.

Once intent locks, it cannot switch until pointer release/cancel. Define thresholds centrally. Add automated tests for gesture conflicts and manual device trials. Do not scatter competing handlers across components.

Gesture contract:

| Gesture           | Context           | Result               | Must not trigger                 |
| ----------------- | ----------------- | -------------------- | -------------------------------- |
| Horizontal swipe  | Empty Ideas field | Page toward Final    | Canvas pan after page lock       |
| Horizontal swipe  | Final document    | Return toward Ideas  | Section reorder                  |
| One-finger drag   | Empty Ideas field | Pan canvas           | Page change after spatial intent |
| Long-press + drag | Idea card         | Lift and reposition  | Page swipe or canvas pan         |
| Drag handle       | Final Arrange     | Reorder section      | Page swipe                       |
| Pinch             | Ideas             | Zoom around centroid | Browser zoom/page swipe          |
| Waveform scrub    | Audio card        | Seek                 | Card drag/page swipe             |
| Sheet handle drag | Open sheet        | Dismiss when safe    | Canvas movement                  |

## Data safety and collaboration truth

Use three honest states:

- Saved to this phone
- Synced to the room
- Needs attention

Every operation teammates must see must persist to shared room truth. Queue offline work, preserve ordering, reconcile after reconnect, and never call local-only success “Synced.” Promotions, line acceptance, merge results, review decisions, audition/arrangement saves, section moves, and card positions must survive refresh and appear on a second device.

Conflict requirements:

- Never silently last-write-wins over another active editor.
- Show who is editing and offer a conflict-safe review when needed.
- Preserve both versions before resolution.
- Undo must be scoped, named, and durable where the underlying action is shared.

## Accessibility

- Provide normal semantic List View alongside the spatial canvas.
- Meaningful reading order independent of x/y.
- Non-drag controls for every move/reorder.
- Visible focus, focus trap in modal sheets, and focus restoration on close.
- Announce create, sync, move, promotion, reorder, collaborator edit, and Undo.
- Color is never the sole carrier for type, contributor, review, or Final status.
- Audio has text duration/play state; recording is not hold-only.
- Avoid a monolithic `role=application` unless the structured alternative is immediately available.
- Support screen readers, keyboard, switch input, 200% text zoom, and reduced motion.

## Visual and motion direction

- Cream field stays dominant; gold means commitment and owner choice.
- Card type uses muted tint plus icon/shape; contributor identity is a narrow edge/dot plus name.
- Final is calmer than Ideas: more serif, less rotation, stronger vertical rhythm.
- Pending review uses a warm dot or halo, never error-red.
- Moving to Final draws a brief gold thread toward the right-side destination and settles without confetti.
- Shadows communicate active lift only; resting cards feel pinned.
- Page transitions: 250–320ms with physical settle; crossfade/instant under reduced motion.

## Performance

- Maintain visually responsive 60fps interaction on a mid-range phone with 75 cards.
- Do not rerender all card faces on presence, audio step, or unrelated sheet changes.
- Virtualize or cull expensive offscreen faces and waveform detail.
- Memoize stable card interactions and selectors.
- Keep route and interaction bundles within existing canvas budgets; lazy-load focused modes.
- Animate transforms/opacity, not layout properties, during pan/drag/page settle.
- Avoid initial whole-board zoom that makes text unreadable.

## Required product analytics

Instrument without logging lyrics or audio content:

- `canvas_opened`: role, card count, pending count, entry source.
- `idea_capture_started`, `idea_saved_local`, `idea_synced`: type and time-to-safe-save.
- `review_opened`, `review_decision_made`: decision type only.
- `final_view_opened`: tap or swipe source.
- `idea_kept_for_final`, `final_reordered`, `final_play_started/completed`.
- `gesture_cancelled`: conflict category.
- `undo_used`: action category.

Targets:

- First capture starts within 5 seconds of entering an empty song.
- Returning owner reaches the first pending item in at most 2 taps.
- Owner keeps a focused idea for Final in at most 2 taps.
- 90%+ correctly identify Ideas vs Final without instruction.
- Zero accidental page changes during drag, scrub, or reorder in 50 repeated trials.
- Zero data loss across airplane-mode capture, reconnect, refresh, and second-device verification.

## Required verification

Before completion:

1. Typecheck, lint, targeted canvas tests, build, and bundle budget.
2. Runtime at 390×844, 320×568, 430×932, and tablet.
3. Real/fake-auth degraded state plus a real human-auth collaborative session.
4. Two-device tests for capture, review, promotion, edit, arrangement, and reconnect.
5. Voice capture interruption and microphone-permission denial.
6. Screen reader/List View and keyboard-only structural editing.
7. Reduced motion and high text zoom.
8. Record screenshots/video for Ideas, edge transition, Final, Review, Arrange, Compare, and offline sync.

## Implementation discipline

- Start with an evidence-backed plan and list files/data migrations before editing.
- Work in vertical slices; keep the current product usable between phases.
- Do not combine the mobile shell rewrite with unrelated feature additions.
- Reuse current data models and engines; migrate deliberately where the mobile page split demands it.
- Add tests with each gesture/state contract, not after the visual work.
- After editing multiple TSX components, run the React quality checklist for component boundaries, hooks, accessibility, stable props, and list keys.
- Document any behavior intentionally deferred and ensure its control is not visible prematurely.

## Definition of done

The work is done only when a new collaborator can contribute in seconds, the owner can understand and review a busy room without housekeeping anxiety, Final reads and plays like a real song, every consequential decision is safe and credited, and no user must learn a whiteboard tool to write worship music.

Do not chase feature count. Remove friction, competing chrome, ambiguous verbs, and hidden state until the two core loops feel inevitable.
