# Colors of Glory Feature 02 Master Prompt
## Song Workspace Shell: Private Song Room Home Base

Paste this prompt into Claude Code / Antigravity for Feature 02.

Feature source:
- `zip_extracted/20. SONGWRITING SPECIFIC PART/4. SONG WRITING CANVAS/Colors of Glory - Feature 2 UX + Product + Implementation Plan.docx`
- Root `AGENTS.md`
- Current route: `src/pages/SongWorkspacePage.tsx`
- Current app routing: `src/App.tsx`

## Role

You are building Feature 02 for Colors of Glory: the Song Workspace Shell.

Colors of Glory is a mobile-first Christian songwriting collaboration app. Every song is a private creative room where lyrics, voice memos, chords, notes, collaborators, activity, versions, credits, and canvas ideas stay connected.

This feature is only the `/songs/:songId` workspace shell. Do not build the whiteboard canvas internals, payment UI, onboarding, transcription, audio engine, exports, or backend schema. Lovable owns backend foundations. Claude/Antigravity owns feature UI. Codex owns performance, frontend/backend seams, instant-feel QA, subtle UX corrections, and release readiness.

## Feature Goal

Create the calm private-room shell for one song.

The user should land here and understand within three seconds:

> I am inside this song. Everything belongs here. I know what to do next.

The shell must show:

- song title as the visual anchor
- `Private song room` or `Invited song room`
- role chip: Owner, Contributor, Reviewer, Viewer
- save/sync state: Saved, Saving, Offline, Error
- key/BPM when available
- collaborator stack
- one primary next-action card
- module cards for Canvas, Lyrics, Voice, Chords, Notes, People
- calm activity preview when relevant
- storage notice only when relevant
- permission-limited state when needed

## Recommended Implementation Approach

Use a service-driven, componentized shell.

Keep `src/pages/SongWorkspacePage.tsx` as the route orchestrator, but move UI into focused components:

- `src/components/song-workspace/SongWorkspaceShell.tsx`
- `src/components/song-workspace/SongHeader.tsx`
- `src/components/song-workspace/PrimaryNextActionCard.tsx`
- `src/components/song-workspace/SongModuleGrid.tsx`
- `src/components/song-workspace/SongModuleCard.tsx`
- `src/components/song-workspace/SongActivityPreview.tsx`
- `src/components/song-workspace/SongCollaboratorStack.tsx`
- `src/components/song-workspace/SongStorageNotice.tsx`
- `src/components/song-workspace/SongPermissionNotice.tsx`
- `src/lib/songs/getSongWorkspaceSummary.ts`
- `src/lib/songs/resolveSongNextAction.ts`
- `src/lib/songs/songPermissions.ts`
- `src/lib/songs/songRoutes.ts`

Use mock/service adapters if backend is not ready, but do not hardcode backend logic inside UI components.

## UX Rules

One obvious primary action. Never show three equal CTAs.

Next action logic:

- empty song -> `Record first idea`
- voice memo exists, no lyrics -> `Add lyrics`
- collaborator changes exist -> `Review changes`
- final arrangement exists -> `Preview song`
- handoff ready -> `Prepare handoff`
- viewer role -> `Listen / View lyrics`
- storage blocked -> `Manage storage`

Keep the language human:

- `Saved just now`
- `You are offline. Changes will sync when connection returns.`
- `You can view this song. Ask the owner if you need to add ideas.`
- `Your songs are safe. New uploads may pause soon.`

Never use backend, auth, storage, mutation, RLS, policy, or permission-matrix language in the UI.

## Visual Standard

Match Colors of Glory, Church Center clarity, and Fantasy.co polish:

- warm cream background
- subtle gold radial glow
- Playfair/serif song title
- charcoal text
- restrained gold primary action
- tactile rounded cards
- no blue SaaS UI
- no red notification panic
- no generic dashboard density
- no DAW controls
- no Miro/toolboard feeling
- no pricing prompt on first open

The page should feel like a creative sanctuary, not software administration.

## Performance Contract

This feature must feel instant.

Targets:

- route transition perceived under 150ms after chunk load
- primary action tap feedback under 100ms
- module card tap feedback under 100ms
- metadata save state visible immediately
- no layout shift when save state, role, key, BPM, or collaborator count changes
- clean 390px mobile render
- no hidden heavy modules mounted

Rules:

- Do not import canvas, audio recorder, waveform, Stripe, export, transcription, chart, or drag-heavy logic into the workspace shell.
- Keep `/songs/:songId` route light.
- Lazy-load deeper modules only after user intent.
- Do not mount all future feature previews.
- Do not run derived filters inside render repeatedly.
- Memoize stable module card data.
- Keep buttons at least 44px, target 56px for primary mobile actions.
- Skeleton state must use fixed dimensions to avoid CLS.
- Respect `prefers-reduced-motion`.

Codex should block the feature if it increases the main bundle unnecessarily or makes the shell depend on canvas/audio/payment chunks.

## Backend/Lovable Seam

Create typed service boundaries Lovable can wire later:

```ts
type SongWorkspaceSummary = {
  songId: string;
  title: string;
  subtitle: "Private song room" | "Invited song room";
  currentUserRole: "owner" | "contributor" | "reviewer" | "viewer";
  saveState: "saved" | "saving" | "offline" | "error";
  key?: string | null;
  bpm?: number | null;
  primaryNextAction: SongNextAction;
  moduleCards: SongModuleCard[];
  activityPreview?: ActivityDigestPreview;
  collaborators: CollaboratorPreview[];
  storageState: "safe" | "near_limit" | "blocked";
};
```

Frontend can use mock data for now, but the component contract must be backend-ready.

## Required States

Implement or scaffold visually:

- loading skeleton
- empty first song
- active song with one voice memo
- collaborator changes
- archived/read-only song
- viewer permission-limited song
- storage near-limit notice
- offline state
- save failed state
- not found / no access recovery

## Accessibility

- song title is the route `h1`
- shell uses `<main>`
- focus order: header -> primary action -> modules -> activity/storage
- all cards are buttons/links with explicit labels
- save/error state uses polite `aria-live`
- role/permission notices are readable by screen readers
- keyboard users can open every module
- reduced motion works
- gold text is not used where contrast is weak

## Required Tests And QA

Add/update tests for:

- `/songs/:id` renders at 390px
- H1 song title appears
- one primary next action appears
- module cards render and route correctly
- next-action resolver handles major song states
- viewer role disables creation actions
- loading/error/offline states render
- no fly4me/old-brand residue
- accessibility labels exist

Run:

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run perf:budget
npm.cmd run qa:mobile
npm.cmd run qa:codex
```

## Acceptance Criteria

Feature Two passes only when the workspace opens as a calm private song room, shows one obvious next action, routes into the right modules without friction, stays mobile-clean at 390px, keeps backend logic out of UI components, and feels instant.
