# Colors of Glory Next Milestone Handoff
## Claude Frontend Slice, Lovable Backend Foundations, Codex Audit Gate

This handoff defines the next milestone after the Codex operating plan is created.

The goal is to let Claude Code and Lovable keep building while Codex waits for a stable product slice to audit. Codex should not optimize unfinished screens. Codex should pressure-test the first usable slice once the core frontend and backend foundations exist.

---

## 1. Current Codex Rulebook Status

Codex operating plan branch:

```text
codex/codex-operating-plan
```

Codex operating plan file:

```text
CODEX_OPERATING_PLAN.md
```

Pull request creation URL:

```text
https://github.com/VeePo-Web/colorsofglory.app/pull/new/codex/codex-operating-plan
```

Decision:

- Keep this branch as the permanent Codex rulebook branch until reviewed.
- Merge it when the team is ready to make Codex's role permanent on `main`.
- Do not mix Claude frontend rebuild files or Lovable backend work into this Codex-only PR.

---

## 2. Ownership Boundaries

### Claude Code Owns The First Frontend Slice

Claude Code should build the first usable COG frontend slice:

1. Song Catalog.
2. First Song Workspace.
3. Lyrics + Chords.
4. Voice Memo capture mock / UX.
5. Invite and role-selection shell.

Claude should focus on:

- Visual implementation.
- Frontend routing.
- Component composition.
- Screen states.
- COG design language.
- Mobile-first usability.
- Mock or placeholder data when backend is not ready.

Claude should not wait for every Lovable backend detail before making the first slice usable.

### Lovable Owns Backend Foundations

Lovable should wire:

1. Auth.
2. Songs.
3. Collaborators.
4. Voice memo storage.
5. Activity log basics.
6. Plan and free-song limit.

Lovable should focus on:

- Supabase schema.
- Auth/session logic.
- Storage buckets and access rules.
- Payment/subscription foundations.
- Backend permissions.
- Server-side plan boundaries.

Lovable should not decide frontend visual language or override the COG UX system.

### Codex Owns The First Real Audit

Codex should wait until Claude's first slice is navigable and Lovable's backend foundations are either connected or mocked clearly enough to test states.

Codex then audits:

1. Mobile 390px QA.
2. Layout shift.
3. Tap and route responsiveness.
4. Route stress states.
5. Accessibility basics.
6. Loading, failed, and offline states.
7. "Does this feel instant?" product pass.

Codex should report findings, not redesign the product.

---

## 3. Claude First Slice Acceptance Criteria

The first frontend slice is ready for Codex when these routes or equivalent screens are navigable:

```text
/                      Song Catalog
/song/:id              Song Workspace
/song/:id/lyrics       Lyrics + Chords
/song/:id/voice        Voice Memo UX
/song/:id/people       Invite / Roles shell
/invite/:token         Invite Preview shell
```

### Required Frontend States

Claude should include at least:

- Empty catalog.
- Catalog with several songs.
- One active song.
- One invited song.
- Song workspace empty state.
- Song workspace populated state.
- Lyrics editor with one section.
- Lyrics editor with multiple sections.
- Voice memo empty state.
- Voice memo saved state.
- Voice recording mock state.
- Invite form.
- Role selection.
- Invite sent state.
- Viewer or limited-permission state.

### Required COG UX Traits

The frontend slice should preserve:

- Warm cream background.
- Soft gold glow on active song screens.
- Gold primary CTAs.
- Serif song titles and section headings.
- Tactile rounded cards.
- Calm skeletons or placeholders.
- No fly4me remnants.
- No dashboard energy.
- No generic blue SaaS styling.
- No technical error language.

---

## 4. Lovable Backend Foundation Acceptance Criteria

Lovable's first backend pass is ready for Codex when frontend behavior can be tested against real or clearly mocked backend states:

### Auth

- User can be represented as signed out.
- User can be represented as signed in.
- Invite-user route can preserve token context.
- Session/loading state is explicit.

### Songs

- User can have zero songs.
- User can have one owned song.
- User can have multiple songs.
- Song detail can load by ID.
- New song can be created or mocked.

### Collaborators

- Song owner role exists.
- Contributor role exists.
- Reviewer role exists.
- Viewer role exists.
- Role-aware UI states can be tested.

### Voice Memo Storage

- Empty memo list can be represented.
- Saved memo can be represented.
- Uploading memo can be represented.
- Failed upload can be represented.
- Storage usage state can be represented.

### Activity Log Basics

- No activity state.
- One activity item.
- Multiple activity items.
- Actor, action, target, and timestamp are available or mocked.

### Plan / Free-Song Limit

- Free user with zero owned songs.
- Free user with one owned song.
- Free user attempting a second owned song.
- Invited songs do not consume free owned-song limit.
- Upgrade route or gate state can be represented.

---

## 5. Codex First Audit Entry Conditions

Codex begins the first audit only when:

- The app builds or has a running dev server.
- The main COG routes are reachable.
- Claude's first slice is visually coherent.
- Backend states are connected or intentionally mocked.
- There is enough UI to test interaction latency and layout stability.

Codex should not spend time optimizing legacy fly4me code.

Codex should not audit incomplete placeholder screens unless the user explicitly asks for an early design-risk pass.

---

## 6. Codex First Audit Plan

### Phase 1: Build and Route Health

Run:

```bash
npm run build
npm run lint
npm run test
```

If a command fails, Codex reports:

- Command.
- Failure summary.
- Whether failure is related to COG work, legacy files, missing dependencies, or test drift.
- Smallest recommended fix.

### Phase 2: Mobile 390px QA

Verify at 390px width:

- Song Catalog.
- Song Workspace.
- Lyrics + Chords.
- Voice Memo UX.
- Invite / Roles.
- Invite Preview.

Check:

- Text does not clip.
- Cards do not overlap.
- CTAs remain reachable.
- Safe area is respected.
- Mobile does not feel like compressed desktop.

### Phase 3: Instant-Feel QA

Check visible response for:

- Tap song card.
- Tap New song.
- Tap workspace cards.
- Tap Add section.
- Tap Record idea.
- Tap Play memo.
- Tap Invite.
- Select role.
- Send invite.

Target:

- Visible feedback under 100ms.
- Route transition starts under 150ms.
- Skeleton visible under 200ms when loading.

### Phase 4: Stress States

Test:

- Empty catalog.
- Catalog with 10, 50, and 100 songs.
- Song with many lyric sections.
- Voice memo list with 10, 50, and 100 memos.
- Collaborator list with 2, 10, and 50 people.
- Activity list with 1, 10, and 50 changes.
- Free user with one owned song trying to create a second.

### Phase 5: Failure and Trust

Test or simulate:

- Slow song load.
- Failed song load.
- Failed voice memo upload.
- Expired invite.
- Permission downgrade.
- Storage at 80%, 95%, and 100%.
- Offline save or offline route entry where practical.

The key question:

Does failure protect creative work and preserve calm?

### Phase 6: Accessibility Basics

Check:

- Keyboard access to primary actions.
- Visible focus states.
- Accessible names for icon buttons.
- Dialog or drawer focus behavior.
- Role cards and tabs are screen-reader understandable.
- Color is not the only contributor or selected-state signal.
- Reduced-motion behavior is acceptable.

---

## 7. Codex First Audit Report Format

Codex should report:

```markdown
## Findings

### P0
- ...

### P1
- ...

### P2
- ...

### P3
- ...

## User Impact

Explain what users feel, lose, or misunderstand.

## Recommendations

Give minimal fixes that preserve the approved COG UX.

## Verification

List commands, routes, viewport sizes, stress states, and browser checks used.

## Launch Readiness

State one:

- Ready for next slice.
- Ready after P1 fixes.
- Not ready.
```

---

## 8. Copy-Paste Prompt For Claude Code

```text
Build the first usable Colors of Glory frontend slice.

Use the project AGENTS.md / CLAUDE.md and source docs as law. Do not reference fly4me. Do not build generic SaaS UI.

First slice:
- Song Catalog
- First Song Workspace
- Lyrics + Chords
- Voice Memo capture mock / UX
- Invite and role-selection shell
- Invite preview shell

Use warm cream, gold CTAs, serif song titles, tactile cards, mobile-first 390px layout, calm empty/loading/error states, and the one-song-one-private-room metaphor.

Backend may be mocked where Lovable is not ready, but states must be realistic enough for Codex to stress-test: empty, normal, heavy, loading, failed, and role-restricted.
```

---

## 9. Copy-Paste Prompt For Lovable

```text
Wire the first backend foundations for Colors of Glory.

Lovable owns backend, auth, database, payments, storage, and server-side plan rules. Do not override Claude's frontend visual language and do not redesign the COG UX.

First backend foundations:
- Auth/session states
- Songs
- Collaborators and roles
- Voice memo storage states
- Activity log basics
- Plan/free-song limit

Support testable states for Codex:
- zero songs
- one owned song
- invited-only user
- free user at one-song limit
- second-song upgrade trigger
- empty and populated voice memo states
- upload failed state
- activity empty and populated states
- owner, contributor, reviewer, viewer
```

---

## 10. Copy-Paste Prompt For Codex First Audit

```text
Run the first Codex audit for Colors of Glory.

Use CODEX_OPERATING_PLAN.md as your rulebook. Do not build new features. Do not change Lovable backend logic. Do not redesign Claude's UI. Audit performance, instant-feel, stress states, mobile UX, accessibility, loading/failure states, and release readiness.

Audit the first frontend slice:
- Song Catalog
- First Song Workspace
- Lyrics + Chords
- Voice Memo UX
- Invite / Roles
- Invite Preview

Test mobile first at 390px. Then test stress states, failure states, permissions, and accessibility basics. Report P0-P3 findings with user impact, minimal recommendations, verification, and launch-readiness status.
```

---

## 11. Next Milestone Definition

The next milestone is complete when:

- The Codex operating plan is reviewed or merged.
- Claude's first frontend slice is navigable.
- Lovable's backend foundations are connected or realistically mocked.
- Codex completes the first audit report.
- P0 findings are fixed.
- P1 findings are either fixed or explicitly accepted as known blockers.

The app does not need every advanced feature yet. It needs the first song room to feel real, fast, calm, and trustworthy.

