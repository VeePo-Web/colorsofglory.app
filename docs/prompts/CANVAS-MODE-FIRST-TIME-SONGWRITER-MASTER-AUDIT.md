# COLORS OF GLORY - CANVAS MODE
## First-Time Songwriter Audit, Feature Orchestration Review, Collaboration Review, and Radical-Simplicity UX Upgrade

MODEL: Claude Fable 5
PRIMARY VIEWPORT: 390 x 844
SECONDARY VIEWPORTS: 360 x 800, 430 x 932, 768 x 1024, 1440 x 900
IMPLEMENT_CHANGES: true
PUBLISH_CHANGES: false unless explicitly requested
PRIMARY SURFACE: Song Canvas Mode
PRODUCT: Colors of Glory

============================================================
PART 1 - THE SINGLE OBJECTIVE
============================================================

You are Claude Fable 5.

You have exactly one objective:

Make Colors of Glory's Canvas Mode the simplest, calmest, most useful, most visually coherent, and most deeply connected way for a songwriter to turn scattered song ideas into a song - alone or with collaborators - without making the songwriter feel like they are operating whiteboard software.

Pursue this objective through four distinct modes, in this exact order:

1. First-Time Songwriter
2. Evidence-Based Product and Usefulness Auditor
3. Interaction and Information Architect
4. Conservative UX/UI Implementer

Do not skip a mode.

Do not start by rearranging controls from source-code assumptions.

Do not stop at an audit, wireframe, or report. After finding evidence-backed friction, simplify and integrate the experience, implement the smallest cohesive improvements, verify them at runtime, and report the result.

The Canvas has a sacred product promise:

Scattered inspiration becomes one visible song, and the songwriter always knows the next useful move.

The Canvas must help the user move through this natural songwriting arc:

Capture
-> see the idea
-> understand where it belongs
-> focus on one fragment
-> develop or compare it
-> preserve alternatives
-> move a keeper toward Final
-> shape the arrangement
-> collaborate without chaos
-> review decisions
-> return later and remember why the song became what it is

At first glance, the user must be able to answer:

- What song am I inside?
- Am I exploring Ideas or shaping Final?
- What is the one most useful action right now?
- Which objects are lyrics, voice memos, hums, chords, sections, notes, Scripture, or meaning?
- Who contributed each idea?
- Which work is new, pending, saved, playing, selected, kept, or already in Final?
- What happens if I tap a card?
- Can I experiment without changing the final song?
- Is the original still safe if I compare, merge, replace, move, archive, or restore something?
- Where do collaboration, review, activity, versions, and credits fit?
- How do I get back to the song after entering a focused workflow?

If the answer requires a tutorial, a hidden gesture, reading several equal-weight controls, understanding graph terminology, or remembering how multiple bottom bars interact, there is friction to investigate.

The final result must feel useful before it feels powerful.

============================================================
PART 2 - NON-NEGOTIABLE PRODUCT TRUTH
============================================================

Colors of Glory is a mobile-first songwriting collaboration app for Christian songwriters, worship leaders, musicians, producers, and creative teams.

Its central promise is:

Everything for this song stays connected here.

The Canvas is not:

- Miro for songwriters.
- Figma with song cards.
- A generic mind map.
- A sticky-note wall.
- A project-management board.
- A dashboard of every possible tool.
- A DAW, mixer, track timeline, or notation workstation.
- A place where users must spatially organize an idea before it is saved.
- A collection of unrelated advanced features competing for attention.
- A novelty graph that looks impressive but does not help finish a song.
- A substitute for focused Lyrics, Voice, Notes, Credits, Activity, or Version surfaces when those jobs need deeper space.

The Canvas is:

- One private song room.
- A visible map of raw ideas and chosen direction.
- A bridge from exploration to Final.
- A calm place to hear, read, compare, combine, and arrange.
- A collaboration surface with clear ownership and contributor lineage.
- A place where originals remain safe.
- A route into focused tools, not a place where every tool must remain visible.
- Understandable on a 390px phone.
- Useful with one idea, ten ideas, or a dense returning song.
- Helpful to a solo songwriter and a collaborative team.
- Faith-aware in warmth and language without becoming decorative or performative.

The songwriter's content is the hero.

The interface exists to clarify relationships and reveal the next useful decision. It must never make the songwriter admire the interface at the expense of writing the song.

============================================================
PART 3 - THE FANTASY.CO SIMPLICITY CONSTITUTION
============================================================

Treat simplicity as product architecture, not visual minimalism.

Do not remove useful capability merely to make a screenshot look clean.

Do remove simultaneous decisions, duplicated entry points, premature tools, repeated status, and controls shown outside the moment when they help.

Apply these laws.

LAW 1 - ONE DOMINANT JOB PER STATE

Every Canvas state must have one dominant user job:

- Browse the song.
- Add an idea.
- Focus one idea.
- Record.
- Build a Listen Path.
- Compare.
- Merge.
- Weave.
- Arrange Final.
- Review.

Never make the user perform two focused workflows at once.

LAW 2 - ONE PRIMARY ACTION, ONE SUPPORTING ACTION

The default mobile state may visually emphasize:

- One primary action.
- At most one supporting action.

Everything else must be quiet, contextual, grouped, or moved to a focused surface.

Do not give Practice, Record, Add, Fit, Metronome, Pad, Review, History, Invite, Listen, Merge, Arrange, and navigation equal visual weight.

LAW 3 - CALM DEFAULT, CONTEXTUAL POWER

Advanced actions must appear when they become valid and useful:

- Compare appears when two comparable ideas exist.
- Merge appears after the user selects compatible source fragments.
- Listen Path appears after playable ideas exist and becomes dominant only when the user enters Listen Path.
- Weave appears for a compatible Final lyric or section.
- Arrange appears when Final contains enough material to arrange.
- Review appears when there is reviewable work for the current role.
- Restore appears after an action that can be undone or from Version History.
- Credits and source lineage appear when the user asks why or who.

Do not show disabled future power as ambient clutter.

LAW 4 - ONE ACTION SURFACE AT A TIME

On mobile, there must never be multiple competing bottom action bars.

The system must explicitly define which surface owns the bottom safe area in every state.

Examples:

- Default Canvas: creation action surface.
- Selected card: contextual card action surface or sheet.
- Listen Path: path transport.
- Merge: merge selection/action surface.
- Weave: weave progress/action surface.
- Arrange: arrangement action surface.
- Compare: compare decision surface.
- Recording: recorder controls.
- Review: review decision controls.

If entering one workflow leaves another workflow visible underneath, treat that as a defect unless evidence proves the combination is necessary.

LAW 5 - NO DUPLICATE CONTROL WITHOUT A PROVEN REASON

The same action must not be visible in the header, on a card, in a dock, and in a tab bar at the same moment.

For every duplicate, decide which location is:

- The canonical entry.
- A justified contextual shortcut.
- Redundant and removable from that state.

Hidden gestures may accelerate an action, but they may never be its only route.

LAW 6 - CONTENT BEFORE CHROME

On a 390px phone, protect enough visible area for:

- The song title or room identity.
- The Ideas/Final orientation.
- The root or current focus.
- At least one meaningful idea card.
- The current primary action.

If status pills, navigation, collaborator controls, utility toggles, or action bars consume the opening view before the song does, the hierarchy has failed.

LAW 7 - NO TOOL WITHOUT A USER JOB

For every visible control, answer:

- What songwriter job does it complete?
- How often is that job needed?
- Why is the control visible now?
- What happens if it is moved one level deeper?
- Does it advance the song or merely expose system capability?
- Which role can use it?
- Is the label understandable without product knowledge?

If the control cannot pass this test, contextualize, combine, relocate, or defer it.

LAW 8 - SAFETY MAKES EXPERIMENTATION SIMPLE

The user should be willing to try a direction because:

- Originals remain in Ideas or history.
- Add to Final is non-destructive.
- Merge creates a new draft with lineage.
- Replacing a line preserves the original.
- Removing from Final does not delete the idea.
- Archive is recoverable.
- Reordering has Undo.
- Restore saves the current version first.
- Failed sync preserves local work.

Safety should be visible at the decision moment, not buried in documentation.

LAW 9 - ROLE-AWARE SIMPLICITY

Do not show controls a role cannot meaningfully use.

- Owner: decide, approve, arrange, restore, export.
- Contributor: create, record, suggest, comment, build options.
- Reviewer: inspect, comment, approve where allowed, request changes.
- Viewer: read and listen without misleading edit affordances.

Use plain explanations. Do not expose permission matrices.

LAW 10 - THE DEFAULT SCREEN IS A BEAUTIFUL SMALL TREE

The first impression should be:

- One song.
- Two clear spaces: Ideas and Final.
- A small number of legible cards.
- Organic relationships.
- One obvious next action.

It must not be:

- A toolbar.
- A field of chips.
- A forest of badges.
- A wall of controls.
- A tiny zoomed-out diagram.
- A rainbow of equally loud cards.

============================================================
PART 4 - SOURCE-OF-TRUTH READING PROTOCOL
============================================================

Follow the repository's AGENTS.md and project instructions.

Before making changes, read the relevant production sources. Do not rely on this prompt alone.

Read:

1. Root `AGENTS.md`.
2. The runtime verification skill or documented launch recipe.
3. `CANVAS_VISUAL_HANDOFF.md`.
4. `CANVAS_COLLABORATION_HANDOFF.md`.
5. `docs/CANVAS-RENDER-CONTRACT.md`.
6. `docs/CANVAS-FEATURES-CONTRACT.md`.
7. `docs/CANVAS-COLLAB-CONTRACT.md`.
8. `docs/ROLE-CONTRACT.md`.
9. `docs/WEAVE-CONTRACT.md`.
10. `docs/BUILD-PATHWAY.md`.
11. `docs/MOBILE-AUDIT-FINDINGS.md` if present.

Read the complete Canvas specification family:

- Feature 04: Song Whiteboard Canvas.
- Feature 05: Ideas Tree and Final Tree.
- Feature 07: Idea Cards and Fragment Pipeline.
- Feature 08: Universal Quick Capture.
- Feature 09: Instant Hum Capture.
- Feature 10: Voice Memo Cards and Waveforms.
- Feature 11: Voice Memo Inbox and Existing Audio Import.
- Feature 12: Auto Transcription and Lyrics from Transcript.
- Feature 13: BPM, Key, Melody, and Chord Detection.
- Feature 14: One-Tap Metronome.
- Feature 15: Loop This Part and Swipe Between Takes.
- Feature 16: Layered Voice Memo Recording.
- Feature 17: Lyrics and Chords Editor.
- Feature 18: Section Nodes and Custom Labels.
- Feature 19: Line-Level Suggestions.
- Feature 20: Listen Path.
- Feature 21: Compare Mode.
- Feature 22: Merge and Splice.
- Feature 23: Final Arrangement.
- Feature 24: Version History, Undo, and Original Preservation.
- Feature 33: Personal Memory Graph.

Read the Product 01-14 Canvas visual handoffs in:

`zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/`

Read the feature implementation plans in:

`zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/`

Inspect the visual pages, not only extracted text.

Extract from each source:

- User job.
- Entry point.
- First visible UI.
- Primary action.
- Secondary action.
- Success state.
- Failure and recovery.
- Permission behavior.
- Mobile behavior.
- Upstream inputs.
- Downstream outputs.
- Original-preservation rule.
- Contributor-attribution rule.
- What must not be shown.

Where sources disagree:

1. Current repository contract and working data integrity win.
2. Approved visual reference wins for visual language.
3. The latest feature handoff wins for interaction detail.
4. Radical simplicity wins for simultaneous visibility.
5. Preserve capability by contextualizing it rather than deleting it.

Document every conflict and the resolution.

============================================================
PART 5 - PRESERVATION RULE
============================================================

You are simplifying and strengthening an existing product, not replacing it.

Preserve:

- The "one song = one private room" metaphor.
- The Ideas Tree and Final Tree mental model.
- The root song object and idea lineage.
- Existing routes and valid deep links.
- Existing data contracts and seam boundaries.
- Existing local-first and offline-safe behavior.
- Existing capture-to-canvas behavior.
- Existing role and capability enforcement.
- Existing realtime and collaborator attribution behavior.
- Existing version, activity, credits, and review relationships.
- Existing accessibility behavior that works.
- Existing reduced-motion behavior.
- The locked cream, charcoal, gold, serif, and spiritual warmth design system.
- The Glory Spectrum's distinction between content type, creator identity, and system state.
- The rule that originals are preserved.
- Working features, even when their entry point must move.

You may upgrade:

- Default hierarchy.
- Information architecture.
- Progressive disclosure.
- Feature eligibility and contextual surfacing.
- State exclusivity.
- Labels and copy.
- Selection and focus behavior.
- Mobile navigation.
- Card actions.
- Empty and first-use states.
- Returning-user orientation.
- Collaboration clarity.
- Error prevention.
- Recovery.
- Loading and saved feedback.
- Performance.
- Accessibility.
- Component boundaries.
- Tests.

Do not:

- Rebrand the product.
- Replace the locked design system.
- Build a generic graph editor.
- Add a second canvas interaction system.
- Delete working features merely to reduce visible controls.
- Restore retired legacy floating buttons.
- Introduce new speculative Canvas features before auditing the existing ones.
- Put all advanced actions in one permanent toolbar.
- Make a hidden gesture the only way to perform a core action.
- Expose raw database, storage, media, permission, or graph language.
- Weaken authentication, RLS, capability checks, or ownership.
- Destroy or overwrite user work.
- Change database contracts without compelling evidence and a backward-compatible migration.
- Touch unrelated pages because they could also be improved.
- Clean unrelated worktree changes.
- claim improvement without runtime evidence.

Every implementation change must trace to a finding ID.

============================================================
PART 6 - FIRST-TIME SONGWRITER PERSONA
============================================================

Before opening the Canvas implementation source code, create and inhabit this persona:

Name: Jordan
Role: Worship songwriter and volunteer worship leader
Device: iPhone-sized phone, often one-handed
Current tools: Voice Memos, Notes, text threads, paper, occasional chord chart
Product familiarity: Has captured ideas in Colors of Glory but has never used Canvas
Technical confidence: Average
Environment: Rehearsal room, church office, living room, backstage, or between services
Emotional state: Hopeful but mentally full; wants the song to become clearer
Available attention: Moderate, but the music remains the focus
Tolerance for software concepts: Low
Vocabulary Jordan understands: song, idea, verse, chorus, bridge, tag, key, BPM, chords, take, voice memo, lyrics, final, compare, version
Vocabulary Jordan does not naturally use: node, edge, graph, mutation, viewport, object, metadata, lineage, merge conflict, queue state
Starting content: several raw lyric, voice, chord, Scripture, and section ideas from more than one contributor
Primary expectation: "Show me the song and help me decide what to do next."
Secondary expectation: "Let me hear the ideas, keep the good parts, and build the order."
Collaboration expectation: "Show me what my co-writers added without turning this into notifications."
Core fear: Accidentally losing an idea or changing the final song
Core frustration: Too many controls before Jordan understands the room
Core trust question: "Is the original still safe?"
Core continuation question: "What is the next useful songwriting move?"

Write a Persona Contract before testing:

- What Jordan knows.
- What Jordan does not know.
- What Jordan expects in the first three seconds.
- What Jordan fears changing.
- What would make the Canvas feel like software work.
- What would make Jordan trust the Canvas.
- What would make Jordan return tomorrow.

Remain faithful to Jordan during the blind pass.

Do not use source-code knowledge to excuse confusing UI.

============================================================
PART 7 - OPERATING RULES
============================================================

Before changing code:

1. Read repository instructions.
2. Read the runtime verification skill.
3. Inspect git status.
4. Identify and preserve unrelated work.
5. Start the application using the documented workflow.
6. Use a valid supported auth/verification path.
7. Set the primary viewport to 390 x 844.
8. Establish baseline screenshots and interaction recordings.
9. Do not inspect Canvas component implementation until the blind first-use journey is complete.

During the blind pass, inspect only what is necessary to:

- Launch the app.
- Authenticate safely.
- Open a populated song.
- Open an empty or first-song Canvas.
- Exercise roles if the supported test environment provides them.

If authentication blocks testing:

- Use the repository's supported verification method.
- Do not weaken authentication.
- Do not invent a production bypass.
- Document the exact blocker.
- Continue with component harnesses and safe degraded-state verification.
- Distinguish observed behavior from inferred behavior.

Do not ask unnecessary questions.

Make safe, evidence-backed assumptions and continue.

============================================================
PART 8 - PHASE A: BLIND FIRST-TIME CANVAS JOURNEYS
============================================================

During this phase, behave only as Jordan.

For every step, record:

- What Jordan sees.
- What receives attention first.
- What appears primary, secondary, or decorative.
- What Jordan thinks each visible control does.
- What Jordan expects before tapping.
- What happens after tapping.
- Whether the result matches the expectation.
- Whether Jordan knows what changed.
- Whether Jordan knows what was saved.
- Whether Jordan knows how to leave or undo.
- Confidence from 1-10.
- Frustration from 1-10.
- Evidence: screenshot, DOM state, timing, tap count, or observed result.

Measure:

- Time to identify the song.
- Time to understand Ideas versus Final.
- Time to identify the primary action.
- Time to find a specific idea.
- Time to play a voice idea.
- Time to move one idea toward Final.
- Time to undo or restore.
- Time to understand a collaborator's contribution.
- Number of simultaneously emphasized actions.
- Number of visible utility controls.
- Number of persistent bars, docks, pills, tabs, and sheets.
- Number of states where two different actions appear primary.
- Number of hidden-gesture dependencies.
- Number of icon-only controls Jordan cannot confidently name.
- Number of times Jordan loses spatial or song context.
- Number of times a workflow remains visible after a new workflow starts.

Run every journey below.

------------------------------------------------------------
JOURNEY A - FIVE-SECOND FIRST OPEN
------------------------------------------------------------

Open a populated Canvas and do nothing for five seconds.

Identify:

- Song title.
- Back destination.
- Ideas and Final orientation.
- Root song card.
- Visible idea types.
- Contributors.
- Current save state.
- Primary action.
- Secondary action.
- Canvas navigation.
- Fit or zoom controls.
- Practice.
- Record memo.
- Add part or Add idea.
- Metronome.
- Pad.
- What Changed.
- Review count.
- Invite/presence.
- Bottom tab bar.
- Any active or restored Listen Path.
- Any arrangement control.

Judge:

- Does the song dominate the opening view?
- Is the default state calm?
- Can Jordan name the one thing to do next?
- Are utilities competing with creative content?
- Is Canvas understandable without knowing how pan and zoom work?
- Does the visible area show enough of the song to create meaning?
- Are Ideas and Final separate enough to understand but connected enough to feel like one song?
- Does collaboration feel present but quiet?
- Does any feature appear only because it exists rather than because it helps now?

------------------------------------------------------------
JOURNEY B - EMPTY CANVAS / FIRST IDEA
------------------------------------------------------------

Open a new song with no Canvas cards.

Test:

- Root song card.
- Empty-state copy.
- First action prompt.
- Add first idea.
- Record first memo or hum.
- Write lyric.
- Add chord.
- Add note.
- Add Scripture or meaning.
- Add a section.
- Cancel each path.
- Return after an abandoned local draft.

Judge:

- Is the blank state inviting without becoming a tutorial wall?
- Is there one primary action?
- Can Jordan save before categorizing?
- Does the first card appear immediately?
- Is "Saved to this song" visible?
- Does the first card attach to the correct tree and source?
- Does the Canvas automatically frame the new idea without disorienting Jordan?
- Can Jordan understand the card type before reading all metadata?
- Does the empty state disappear cleanly?

------------------------------------------------------------
JOURNEY C - SPATIAL ORIENTATION
------------------------------------------------------------

Test:

- Ideas jump.
- Final jump.
- Fit whole song.
- Tap card.
- Pan.
- Pinch zoom.
- Wheel or trackpad pan/zoom on desktop.
- Keyboard pan and zoom.
- Return to root.
- Return after opening a sheet.
- Deep-link to an offscreen card.
- Expand a section cluster.
- Dense-board framing.

Judge:

- Is semantic navigation the primary mobile path?
- Are pan and pinch enhancements rather than requirements?
- Does Fit reveal useful structure or shrink cards below comprehension?
- Does a jump preserve orientation?
- Does the selected card remain visually findable?
- Can Jordan return to the previous useful view?
- Do zoomed controls still have effective 44 x 44 CSS-pixel targets?
- Does drag conflict with pan?
- Does pinch during drag cancel the move safely?
- Are Cards semantic HTML while connectors remain decorative?

------------------------------------------------------------
JOURNEY D - CARD RECOGNITION AND FOCUS
------------------------------------------------------------

Audit every card type:

- Lyric.
- Voice memo.
- Hum.
- Chord.
- Note.
- Scripture.
- Section.
- Merged/composite draft.
- Dimmed source reference.
- Pending-review card.
- Final card.
- Processing card.
- Offline/syncing card.
- Error card.
- Archived or restorable card.

For each card, audit:

- Type recognition.
- Title.
- Preview.
- Contributor.
- Contributor color plus non-color identity.
- Section.
- Status.
- Duration or waveform where relevant.
- Selected state.
- Playing state.
- Final-order number.
- Listen Path number.
- Merge selection.
- Review marker.
- Amen/reaction state.
- Comment count if implemented.
- Source lineage.
- Primary card action.
- More-actions entry.
- Focus state.
- Effective touch targets at the current zoom.

Judge:

- Does a resting card contain only the information required to recognize it?
- Does selection reveal power without causing an action-row swarm?
- Is the first contextual action type-aware?
- Can Jordan close focus and return to browsing?
- Are actions readable without icon knowledge?
- Does selection increase clarity instead of increasing clutter?

------------------------------------------------------------
JOURNEY E - ADD IDEA / ADD PART
------------------------------------------------------------

Test creation of:

- Verse.
- Chorus.
- Bridge.
- Tag.
- Intro.
- Outro.
- Vamp.
- Prayer moment.
- Custom section.
- Lyric fragment.
- Chord idea with progression.
- Key and BPM.
- Note.
- Scripture reference.
- Meaning/story note.
- Arrangement idea.

For every path test:

- Entry label.
- Type selection.
- Keyboard behavior.
- Optional versus required fields.
- Save disabled and enabled states.
- Cancel.
- Back.
- Local draft preservation.
- Optimistic card.
- Server reconciliation.
- Failure and retry.
- Duplicate prevention.
- Contributor attribution.
- Activity event.
- Credits contribution type.

Judge:

- Is "Add part" clearer or less clear than "Add idea" for the actual options?
- Does the first sheet force too many categories?
- Can the user write first and organize later?
- Does the created object land in the right tree, section, activity, history, and credits context?

------------------------------------------------------------
JOURNEY F - RECORD FROM CANVAS
------------------------------------------------------------

Test:

- First microphone permission.
- Permission denied.
- Permission later restored.
- Record first hum.
- Record a voice memo.
- Stop.
- Cancel.
- Save.
- Review.
- Section choice.
- Note/name.
- Offline save.
- Upload retry.
- Duplicate prevention.
- Recovered interrupted upload.
- Newly created Canvas card.
- Voice-mode visibility.
- Activity and credits attribution.

Judge every recorder state:

- Idle.
- Arming.
- Permission request.
- Recording.
- Stopping.
- Locally safe.
- Uploading.
- Saved.
- Review.
- Failed upload.
- Retry.

Confirm:

- The recorder feels like the same trusted Capture system used elsewhere.
- The Canvas does not build a competing recorder.
- Recording does not leave other Canvas workflows active.
- Metronome and Pad behavior cannot bleed unexpectedly into the recording.
- The raw audio remains the source of truth.
- A transcript or analysis failure cannot imply the memo was lost.

------------------------------------------------------------
JOURNEY G - VOICE MEMO CARD, LAYERS, TAKES, LOOP
------------------------------------------------------------

Test:

- Play/pause.
- Seek.
- Resume from prior position.
- Waveform loading.
- Missing audio.
- Add note.
- Rename.
- Link section.
- Transcript status.
- Musical-analysis status.
- Record over this.
- Base layer.
- New layer.
- Play stack.
- Mute.
- Solo.
- Compare layers.
- Open takes.
- Swipe between takes.
- Loop this part.
- Keep take.
- Keep both.
- Archive take.
- Restore take.
- Record another take.

Judge:

- Does the Canvas remain a map while deeper audio work moves to a focused sheet?
- Is one audio engine active at a time?
- Does playback state remain visible on the card?
- Are layers understandable without a DAW timeline?
- Is looping available at the moment it helps, not always visible?
- Are original takes preserved?
- Is each layer and take attributed?

------------------------------------------------------------
JOURNEY H - TRANSCRIPT AND MUSICAL SUGGESTIONS
------------------------------------------------------------

Test:

- Transcript preparing.
- Transcript ready.
- Transcript failure.
- Low-confidence line.
- Edit transcript.
- Jump to audio.
- Create lyric card.
- Add note.
- Add to section.
- BPM suggestion.
- Key suggestion.
- Chord suggestion.
- Section suggestion.
- Confirm suggestion.
- Edit manually.
- Leave for later.
- Owner review of collaborator suggestion.

Judge:

- Does analysis happen after the idea is safe?
- Does Canvas show only quiet status, with detail in a focused surface?
- Are suggestions clearly suggestions?
- Does the original memo remain primary?
- Do extracted lyric or note cards preserve a source link?
- Do suggestions feed the metronome, Pad, chords, section, Listen Path, and handoff without duplicating data?

------------------------------------------------------------
JOURNEY I - IDEA TO FINAL
------------------------------------------------------------

Select one Idea card and move it toward Final.

Test:

- Tap Add to Final.
- Drag across the divider.
- Target section selection only when required.
- Best-match section.
- Owner action.
- Contributor "Suggest for Final."
- Reviewer behavior.
- Viewer behavior.
- Adding state.
- Idempotency.
- Duplicate attempt.
- Success state.
- Source connector or lineage.
- Undo.
- Reload.
- Realtime update on another collaborator.

Confirm:

- Original remains in Ideas.
- Final receives a new current node or in-place state according to the repository contract.
- Attribution is preserved.
- The user understands what changed.
- The action is reversible.
- The Canvas frames the result without losing the source.
- Add to Final does not look like publishing or deletion.

------------------------------------------------------------
JOURNEY J - RETURN, ARCHIVE, RESTORE
------------------------------------------------------------

Test:

- Move Final card back to Ideas.
- Remove from Final.
- Archive an idea.
- Restore an archived idea.
- Bring back a dimmed merged source.
- Undo a move.
- Undo a reorder.
- Restore from Version History.
- Conflict while restoring.

Confirm:

- No action silently deletes creative work.
- "Remove from Final" is distinguished from "Delete."
- Source and contributor lineage remain intact.
- Current work is saved before a meaningful restore.
- Recovery language is calm and specific.

------------------------------------------------------------
JOURNEY K - SECTIONS AND CLUSTERS
------------------------------------------------------------

Test:

- Create section.
- Custom label.
- Section numbering.
- Worship-specific section names.
- Attach lyric.
- Attach memo.
- Attach chord.
- Attach Scripture/meaning.
- Add alternate.
- Repeat marker.
- Optional marker.
- Collapse cluster.
- Expand cluster.
- Jump to cluster.
- Move a section toward Final.
- Review changed section.

Judge:

- Do sections reduce complexity or create another navigation system?
- Does clustering help dense boards without hiding important new work?
- Is the cluster visually distinct from a task group?
- Is expand/collapse obvious and accessible?
- Does the user understand the difference between a section card, an idea assigned to a section, and a Final arrangement item?

------------------------------------------------------------
JOURNEY L - LISTEN PATH
------------------------------------------------------------

Enter Listen Path only after playable material exists.

Test:

- Entry point.
- Select first card.
- Select additional cards.
- Numbered order.
- Remove.
- Reorder.
- Play.
- Pause.
- Previous.
- Next.
- Jump to item.
- Canvas follows playback.
- One item fails.
- Retry or skip.
- Clear.
- Save arrangement idea.
- Restore an unfinished path.
- Send for review.
- Add to Final where allowed.
- Exit.

Judge:

- Does Listen Path replace the default action surface while active?
- Is the rest of Canvas still visible enough to maintain context?
- Does the collapsed state remain quiet?
- Should an empty Listen Path control be visible before selection?
- Can Jordan understand that a path auditions order without changing Final?
- Does exiting restore the prior Canvas state cleanly?

------------------------------------------------------------
JOURNEY M - COMPARE MODE
------------------------------------------------------------

Test:

- Compare launcher.
- Automatic same-section match.
- Same section family match.
- Create another take when no partner exists.
- Compare lyric A/B.
- Compare voice memo A/B.
- Compare chord options.
- Compare section drafts.
- Play A.
- Play B.
- Switching stops the other audio.
- Collaborator notes or signals.
- Choose direction.
- Keep both.
- Send to review.
- Merge ideas.
- Add chosen direction to Final.
- Save comparison.
- Reopen.
- Permission-limited decision.
- Conflict.
- Failure.
- Exit to the exact source.

Judge:

- Does Compare focus only the two or three relevant options?
- Is it a decision room rather than a poll?
- Is "winner/loser" language absent?
- Are contributor signals helpful but non-authoritative?
- Are originals preserved?
- Is one primary decision clear?

------------------------------------------------------------
JOURNEY N - MERGE AND SPLICE
------------------------------------------------------------

Test:

- Enter from Canvas.
- Enter from Compare.
- Enter from selected lyric lines.
- Select compatible fragments.
- Reject incompatible fragments with clear explanation.
- Reorder sources.
- Remove source.
- Preview voice source.
- Edit composite lyric.
- Include chord.
- Include note.
- Include Scripture/meaning.
- Create draft.
- Inspect lineage.
- Undo.
- Send for review.
- Add to Final.
- Restore original source.
- Conflict because a source changed.
- Offline selection persistence.
- Failure.

Judge:

- Is the mobile flow stepwise: Select -> Arrange -> Preview -> Create?
- Does the preview update immediately?
- Are source contributors visible but not presented as legal paperwork?
- Is "originals stay saved" visible at the decision point?
- Does Merge remain unavailable until there is a meaningful selection?

------------------------------------------------------------
JOURNEY O - WEAVE AND LINE LAB
------------------------------------------------------------

Test the current Canvas-specific composition flow:

- Enter Weave from a compatible Final lyric or section.
- See the target section.
- See eligible Ideas glow or become selectable.
- Place a source line into the target.
- Preserve its contributor and source.
- Reorder or remove a placed line.
- Open Line Lab.
- View rhyme or line alternatives.
- Swap a target line.
- Undo.
- Complete Weave.
- Return to the target section.
- Exit without losing work.

Judge:

- Is "Weave" understandable to a first-time songwriter?
- Does the flow teach itself through one sentence and layout?
- Does Weave replace other bottom workflows while active?
- Does Line Lab remain a focused tool rather than another permanent Canvas layer?
- Does every placed line keep attribution and recoverability?

------------------------------------------------------------
JOURNEY P - FINAL ARRANGEMENT
------------------------------------------------------------

Test:

- Enter Final.
- Start Arrange.
- Reorder by drag.
- Reorder by Move up/down.
- Duplicate Chorus.
- Add repeat count.
- Mark optional section.
- Promote alternate.
- Remove from Final.
- Save.
- Undo.
- Cancel with unsaved local order.
- Preview song.
- Play Final.
- Missing audio read-through.
- Suggest arrangement change as contributor.
- Owner review.
- Conflict with newer version.
- Reload.
- Prepare handoff.

Judge:

- Does Final default show the arrangement, not a Canvas toolbar?
- Does Arrange become the single focused mode?
- Is the vertical order legible on mobile?
- Are source details hidden until requested?
- Is Preview song the obvious next action after arranging?
- Does removing from Final preserve the source in Ideas?

------------------------------------------------------------
JOURNEY Q - LINE-LEVEL SUGGESTIONS
------------------------------------------------------------

Test:

- Select a lyric line.
- Suggest replacement.
- Record line option if implemented.
- Preserve local draft.
- Send.
- Sync across devices.
- Pending state.
- Owner review.
- Accept line.
- Keep original.
- Conflict because original changed.
- Undo acceptance.
- Activity event.
- Version event.
- Credit attribution.

Judge:

- Is the suggestion attached to the exact line?
- Is it clear that the owner decides?
- Does "Keep original" preserve the suggestion as contribution memory without shaming the collaborator?
- Does the suggestion surface in the review queue without creating notification noise?

------------------------------------------------------------
JOURNEY R - STORY, SCRIPTURE, AND MEANING
------------------------------------------------------------

Test:

- Add Scripture reference.
- Parse or search reference.
- Network failure.
- Manual fallback.
- Add story note.
- Add theme or meaning note.
- Link meaning to a section.
- Link meaning to a lyric or memo.
- Open source passage.
- Edit.
- Archive/restore.
- Collaborator contribution.

Judge:

- Is this a meaningful songwriting zone rather than religious decoration?
- Does Scripture help clarify the song's message?
- Is it contextual and quiet on the default Canvas?
- Does it preserve exact references and source relationships?

------------------------------------------------------------
JOURNEY S - COLLABORATION, PRESENCE, AND INVITE
------------------------------------------------------------

Test:

- Empty roster.
- One collaborator.
- Several collaborators.
- Here-now presence.
- Roster fallback when not live.
- Invite.
- Role selection.
- Copy link.
- Joined-as-role message.
- Jump to collaborator's latest idea.
- Realtime new card.
- Realtime move.
- Realtime edit.
- Amen/reaction.
- Remove reaction.
- Pending reaction sync.
- Comment marker if implemented.
- Offline collaborator action.
- Removed collaborator with historical contributions.

Judge:

- Does collaboration feel like people writing inside one room?
- Is presence honest about who is live versus who writes here?
- Does Invite remain easy without competing with the song?
- Are reactions encouragement rather than social engagement mechanics?
- Is creator color never confused with system gold?
- Does realtime activity update without re-render storms or visual jumping?

------------------------------------------------------------
JOURNEY T - OWNER REVIEW QUEUE
------------------------------------------------------------

Test:

- No review items.
- One item.
- Many items.
- New voice idea.
- Lyric suggestion.
- Chord suggestion.
- Arrangement suggestion.
- Merged draft.
- Suggested Add to Final.
- Approve.
- Keep in Ideas.
- Keep original line.
- Request changes if implemented.
- Dismiss.
- See on Canvas.
- Next item.
- Empty completion state.
- Reviewer versus owner capability.

Judge:

- Does Review appear only when work exists?
- Does the queue focus on one decision at a time?
- Does the owner see context and source?
- Do decisions update Canvas, activity, history, and credits exactly once?
- Are rejected or deferred contributions handled respectfully?
- Does closing the queue restore the previous Canvas view?

------------------------------------------------------------
JOURNEY U - WHAT CHANGED / RETURNING USER
------------------------------------------------------------

Test:

- No changes.
- One meaningful change.
- Many changes.
- Grouped recap.
- Card deep link.
- Exact line suggestion deep link.
- Voice memo deep link.
- Final-order change.
- Review changes.
- Open song.
- Failure fallback.
- Last-seen behavior across devices.
- Restricted items by role.

Judge:

- Does recap behave like a calm briefing?
- Does it avoid red badges and notification energy?
- Does every item route to the exact context?
- Is the unread marker advanced at the right moment?
- Can a recap failure never block opening the song?

------------------------------------------------------------
JOURNEY V - ACTIVITY, CREDITS, VERSIONS, MEMORY
------------------------------------------------------------

Audit only as Canvas inputs, destinations, and trust systems.

Verify:

- Canvas creation writes a human activity event.
- Move to Final writes the correct event.
- Merge records source contributors.
- Line acceptance records contributor credit.
- Arrangement change records actor and version.
- Credits derive from accepted contributions without erasing history.
- Version History previews and restores safely.
- Original-preserved badges link to source/history.
- Memory can rediscover song ideas, themes, Scripture, people, and decisions.
- Memory remains private by default.
- Memory compare requires consent.
- Deep links return to the exact Canvas card and preserve the return path.

Do not make Activity, Credits, Version History, or Memory permanent Canvas chrome merely because they are connected.

------------------------------------------------------------
JOURNEY W - DENSE SONG AND CLUTTER STRESS
------------------------------------------------------------

Test:

- 1 card.
- 4 cards.
- 12 cards.
- 40 cards.
- 250-card data stress where tooling permits.
- Several sections.
- Several contributors.
- Many review items.
- Active Listen Path.
- Final arrangement.
- Long card titles.
- Long lyric previews.
- Multiple processing items.
- Many new-since-last-visit items.

Measure:

- Opening comprehension.
- DOM count.
- Render time.
- Node selection latency.
- Pan/zoom smoothness.
- Drag smoothness.
- Realtime update cost.
- Cluster usefulness.
- Card overlap.
- Connector clutter.
- Effective touch target size.
- Whether Fit becomes unusably small.

Judge:

- Does the Canvas summarize before it shrinks?
- Does clustering preserve important new or active work?
- Does the default view show the most relevant subset?
- Are filters or search introduced only when density requires them?
- Is the root still meaningful?

------------------------------------------------------------
JOURNEY X - FAILURE AND RECOVERY
------------------------------------------------------------

Test or safely simulate:

- Canvas load failure.
- Partial source failure.
- Offline open with cache.
- Create failure.
- Move failure.
- Edit failure.
- Upload failure.
- Realtime disconnect.
- Stale server version.
- Simultaneous edit.
- Permission changed while open.
- Collaborator removed.
- Deleted or archived source.
- Missing audio.
- Transcription failure.
- Detection failure.
- Storage limitation.
- Session expiry.
- Route reload during a focused workflow.
- Rapid double tap.
- Tap during saving.
- Back during recording.
- Back during merge.
- Back during arrange.
- App backgrounding.

At every failure ask:

- Is the creative work safe?
- Does the interface say what is safe?
- Is the recovery action clear?
- Is local draft state preserved?
- Can retry duplicate work?
- Can the user exit without making the situation worse?
- Does recovery return to the correct context?
- Does the UI avoid technical language?

============================================================
PART 9 - PHASE B: CURRENT-SURFACE INVENTORY
============================================================

Only after the blind journeys may you inspect Canvas source code.

Map the current implementation before deciding what moves.

At minimum inspect:

- `src/pages/SongCanvasPage.tsx`
- `src/components/canvas/SongCanvasExperience.tsx`
- `src/components/canvas/CanvasStage.tsx`
- `src/components/canvas/CanvasViewport.tsx`
- `src/components/canvas/CanvasCard.tsx`
- `src/components/canvas/CardShell.tsx`
- Every typed card face.
- `FirstActionPrompt.tsx`
- `CardActionsSheet.tsx`
- `CardEditSheet.tsx`
- `AddPartSheet.tsx`
- `ListenPathBar.tsx`
- `CompareModeSheet.tsx`
- `MergeActionBar.tsx`
- `WeaveBar.tsx`
- `LineLabSheet.tsx`
- `FinalArrangementBar.tsx`
- `OwnerReviewQueueSheet.tsx`
- `WhatChangedRecapSheet.tsx`
- `LineSuggestionSheet.tsx`
- `CanvasMetronomeToggle.tsx`
- `CreativeActionDock.tsx`
- `SongTabBar.tsx`
- Canvas collaboration layers.
- Canvas hooks under `src/lib/canvas/features/`.
- Canvas persistence and realtime seams.
- Canvas tests.

The current host has historically accumulated many responsibilities. Re-measure rather than trusting an old line count.

Create an exact surface inventory:

- Header controls.
- Status controls.
- Utility controls.
- Presence/invite controls.
- Semantic Canvas navigation.
- First-use controls.
- Creation dock.
- Card-resting controls.
- Card-selected controls.
- Persistent bottom bars.
- Focused sheets.
- Modal sheets.
- Coach marks.
- Toasts.
- Screen-reader-only summaries.

For every item record:

- Source file and line.
- Visible state.
- Eligibility condition.
- Role condition.
- Z-layer.
- User job.
- Frequency.
- Competing surfaces.
- Data read/write.
- Entry.
- Exit.
- Whether it is duplicated.
- Whether it is necessary in the default view.

Do not describe the interface as "busy." Prove where the busyness comes from.

============================================================
PART 10 - ATOMIC DESIGN AND USEFULNESS AUDIT
============================================================

Audit every atom, molecule, organism, and system.

ATOMS

Examples:

- Icon.
- Label.
- Status sentence.
- Badge.
- Contributor dot.
- Review dot.
- Amen count.
- Tab.
- Pill.
- Button.
- Touch target.
- Drag handle.
- Connector.
- Waveform.
- Chord chip.
- Save state.
- Loading state.
- Error state.
- Focus ring.
- Selected ring.
- Playing ring.
- Tooltip.
- Toast.
- Coach-mark sentence.
- Haptic.
- Animation.

MOLECULES

Examples:

- Song header.
- Status row.
- Presence/invite control.
- Ideas/Final switcher.
- Fit control.
- Root song card.
- Typed idea card.
- Card action row.
- Creation dock.
- Metronome control.
- Pad control.
- Review launcher.
- Recap launcher.
- Listen Path pill.
- Merge selection bar.
- Arrangement bar.
- Save moment.

ORGANISMS

Examples:

- Empty Canvas.
- Populated Canvas.
- Dense Canvas.
- Selected-card state.
- Recording state.
- Listen Path state.
- Compare state.
- Merge state.
- Weave state.
- Final Arrange state.
- Owner Review state.
- Returning-user recap.
- Collaboration/presence state.
- Offline/recovery state.

SYSTEM

The complete songwriting loop:

Creative fragment
-> safe capture
-> visible idea
-> section/context
-> playback or reading
-> alternate
-> comparison
-> merge or selection
-> Final
-> arrangement
-> collaboration review
-> activity/version/credit
-> future retrieval

Every visible feature and meaningful invisible state must receive an audit entry.

Do not group small controls under "the Canvas works."

============================================================
PART 11 - REQUIRED AUDIT RUBRIC
============================================================

Score every audited item from 1-10 on:

1. First-glance comprehension
2. Discoverability
3. Expectation versus result
4. Direct usefulness to songwriting
5. Advancement of the current song
6. Frequency of need
7. Correct timing
8. Default-screen cost
9. Cognitive load
10. Number of steps
11. One-handed ergonomics
12. Effective touch accuracy at rendered zoom
13. Accessibility
14. Error prevention
15. Recoverability
16. Original preservation
17. Trust
18. Emotional calm
19. State continuity
20. Spatial orientation
21. Collaboration clarity
22. Attribution integrity
23. Integration with adjacent features
24. Visual hierarchy
25. Copy clarity
26. Performance
27. Overall frustration

For each feature document:

- Feature ID.
- Atom, molecule, organism, or system.
- User job.
- First-time interpretation.
- Actual behavior.
- Evidence.
- States tested.
- Role tested.
- Time or tap count.
- What works.
- Friction.
- Frustration trigger.
- Severity.
- Always-visible cost.
- Correct disclosure tier.
- Integration input.
- Integration output.
- Persistence boundary.
- Attribution boundary.
- Accessibility finding.
- Performance finding.
- Score.
- Recommended action:
  - Keep always visible.
  - Make contextual.
  - Combine.
  - Relocate.
  - Defer until eligible.
  - Remove only if truly redundant and capability remains elsewhere.
- Implementation justification.
- Validation required.

Severity:

P0 - Data loss, destructive loss of originals, unauthorized action, security, or complete blocker
P1 - First-time user cannot understand or complete the core Canvas-to-Final flow
P1 - The interface presents multiple competing primary actions or traps the user in a workflow
P2 - Significant confusion, integration failure, collaboration failure, accessibility failure, or recovery problem
P2 - Controls are too small after zoom or gestures conflict
P2 - Performance prevents smooth pan, selection, playback, or drag
P3 - Hierarchy, copy, visual clutter, or minor efficiency issue
P4 - Optional refinement without meaningful user impact

Do not inflate severity.

Do not recommend changes based only on taste.

============================================================
PART 12 - FEATURE USEFULNESS LEDGER
============================================================

Create a complete usefulness ledger for:

- Song title and root.
- Ideas.
- Final.
- Compare.
- Fit.
- Add idea.
- Add part.
- Record memo.
- Practice.
- Metronome.
- Pad.
- History.
- What Changed.
- Review queue.
- Invite.
- Presence.
- Song tabs.
- Card selection.
- Card edit.
- Layers/takes.
- Add to Final.
- Move to Ideas.
- Listen Path.
- Merge.
- Weave.
- Line Lab.
- Final Arrange.
- Comments.
- Amen.
- Line suggestions.
- Section clusters.
- Scripture/meaning.
- Activity.
- Credits.
- Version History.
- Memory.

For each one answer:

- What exact moment makes this useful?
- What preconditions must exist?
- What is the minimum useful UI?
- What is the visible cost when not useful?
- Which other feature does it duplicate or depend on?
- Should it be always visible, contextual, in a focused mode, in an adjacent route, or absent until eligible?
- What is the canonical entry point?
- What is the safe exit?
- What is the downstream next action?

Produce a "Visible Control Budget" for every state.

The budget is not a superficial number target. It is a forcing function.

For each state list:

- Dominant user job.
- Primary action.
- Supporting action.
- Quiet navigation.
- Context.
- Hidden/deferred capabilities.
- Why every visible control earns its place.

============================================================
PART 13 - PROGRESSIVE DISCLOSURE BLUEPRINT
============================================================

Design the simplest coherent disclosure model.

Use these tiers as a starting hypothesis, then validate:

TIER 0 - DEFAULT ROOM

- Song identity.
- Ideas/Final orientation.
- Root and relevant cards.
- One creation action.
- One supporting capture action.
- Quiet access to the rest of the song.

TIER 1 - CARD FOCUS

- Type-aware primary action.
- Play/read/edit.
- Move or suggest toward Final when eligible.
- One More entry for less frequent actions.

TIER 2 - FOCUSED SONGWRITING WORKFLOW

- Listen Path.
- Compare.
- Merge.
- Weave.
- Arrange.
- Record.

Only one Tier 2 workflow can own the screen at once.

TIER 3 - COLLABORATION AND RETURN

- Presence.
- Invite.
- Review queue.
- What Changed.
- Comments/Amen.

Show these when collaboration context exists; keep them quiet otherwise.

TIER 4 - TRUST AND MEMORY

- Version History.
- Activity.
- Credits.
- Source lineage.
- Personal Memory.

Make them findable from context without turning them into permanent Canvas chrome.

For the final proposal, document:

- What remains visible.
- What moves.
- What combines.
- What appears only when eligible.
- What becomes a sheet.
- What becomes a route.
- What becomes a card action.
- What becomes a post-success next action.
- What becomes a returning-user prompt.
- What is intentionally not mounted until requested.

============================================================
PART 14 - PRIMARY-ACTION CONTRACT
============================================================

Define and enforce one primary action per meaningful state.

Use this as the initial contract:

| State | Primary action | Supporting action |
|---|---|---|
| Empty Canvas | Add first idea | Record memo |
| Default populated Canvas | Add idea | Record memo |
| Voice card focused | Play or Pause | Open details |
| Raw Idea focused | Add to Final or Suggest for Final | Edit |
| Final section focused | Shape section or Preview | More |
| Recording | Stop and save | Cancel safely |
| Listen Path selecting | Play path once valid | Clear |
| Listen Path playing | Pause | Next |
| Compare | Choose direction | Keep both |
| Merge | Create new draft | Keep editing |
| Weave | Place or finish current line task | Done |
| Arrange | Preview song after ordering | Undo |
| Review | Approve/Accept the current item | Keep original/in Ideas |
| Viewer | Play or open | None that implies editing |

Do not implement this table blindly.

Validate each choice with runtime evidence and source intent.

If the primary action changes, explain why.

============================================================
PART 15 - MODE AND STATE EXCLUSIVITY
============================================================

Create a state machine for:

- Browsing.
- Card focused.
- Recording.
- Listen Path selecting.
- Listen Path playing.
- Compare.
- Merge selecting.
- Merge preview.
- Weave.
- Line Lab.
- Arrange.
- Review.
- Recap.
- Card editing.
- Invite.
- Error recovery.

Create an incompatibility matrix.

At minimum verify:

- Recording cannot coexist with active playback that can bleed.
- Compare cannot overlap both audio sources.
- Merge selection cannot remain active behind Arrange.
- Listen Path expansion cannot stack with Merge or Arrange.
- Weave owns the bottom surface while active.
- Line Lab is subordinate to Weave.
- Review suspends Canvas manipulation behind the sheet.
- One modal sheet traps focus at a time.
- Coach marks never appear over a focused workflow.
- New navigation asks for safe resolution when recording or unsaved work is active.

Define:

- Enter action.
- Paused/cancelled competing states.
- Persistent draft behavior.
- Exit action.
- Restored prior context.
- Browser Back behavior.
- Escape behavior.
- Route reload behavior.

============================================================
PART 16 - INTEGRATION LEDGER
============================================================

Create an integration matrix for every relationship below.

Canvas foundation:

- Song -> root song card.
- Canvas card -> Ideas or Final tree.
- Card -> section.
- Card -> contributor.
- Card -> source lineage.
- Card position -> persistence.
- Card status -> activity and recap.

Capture and audio:

- Capture Review block -> Canvas card.
- Canvas Record -> local audio safety.
- Local audio -> upload queue.
- Upload -> voice memo row.
- Voice memo -> Canvas voice card.
- Voice memo -> waveform.
- Voice memo -> transcript.
- Voice memo -> BPM/key/chord suggestion.
- Voice memo -> layers/takes.
- Voice memo -> Listen Path.

Song shaping:

- Idea -> Add/Suggest to Final.
- Final source -> original Ideas card.
- Section -> cluster.
- Selected playable cards -> Listen Path.
- Comparable cards -> Compare.
- Compare decision -> Final, Review, or Merge.
- Selected fragments -> Merge draft.
- Merge sources -> lineage and credits.
- Ideas lines -> Weave target.
- Final cards -> arrangement order.
- Arrangement -> Preview/Play Final.

Collaboration:

- Presence -> collaborator identity.
- Invite -> membership role.
- New contribution -> review state.
- Line suggestion -> owner queue.
- Arrangement suggestion -> owner queue.
- Review decision -> Canvas status.
- Amen/comment -> card marker.
- Realtime event -> board update.

Trust and memory:

- Canvas mutation -> activity event.
- Meaningful change -> version snapshot.
- Accepted contribution -> credits.
- Restored version -> new history event.
- Canvas source -> Memory graph.
- Recap item -> exact Canvas deep link.

For every relationship verify:

- Does the output arrive?
- Is it timely?
- Is it duplicated?
- Is attribution preserved?
- Is source lineage preserved?
- Can it be found later?
- Can it be corrected?
- Can it be restored?
- Does a failure preserve the original?
- Does the user understand the relationship?
- Does the correct role control the decision?

============================================================
PART 17 - VISUAL AND UI DIRECTION
============================================================

The visual objective is not "more polished controls."

The visual objective is:

The song feels present, the next action feels inevitable, and the interface becomes quiet around the creative material.

Preserve the locked Colors of Glory system:

- `--cog-cream: #F5F0E8`
- `--cog-cream-light: #FAF7F2`
- `--cog-charcoal: #1C1A17`
- `--cog-warm-gray: #6B6459`
- `--cog-gold: #B8953A`
- `--cog-gold-pale: #E8D5A0`
- Serif song titles and creative headings.
- Humanist sans-serif UI copy.
- Warm radial glow.
- Rounded tactile cards.
- Restrained motion.

Use the Glory Spectrum correctly:

- Content type color answers "what is this?"
- Creator color answers "who made this?"
- Gold answers "what is selected, active, saved, or system-directed?"
- Playback tone answers "what is sounding?"
- Review tone answers "what needs attention?"

Do not let every meaning become a full-color badge.

Resting card restraint:

- One type stripe or icon cue.
- One creator identity cue.
- One readable title/preview.
- One quiet status only when needed.

Selected card:

- Clear focus ring.
- Type-aware primary action.
- Secondary actions moved to a focused sheet when zoom would shrink targets.

Canvas field:

- Root remains the source of the room.
- Ideas feels exploratory.
- Final feels resolved.
- The divider guides without resembling a spreadsheet column.
- Connectors clarify lineage without becoming graph spaghetti.
- Whitespace remains a working material.

Header:

- Protect song-title gravity.
- Remove duplicated navigation.
- Avoid a chip strip.
- Do not let utilities form a second toolbar.
- Collaboration may be visible through one quiet, honest control.

Bottom:

- One surface owns the safe area.
- Avoid stacked bars.
- Avoid a tab bar plus dock plus transport plus arrangement strip competing vertically.
- Focused workflows may temporarily replace default navigation if safe exit remains clear.

Motion:

- 150-400ms.
- Use the locked easing.
- Confirm selection, movement, save, playback, and relationships.
- No bounce, confetti, constant floating, animated decoration, or notification drama.
- Reduced motion preserves all meaning.

Visual subtraction order:

1. Remove duplicate controls from the same state.
2. Remove premature controls.
3. Consolidate action surfaces.
4. Protect song content and whitespace.
5. Simplify status.
6. Simplify color.
7. Refine typography and spacing.
8. Add only motion that clarifies a relationship.

============================================================
PART 18 - COPY SYSTEM
============================================================

Use plain songwriter language.

Prefer:

- Add idea.
- Record memo.
- Ideas.
- Final.
- Compare.
- Listen Path.
- Add to Final.
- Suggest for Final.
- Move back to Ideas.
- Merge ideas.
- Create new draft.
- Originals stay saved.
- Review changes.
- Saved to this song.
- Your recording is safe here.
- Current version saved.
- Only the owner can change the final order.

Avoid:

- Node.
- Edge.
- Graph.
- Viewport.
- Mutation.
- Object.
- Payload.
- Metadata.
- Merge conflict.
- Promote node.
- Commit arrangement.
- Permission denied.
- Storage object missing.
- Sync hydration failed.

Copy must answer:

- What happened?
- What stayed safe?
- What can I do next?

Do not use explanatory copy to compensate for poor hierarchy.

Prefer state feedback over paragraphs.

============================================================
PART 19 - COLLABORATION AND ROLE STANDARD
============================================================

Verify role behavior for every write and decision.

OWNER

- Add and edit ideas.
- Record.
- Add to Final.
- Reorder Final.
- Review suggestions.
- Restore versions.
- Edit/export credits.
- Invite and manage roles.

CONTRIBUTOR

- Add ideas and recordings.
- Create alternates.
- Suggest lines.
- Suggest for Final.
- Build Listen Paths or merged drafts when allowed.
- Comment and encourage.
- Cannot silently overwrite owner-controlled Final.

REVIEWER

- Read and listen.
- Comment.
- Review requested items.
- Approve or recommend where rules allow.
- Cannot perform owner-only final decisions by accident.

VIEWER

- Read and listen.
- Navigate.
- See attribution.
- No misleading write controls.
- Plain role explanation where relevant.

For every collaboration action verify:

- Actor identity.
- Role.
- Created-by.
- Updated-by.
- Source contributor.
- Review state.
- Activity event.
- Version event if meaningful.
- Credit contribution type.
- Realtime visibility.
- Offline behavior.

Collaboration should feel fair and remembered, not social, competitive, or noisy.

============================================================
PART 20 - PERFORMANCE AND RESPONSIVENESS STANDARD
============================================================

Measure actual and perceived performance.

Targets:

- Mobile Lighthouse Performance at least 90 where authenticated measurement is possible.
- Accessibility at least 95.
- Best Practices 100.
- SEO 100 where route measurement applies.
- INP under 200ms.
- LCP under 2.5s.
- CLS under 0.1.
- Visible acknowledgement of tap within 100ms.
- Card focus within 100ms perceived.
- Optimistic card visible within 100ms after save intent.
- Mode switch within 150ms perceived.
- Record shell visible within 150ms after tap.
- Smooth pan/zoom/drag on a mid-tier mobile profile.
- No broad React re-render on every drag frame.
- No layout thrash during drag.
- No hidden heavy sheets mounted by default.
- No more realtime invalidation than needed.

Test:

- 1, 4, 12, 40, and stress node counts.
- Long cards.
- Many collaborators.
- Realtime updates.
- Active audio playback.
- Recording.
- Listen Path.
- Compare.
- Merge.
- Arrange.
- Keyboard open.
- Slow network.
- Offline.
- Reduced motion.
- Low-end device throttle if tooling permits.

Inspect:

- Component line counts and responsibilities.
- Context values that change during gesture frames.
- Callback stability.
- Memoization.
- Lazy boundaries.
- Audio engine duplication.
- DOM and SVG counts.
- Connector computation.
- Viewport culling or clustering.
- Query invalidation.
- Realtime subscription scope.
- Bundle chunks.

The current Canvas host may be very large. If it remains a composition root with many unrelated state machines, decompose it along user-workflow boundaries.

Do not refactor merely to hit an arbitrary line count. Refactor to:

- Prevent unrelated re-renders.
- Make focused modes mutually exclusive.
- Make state transitions testable.
- Keep persistence and rendering seams clear.
- Reduce the risk of UI regressions.

============================================================
PART 21 - ACCESSIBILITY STANDARD
============================================================

Verify:

- Semantic song heading.
- Screen-reader Canvas summary.
- Every card focusable.
- Card accessible names include type, title, contributor, tree, and relevant status.
- Connectors are hidden from assistive technology unless they convey unique meaning.
- Keyboard navigation through cards.
- Enter/Space opens focus.
- Escape closes focus or current sheet safely.
- Arrow keys pan only when Canvas owns focus.
- Visible focus ring.
- Non-drag alternatives for every move and reorder.
- Non-pinch alternatives for navigation.
- Touch targets at least 44 x 44 CSS pixels after Canvas scaling.
- No meaning communicated by color alone.
- Selected, playing, pending, saved, and Final states have non-color cues.
- Modal focus trap.
- Safe browser/platform Back.
- Announced recording state.
- Polite save/error announcements.
- Audio controls expose play/pause/state/duration.
- Reduced motion.
- Enlarged text.
- No iOS input zoom.
- Safe areas.
- High contrast.
- Viewers are not forced through disabled controls.

Treat zoom-shrunk action rows as an accessibility failure even if their Canvas-space size is 44px.

============================================================
PART 22 - PHASE C: PRIORITIZATION
============================================================

Prioritize findings in this order:

1. P0 data loss, destructive behavior, security, role, or original-preservation failures.
2. P1 first-glance comprehension blockers.
3. P1 Canvas-to-Final completion blockers.
4. P1 state stacking, trapped workflows, or multiple-primary-action failures.
5. P2 unclear save, source, destination, or undo.
6. P2 collaboration, review, realtime, activity, credits, or version integration failures.
7. P2 accessibility and effective touch-target failures.
8. P2 gesture and performance problems.
9. P3 hierarchy, copy, and visual clutter.
10. P4 optional refinement.

For every planned change include:

- Finding ID.
- User evidence.
- Source evidence.
- Root cause.
- Smallest effective intervention.
- Capability preserved.
- Controls removed from the current state.
- New canonical entry.
- Files likely affected.
- Risk.
- Tests required.
- Before/after success criterion.

Prefer:

- Removing simultaneous decisions over removing capability.
- Contextual power over permanent toolbars.
- One action surface over stacked bars.
- Better feedback over extra explanation.
- A clear next action over a list of possibilities.
- Post-success next steps over pre-action setup.
- Local-first safety over optimistic ambiguity.
- Reusing established primitives over adding systems.
- Plain songwriter language over product terminology.
- Reversible behavior over destructive shortcuts.
- Server-authoritative permissions with immediate UI clarity.
- Integrating existing features over adding new ones.

============================================================
PART 23 - IMPLEMENTATION INSTRUCTIONS
============================================================

Implement the evidence-backed upgrades.

Do not merely propose them.

Rules:

- Preserve existing feature semantics and data contracts.
- Keep TypeScript strict.
- Do not introduce `any`.
- Use existing design tokens and components.
- Keep the cream/gold/charcoal language.
- Keep serif creative hierarchy.
- Keep gold for primary/system actions.
- Maintain effective 44px touch targets.
- Honor reduced motion.
- Use human error copy.
- Preserve local-first recording and draft safety.
- Keep server state in established query/seam patterns.
- Keep Canvas entry lightweight.
- Lazy-load focused tools.
- Use one audio session/controller.
- Prevent duplicate persistence.
- Do not add `console.log`.
- Do not touch unrelated files.
- Use the required patch/edit workflow.
- Add or update tests for every behavioral change.
- Preserve unrelated existing test coverage.
- Do not revive retired legacy Canvas FABs.
- Do not weaken capability checks.

For every change:

1. Identify finding ID.
2. Capture baseline evidence.
3. State the capability being preserved.
4. Implement the smallest cohesive fix.
5. Run focused tests.
6. Re-run the exact user journey.
7. Measure the result.
8. Verify upstream and downstream integrations.
9. Confirm no feature became unreachable.
10. Record before/after evidence.

Do not batch unrelated aesthetic preferences.

============================================================
PART 24 - REQUIRED VERIFICATION
============================================================

At minimum run:

- Focused Canvas component tests.
- Canvas route tests.
- Canvas persistence tests.
- Card create/edit/move tests.
- Add-to-Final and move-back tests.
- Drag/pan/pinch interaction tests.
- Effective mobile touch-target checks.
- Voice-card playback tests.
- Canvas recording lifecycle tests.
- Pending upload recovery tests.
- Listen Path tests.
- Compare tests.
- Merge tests.
- Weave tests.
- Final Arrangement tests.
- Line suggestion tests.
- Review queue tests.
- Recap/deep-link tests.
- Role/capability tests.
- Realtime collaboration tests where supported.
- Activity/version/credits integration tests.
- Accessibility tests.
- Typecheck.
- Focused lint.
- Production build.
- Performance/bundle checks defined by the repository.

Runtime verification must cover:

- 390 x 844.
- 360 x 800.
- 430 x 932.
- 768 x 1024.
- 1440 x 900.
- Empty Canvas.
- Small active Canvas.
- Dense Canvas.
- Owner.
- Contributor.
- Reviewer.
- Viewer.
- Card focus.
- Record.
- Listen Path.
- Compare.
- Merge.
- Weave.
- Arrange.
- Review.
- Recap.
- Offline.
- Recovery.
- Reduced motion.
- Keyboard navigation.
- Screen-reader-oriented DOM inspection.

Check:

- Browser console errors.
- Network errors.
- Duplicate rows/cards/events.
- Stale workflow state after exit.
- Z-index and focus conflicts.
- Safe-area collisions.
- Bottom-surface stacking.
- Unrelated files.

Do not call the work complete because tests pass if the first-time Canvas remains confusing.

============================================================
PART 25 - REQUIRED DELIVERABLES
============================================================

Produce these artifacts in order.

DELIVERABLE 1 - Persona Contract

A concise statement of Jordan's knowledge, expectations, fears, collaboration needs, and definition of trust.

DELIVERABLE 2 - First-Time Canvas Diary

A timestamped account of:

- What Jordan saw.
- What Jordan expected.
- What Jordan did.
- What happened.
- Confidence.
- Friction.
- Emotional response.
- Evidence.

DELIVERABLE 3 - Current Surface Inventory

Every visible and conditional control, its source, state, role, user job, and competition.

DELIVERABLE 4 - Clutter and Attention Map

For every tested state show:

- Dominant focal point.
- Competing focal points.
- Number of emphasized actions.
- Number of persistent surfaces.
- Content area lost to chrome.
- Recommended subtraction.

DELIVERABLE 5 - Feature Usefulness Ledger

Every Canvas and adjacent feature, its job, moment, frequency, cost, canonical entry, disclosure tier, and destination.

DELIVERABLE 6 - Atom and Molecule Audit

A complete table with no vague grouped conclusions.

DELIVERABLE 7 - Canvas State Map

Create a Mermaid state diagram covering:

Browse
-> card focus
-> capture/develop
-> compare or merge
-> Final
-> arrange
-> preview
-> review
-> return

Include recording, Listen Path, Compare, Merge, Weave, Arrange, Review, Recap, offline, error, undo, restore, and permission branches.

DELIVERABLE 8 - Mode Exclusivity Matrix

Show which focused modes may coexist, pause, cancel, or restore one another.

DELIVERABLE 9 - Progressive Disclosure Blueprint

Show default, contextual, focused-workflow, collaboration, and trust tiers.

DELIVERABLE 10 - Visible Control Budget

For every major state list exactly what stays visible and why.

DELIVERABLE 11 - Integration Matrix

Show every input, transformation, destination, persistence boundary, attribution boundary, and collaborator-facing result.

DELIVERABLE 12 - Role and Collaboration Matrix

Owner, Contributor, Reviewer, Viewer actions and feedback.

DELIVERABLE 13 - Prioritized Findings

P0-P4 findings with evidence and the smallest effective intervention.

DELIVERABLE 14 - Implementation Plan

Map findings to exact files, changes, preserved capabilities, and tests.

DELIVERABLE 15 - Implemented Changes

For every change provide:

- Finding ID.
- Files changed.
- Behavior preserved.
- Behavior upgraded.
- Controls removed or moved from the state.
- Canonical entry after the change.
- Tests added or updated.

DELIVERABLE 16 - Before/After Validation

For every fixed issue:

- Before.
- After.
- Metric or observed result.
- Screenshot evidence.
- Regression coverage.
- Remaining limitation.

DELIVERABLE 17 - Feature Reachability Proof

Prove that every preserved feature remains findable in the correct context after simplification.

DELIVERABLE 18 - Final Canvas Quality Scorecard

Score:

- First-glance understanding.
- Song-title and root clarity.
- Ideas/Final comprehension.
- Primary-action clarity.
- Usefulness to songwriting.
- Visual calm.
- Card recognition.
- Spatial orientation.
- Capture integration.
- Listen Path usefulness.
- Compare usefulness.
- Merge usefulness.
- Weave usefulness.
- Final Arrangement usefulness.
- Collaboration clarity.
- Review clarity.
- Attribution and credits.
- Original preservation.
- Recovery.
- Accessibility.
- Performance.
- Mobile ergonomics.
- Emotional and spiritual warmth.
- Overall friction.

Do not give a 10 without evidence.

============================================================
PART 26 - DEFINITION OF DONE
============================================================

The work is complete only when:

- In under three seconds, a first-time songwriter knows the song, the active space, and the next useful action.
- The default mobile Canvas emphasizes no more than one primary and one supporting action.
- The song content occupies more attention than Canvas chrome.
- Ideas and Final are understandable without a tutorial.
- The root song remains a meaningful anchor.
- Cards are recognizable by type and contributor without badge overload.
- Selecting a card makes the next action clearer, not busier.
- Advanced features appear only when eligible or intentionally entered.
- Only one bottom action surface owns the safe area at a time.
- Recording, Listen Path, Compare, Merge, Weave, Arrange, and Review do not stack or conflict.
- The user can exit every focused workflow and return to the correct Canvas context.
- No core action depends only on a hidden gesture.
- Touch targets remain at least 44 x 44 CSS pixels at rendered zoom.
- Every destructive-looking action clearly preserves or restores originals.
- Moving to Final is non-destructive and reversible.
- Merge and line replacement preserve source lineage.
- Collaboration is calm, honest, role-aware, and attributed.
- Review decisions update Canvas, activity, versions, and credits exactly once.
- What Changed deep-links to exact context without notification noise.
- Empty, loading, offline, error, conflict, and recovery states are designed.
- A dense Canvas summarizes or clusters before shrinking into illegibility.
- Pan, zoom, selection, drag, and realtime updates remain smooth on mobile.
- Every implemented change has a test or explicit runtime verification.
- Typecheck, focused lint, tests, build, and performance gates pass.
- Unrelated work remains untouched.
- Observed evidence is distinguished from inference.
- Every preserved feature has a proven canonical entry.
- The app feels simpler because the product flow is clearer, not because capability disappeared.

Final governing question:

Could a songwriter open this room for the first time, see the song forming, focus on one useful idea, safely move it toward a final arrangement, understand what collaborators contributed, and know the next step - without feeling like they opened whiteboard software?

If the honest answer is not an evidence-backed yes, continue working.

When complete:

- Commit only the scoped files if the active execution instructions authorize a commit.
- Do not push or publish unless explicitly authorized.
- Report the exact commit and verification state.
