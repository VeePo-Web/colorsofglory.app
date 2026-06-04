# Colors of Glory Feature 01 Prompt
## Song Object Foundation + Song Whiteboard Canvas / Core Tree System

Paste this entire prompt into Claude Code / Antigravity for Feature 01.

Source docs to read first:
- `zip_extracted/20. SONGWRITING SPECIFIC PART/3. System operations/COG_Product_01_Song_Whiteboard_Canvas_Core_Tree_System_UX_Build_Handoff.pdf`
- `zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/Colors_of_Glory_32_Songwriting_Engine_Feature_Roadmap (1).pdf`
- `docs/CODEX-WHITEBOARD-PERFORMANCE-AUDIT.md`
- `docs/COG-UI-VISUAL-BRIEF.md`
- `docs/claude-build-persona.md`
- root `AGENTS.md`

## Role

You are building Feature 01 for Colors of Glory, a mobile-first songwriting collaboration app for Christian songwriters, worship leaders, and creative teams.

Your role is Claude/Antigravity frontend product builder:
- Build the feature UI, UX, interaction model, component structure, and client-side behavior.
- Keep backend/database/payment responsibilities out of scope unless interfaces already exist.
- Do not invent backend schema migrations unless explicitly requested by Lovable/backend lane.
- Do not create generic dashboards, generic note apps, generic graph tools, or unrelated marketing surfaces.

Codex will audit performance, route stress, bundle cost, mobile UX, and instant-feel after your implementation. Build in a way that will survive that audit.

## Feature Identity

Feature 01 is the foundation of the songwriting engine.

Roadmap name:
Song Object Foundation.

Full PDF handoff name:
Song Whiteboard Canvas / Core Tree System.

The product meaning:
Every song is a private room. The song is not a loose file, a note, or a folder. It is a living creative object with lyrics, voice memos, chords, notes, ideas, collaborators, activity, versions, meaning, and final arrangement all connected inside one room.

The first visible expression of that foundation is the whiteboard canvas:
- one central root song object
- idea branches around the root
- contributor identity visible
- Add idea as the primary action
- Record memo as the secondary action
- Ideas / Final / Compare as the first mental model

North Star:
The user should think: "Oh, this is where all the song ideas live."

## Non-Negotiable Product Principle

Build deep, not wide.

Do not scatter the songwriting engine across many standalone pages. Existing legacy routes may redirect into the canvas, but the experience must resolve into one main song room:

Canonical route:
`/songs/:songId/canvas`

Supported query state:
- `?layer=room`
- `?layer=ideas`
- `?layer=lyrics`
- `?layer=voice`
- `?layer=chords`
- `?layer=notes`
- `?layer=people`
- optional future: `?mode=ideas|final|compare`

If you add any new feature mode, it must fold into this song room. Do not create a separate top-level page unless it is a lightweight redirect or a future export/handoff flow.

## What You Are Building In This Feature

Build the first production-quality version of the song whiteboard foundation:

1. A mobile-first song room canvas.
2. A central root song card.
3. Four visible starter idea branches.
4. Contributor-colored branch nodes.
5. Soft curved connectors.
6. Ideas / Final / Compare mode switcher.
7. Add idea flow.
8. Record memo launcher placeholder or UI shell.
9. Selected node inspector.
10. Role-aware disabled states.
11. Empty, loading, syncing, error, and offline-safe visual states.
12. Accessibility layer for a visual canvas.
13. Performance architecture that can grow into the full 33-feature engine.

This feature should be useful before it is powerful. Start with a beautiful small tree. Do not reveal the whole future engine at once.

## UX Sentence

This is the song room where every idea has a visible place.

## Target User State

The user has already created or opened a song. They may be:
- a new direct user with their first song
- a returning owner
- a contributor
- a reviewer
- a viewer
- an invited collaborator arriving from an invite link

The canvas must preserve:
- `songId`
- `workspaceId`
- `ownerId`
- membership role
- invite/referral context if present
- selected node
- last active layer/mode
- viewport state when useful

Invite users should route directly into the song canvas after acceptance. Do not detour high-intent collaborators into a generic dashboard.

## Route And Navigation Requirements

Use the existing app route:

`/songs/:songId/canvas`

Layer/mode changes:
- Update query params with `replace: true` unless this is a true navigation transition.
- Do not make the back button step through every layer tap.
- Old route shells like `/songs/:id/lyrics`, `/voice`, `/chords`, `/notes`, `/people`, `/activity`, `/credits` should redirect into canvas layers.

Layer selection behavior:
- If target section is offscreen, scroll it into view.
- If target is already visible, do not force scroll.
- Respect `prefers-reduced-motion`.
- Use instant scroll for reduced motion.
- Avoid queued smooth scroll on repeated taps.

## Visual Direction

Use Colors of Glory locked brand system:
- warm cream background
- soft gold accents
- charcoal text
- Playfair/serif song title feeling
- Inter/humanist UI body
- calm card surfaces
- warm radial glow

The visual baseline from the PDF:
- title: `Grace in the Waiting`
- tabs: `Ideas`, `Final`, `Compare`
- centered root card: `Grace in the Waiting`
- branch cards:
  - `Sarah - Chorus melody`
  - `Michael - Verse lyric`
  - `Kevin - Piano memo`
  - `Ava - Bridge harmony`
- primary CTA: `Add idea`
- secondary action: `Record memo`
- optional empty-state line: `Start with one lyric, memo, chord idea, or note.`

Preserve the feeling:
- one focused mobile canvas
- one central song
- soft branch connectors
- contributor colors
- obvious next action
- calm, premium, spiritual creative warmth

Do not copy generic diagram tools.

## Church Center UX Standard

The user should feel like they already know what to do.

Apply these rules:
- One obvious primary action: Add idea.
- Record memo is always easy to find, but secondary.
- No heavy setup before contribution.
- No tutorial wall.
- No generic toolbars.
- No noisy notification badges.
- No aggressive upgrade prompt on the default canvas.
- No red error panic.
- No dead blank states.

Church Center-style clarity questions:
1. What song am I in?
2. What part of the song am I touching?
3. Is my idea saved?
4. Who added this?
5. What can I do next?

The UI should answer those questions through layout before copy.

## Fantasy.co Craft Standard

Make it feel bespoke, not template-built.

Craft requirements:
- The song title must have emotional weight.
- The root card must feel like the source of the room.
- Branches should feel like song ideas, not task cards.
- Curved lines should be subtle and organic, not technical arrows.
- Motion should make the song feel alive and organized.
- The default screen should feel calm enough to write in.

The canvas should be beautiful, but not decorative. Every visual element must clarify the song.

## Information Hierarchy

Priority order:
1. Song title.
2. Mode tabs: Ideas / Final / Compare.
3. Root song card.
4. Branch idea cards.
5. Add idea.
6. Record memo.
7. Selected node inspector, hidden until needed.

Avoid these labels:
- Create board
- New node
- Add file
- Collaborator graph
- Open dashboard
- Graph mutation
- Permission denied

Use human songwriting language:
- Add idea
- Record memo
- Chorus melody
- Verse lyric
- Piano memo
- Bridge harmony
- Saved to this song
- Your recording is safe here

## Component Architecture

Use the current React 18 + Vite + TypeScript stack.

Recommended component map:

```txt
src/pages/SongCanvasPage.tsx
src/components/cog/whiteboard/
  SongWhiteboardHeader.tsx
  SongWhiteboardCanvas.tsx
  RootSongNode.tsx
  IdeaBranchNode.tsx
  CurvedEdge.tsx
  NodeInspector.tsx
  AddIdeaSheet.tsx
  RecordMemoLauncher.tsx
  WhiteboardEmptyState.tsx
  WhiteboardSkeleton.tsx
  WhiteboardA11ySummary.tsx
src/lib/whiteboard/
  graphLayout.ts
  whiteboardTypes.ts
  whiteboardPermissions.ts
  whiteboardOptimistic.ts
  whiteboardAnalytics.ts
```

Keep files small and focused.

Do not turn `SongCanvasPage.tsx` into a mega-file. Route files should orchestrate; feature components should do the actual rendering.

## Data Model Shape

Use real typed structures even if backend calls are mocked for now.

```ts
type WhiteboardMode = "ideas" | "final" | "compare";
type SongRole = "owner" | "contributor" | "reviewer" | "viewer";

type IdeaType =
  | "lyric"
  | "voice"
  | "hum"
  | "chord"
  | "note"
  | "scripture"
  | "story"
  | "arrangement"
  | "section";

type IdeaStatus =
  | "private"
  | "shared"
  | "raw"
  | "shortlisted"
  | "sent_to_owner"
  | "added_to_final"
  | "archived"
  | "syncing"
  | "error";

interface SongIdeaNode {
  id: string;
  songId: string;
  parentId: string | null;
  type: IdeaType;
  status: IdeaStatus;
  title: string;
  preview: string;
  contributorId: string;
  contributorName: string;
  contributorColor: string;
  sectionLabel?: string;
  mediaId?: string;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
  position: { x: number; y: number };
  visibility: "private" | "shared";
}

interface SongIdeaEdge {
  id: string;
  songId: string;
  fromNodeId: string;
  toNodeId: string;
  type: "branch" | "source" | "merge" | "final";
}

interface WhiteboardState {
  songId: string;
  mode: WhiteboardMode;
  role: SongRole;
  nodesById: Record<string, SongIdeaNode>;
  nodeOrder: string[];
  edgesById: Record<string, SongIdeaEdge>;
  edgeOrder: string[];
  selectedNodeId?: string;
  viewport: { x: number; y: number; zoom: number };
  isLoading: boolean;
  isSyncing: boolean;
  error?: string;
}
```

Important:
- Normalize nodes by id.
- Keep order arrays separate.
- Do not repeatedly filter giant arrays in render for every interaction.
- Preserve node lineage for future Final, Compare, Merge, Credits, and Versions.

## Interaction Requirements

Default open:
- User lands in Ideas mode.
- Root song card appears first.
- Existing idea branches appear around it.
- Add idea is the dominant CTA.
- Record memo is visible as secondary.

Add idea:
- Opens a lightweight sheet or inline composer.
- Type choices: lyric, voice memo, chord, note, scripture/story, arrangement.
- Creates optimistic node attached to selected node or root.
- New node shows `Syncing` state.
- On success, show quiet saved state.
- On failure, preserve draft and show friendly recovery.

Record memo:
- Requests microphone permission only when recording starts.
- Does not route away from the song.
- Creates a memo node attached to selected node or root.
- If upload fails, preserve local draft when possible.
- Use a placeholder shell if real recording backend is not ready, but design the boundary correctly.

Node selection:
- Selecting a branch highlights it.
- Opens contextual inspector.
- Inspector actions:
  - Add to Final
  - Compare
  - Comment
  - Merge
  - Archive
- Do not show inspector by default on first open.

Mode switching:
- Ideas: exploratory branches.
- Final: clean owner-controlled selected arrangement.
- Compare: discernment mode for two branches or variants.

Role behavior:
- Owner: full controls.
- Contributor: add ideas, memos, comments, suggestions; cannot overwrite final.
- Reviewer: comment/review; creation can be limited.
- Viewer: read/listen only; Add idea and Record memo disabled with quiet role copy.

## Performance Requirements

This is the most important section. Build this feature as if it will eventually support huge songs.

Current Codex budget reference:
- `SongCanvasPage` route chunk should stay under 16 kB raw.
- Individual feature chunks should aim under 8 kB raw unless justified.
- Main JS should not grow from whiteboard-specific feature imports.
- Heavy features must lazy-load behind user intent.

Mandatory performance rules:
1. Do not import audio processing, transcription, drag libraries, export libraries, charting libraries, or editor-heavy dependencies into `App.tsx`, shared layout, bottom nav, or the base canvas route.
2. Keep the first canvas render light: root, summary branches, and primary actions only.
3. Lazy-load heavy tools:
   - AddIdeaSheet
   - RecordMemoLauncher
   - NodeInspector advanced actions
   - Compare mode internals
   - Final arrangement internals
4. Do not mount all future feature tools at once.
5. Use summaries in room/default mode and mount full editors only in focused modes.
6. Use memoized node rendering.
7. Avoid creating new callbacks per node in giant lists.
8. Use normalized state and selectors to prevent whole-canvas re-renders.
9. Render visible nodes only when node count grows.
10. Do not animate every node continuously.

Required scalability targets:
- 50 nodes: fully smooth.
- 250 nodes: interaction still responsive.
- 1,000 nodes: must use virtualization, clustering, or viewport culling.
- 5,000 nodes: must still load through summaries/groups, not direct full rendering.

Interaction targets:
- Layer/mode switch: under 150 ms perceived.
- Node selection: under 100 ms on mid-tier mobile.
- Add idea optimistic node: visible within 100 ms.
- Audio record launch shell: visible within 150 ms after tap.
- No React state animation loop above 10 updates per second.

DOM rules:
- Do not render thousands of full branch cards.
- Do not render offscreen node inspectors.
- Do not keep hidden heavy panels mounted.
- Keep SVG connectors lightweight and derived from visible nodes.

## Audio Performance Contract

For Feature 01, Record memo can be a launcher/shell if real audio is not ready.

But the architecture must not paint the app into a corner.

Rules:
- One song-level player/recorder controller later, not one independent audio engine per card.
- Waveform peaks should be precomputed or generated off-main-thread.
- Playback progress should use CSS transform or requestAnimationFrame outside broad React re-render paths.
- Only the active memo player should mount.
- Store waveform summaries, not huge raw arrays, on visible nodes.
- Never block the canvas render on mic permission, upload, or waveform generation.

User-facing copy:
- `Record memo`
- `Recording...`
- `Your recording is safe here. Try uploading again.`
- `Turn on microphone access to record a memo.`

## Loading, Empty, Error, Offline States

Canvas loading:
- Show soft skeleton root and branch placeholders.
- Copy: `Opening song ideas...`
- No blank white screen.

Empty:
- Show root song card.
- Copy: `Start with one idea. Add a lyric, memo, chord, or note.`
- Add idea remains primary.

Add idea failure:
- Preserve draft.
- Copy: `We could not save that idea yet. Try again.`

Record upload failure:
- Preserve local recording if possible.
- Copy: `Your recording is safe here. Try uploading again.`

Network failure:
- Keep cached tree if available.
- Copy: `We could not refresh the canvas. Your saved ideas are still here.`

Role restriction:
- Disable unavailable controls.
- Copy: `You can view this song, but only contributors can add ideas.`

Conflict:
- Copy: `This idea changed on another device. Review both versions.`

Never show technical error strings to users.

## Accessibility Requirements

The canvas must be visual and accessible.

Requirements:
- Use semantic heading for song title.
- Provide screen reader summary:
  - `Grace in the Waiting has 4 idea branches.`
- Every node must be focusable.
- Node accessible names must include contributor and idea:
  - `Sarah, Chorus melody, idea branch`
- Keyboard support:
  - Tab through controls and nodes.
  - Enter opens node inspector.
  - Escape closes inspector.
  - Arrow navigation if practical.
- Provide zoom reset and non-pointer alternatives when pan/zoom exists.
- Do not rely on color alone for contributor identity.
- Use visible focus ring.
- Respect reduced motion.
- Touch targets must be at least 44px.
- Keep text contrast WCAG AA minimum.

Do not render the tree only as inaccessible canvas pixels. If SVG/canvas is used for connectors, keep nodes as semantic HTML buttons/cards.

## Motion Requirements

Use motion sparingly and physically.

Good:
- root fades in first
- branches softly appear
- connector draw-on once
- selected node lifts 2-4px
- Add idea press scale 0.985
- save toast fades in/out

Bad:
- bouncy/gamified cards
- constant floating nodes
- heavy blur filters
- giant animated backgrounds
- confetti
- motion that continues while the user is writing

Reduced motion:
- Disable branch growth.
- Use opacity or instant layout.
- Avoid smooth pan if user requests reduced motion.

## Analytics Requirements

Add safe analytics hooks or event boundary functions. Do not log creative content.

Events:
- `whiteboard_viewed`
- `whiteboard_add_idea_clicked`
- `whiteboard_record_memo_clicked`
- `whiteboard_node_created`
- `whiteboard_node_selected`
- `whiteboard_tab_changed`
- `whiteboard_add_to_final_clicked`
- `whiteboard_error`

Safe properties:
- hashed song id
- role
- node type
- node count bucket
- mode
- status
- time to save bucket

Forbidden analytics payloads:
- full lyrics
- full transcripts
- raw invite tokens
- private comments
- phone numbers
- emails
- unreleased song content

## Security And Trust Requirements

Frontend must show permissions clearly, but backend is authority.

Assume all future writes must be validated server-side:
- node creation
- media uploads
- final actions
- comments
- merge/archive/restore
- membership roles
- storage ownership

Trust rules:
- Archive before delete.
- Contributors cannot overwrite final song sections directly.
- Final is owner-controlled.
- Versions and contribution lineage must be preserved.
- Private ideas remain private until shared.

## Existing App Integration

Use the current project stack:
- React 18
- Vite
- TypeScript strict
- Tailwind CSS v3
- shadcn/ui
- Framer Motion only where needed
- React Router DOM v6
- TanStack Query for server state
- Supabase client boundaries only where already established
- Lucide React icons

Respect existing components and design tokens.

Do not introduce:
- a new styling system
- CSS-in-JS
- global state library unless already approved
- new heavy graph/audio dependency without lazy boundary and justification

If a graph library is considered, first prefer HTML/SVG with simple layout for Feature 01. Add a library only when the complexity is real and only behind a lazy chunk.

## What Not To Build

Do not build:
- Miro-style toolbar
- DAW timeline
- audio mixer
- spreadsheet/tree table
- dashboard chrome
- chaotic sticky-note wall
- decorative music-note clutter
- pricing prompt on default canvas
- destructive delete as default
- everyone-can-edit-final behavior
- technical labels like node, edge, graph, mutation

Default state must stay calm, obvious, and usable.

## Acceptance Criteria

Feature 01 passes only if:
- A user understands in under three seconds that the song sits at the center and ideas branch around it.
- The route is one private song room, not scattered pages.
- Add idea is the obvious primary action.
- Record memo is available without DAW complexity.
- Branches are tied to contributors and future lineage.
- Root song is visually central.
- Nodes are focusable and accessible.
- Viewer/contributor/reviewer/owner permissions are reflected.
- Loading, empty, error, syncing, and role states are designed.
- No legacy-brand residue remains.
- No generic whiteboard/dashboard/DAW patterns appear.
- Bundle budgets still pass.
- Mobile 390px render is clean.
- Reduced motion is respected.
- Codex QA gate passes.

## Required Tests / Verification

Before marking complete, run:

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run perf:budget
npm.cmd run qa:mobile
npm.cmd run qa:codex
```

Add or update tests for:
- `/songs/:id/canvas` renders at 390px.
- Song title, Ideas/Final/Compare, root card, Add idea, and Record memo appear.
- Nodes have accessible names.
- Viewer role disables write actions.
- Add idea creates an optimistic visible branch.
- Old routes redirect into the canvas layer where applicable.
- No "coming soon" placeholder is reachable.
- No old-brand terms are present.

Add future stress test scaffold if practical:
- render 250 mock nodes
- select a node
- assert visible UI updates without crashing

## Codex Performance Gate To Preserve

Do not weaken existing performance budgets to make the feature pass.

If a budget fails, split the route or lazy-load the heavy tool. Do not raise the budget unless Codex explicitly approves after analysis.

Current benchmark to protect:
- Canvas route chunk under 16 kB raw.
- Work/tree/collab chunks under 8 kB raw when possible.
- Main JS under current project budget.
- Shared client chunk monitored.

## Final Build Instruction

Build Feature 01 as the first beautiful, useful version of the songwriting engine.

The user should not feel like they are managing a board.
They should feel like they stepped into the song room and can finally see where every idea belongs.

The root song must remain central.
The first action must remain obvious.
The feature must feel instant.
The architecture must be ready for the next 32 songwriting features without turning the room into software clutter.
