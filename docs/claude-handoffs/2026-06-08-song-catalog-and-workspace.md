# Claude handoff — Song Catalog + Song Workspace hub

**Date:** 2026-06-08
**Owner:** Claude Code (frontend)
**Backend status:** All edge functions, RLS, and helpers needed for this scope are already deployed by Lovable. Do not write or modify any Supabase code, migrations, or edge functions. If something is missing, stop and tell Parker — Lovable will add it.

## Why this is next

Auth + Account menu (previous handoff) gives a signed-in user a place to land. The next two screens in `CLAUDE.md` Phase 2 are:

3. **Song Catalog** — `/` — the grid of all the user's songs.
4. **Song Workspace hub** — `/song/:id` — the "private room", the 5-panel grid (Lyrics, Voice, Chords, Notes, People).

These are the most emotionally-loaded screens in the product (`COG_Product_Vision_02`, `_03`, `_11`, `_12`). Treat them as hero screens.

## Context Claude must load first

- `CLAUDE.md` §2 (design tokens), §3 (objects), §4 (routes), §11 (locked decisions)
- `docs/claude-build-persona.md` — full persona, quality gates
- Source PDFs (already extracted to `zip_extracted/extracted_text/`):
  - `COG_Product_Vision_02_One_Song_One_Private_Room_UX_Build_Handoff`
  - `COG_Product_Vision_03_Song_Workspace_Anatomy_UX_Build_Handoff`
  - `COG_Product_Vision_11_Your_Song_Catalog_UX_Build_Handoff`
  - `COG_Product_Vision_12_When_One_Song_Becomes_A_Catalog_Product_Vision_UX_Build_Handoff`
  - `COG_Onboarding_07_First_Song_Workspace_First_Aha_Moment_UX_Build_Handoff` (empty-state copy)
  - `COG_Onboarding_14_Song_Grid_Catalog_Business_Model_Screens_UX_Build_Handoff`
- Reference images: `zip_extracted/.../reference images/download (15).webp` (5-panel hub) and `download (16).webp` (annotated workspace)

## SDK Lovable has prepared for this scope

Only import from `@/integrations/cog/*`. Never import `@/integrations/supabase/client` directly.

Claude should expect these typed helpers (Lovable will ensure they exist before you start; if anything is missing, file a one-line ask):

- `@/integrations/cog/songs.ts`
  - `listMySongs(): Promise<SongCard[]>` — songs the current user owns or collaborates on, sorted by `last_activity_at desc`.
  - `getSong(id): Promise<SongDetail | null>` — full song + counts (lyrics lines, voice memos, notes, collaborators, pending suggestions).
  - `createSong(input: { title }): Promise<{ song } | { error: 'free_plan_limit' }>` — calls `create-song` edge function. Surface `free_plan_limit` as the upgrade moment (Product Vision 15).
  - `archiveSong(id)`, `unarchiveSong(id)`, `deleteSong(id)`.
- `@/integrations/cog/activity.ts`
  - `getRecentActivity(songId, since?): Promise<ActivityEvent[]>` — IDs + event kinds only, no raw content (memory rule).
- `@/integrations/cog/members.ts`
  - `listMembers(songId)`, `myRole(songId)`.

If any of these are not yet exported, stop and tell Parker — Lovable owns them.

## Scope — exactly these files

### 1. `src/pages/SongCatalog.tsx` at `/`
Behind `RequireAuth`. Mobile-first.
- Header: serif H1 "Your songs" + subtitle (warm-gray). Right side: account avatar (from previous handoff) + primary gold "+ New song" button.
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`. Each card = `SongCard` component.
- Empty state (no songs): centered serif headline "Your first song lives here", body copy from `COG_Onboarding_07`, gold CTA "Start your first song". Soft `cog-glow` behind it.
- Free-plan banner (only when user is on free plan AND already owns 1 active song): single calm card "You've filled your free room. Open another song by upgrading." → `/upgrade`. No red, no urgency.
- "+ New song" click: open `NewSongDialog` (shadcn Dialog) → text input "What's the working title?" → on submit calls `createSong`. On `free_plan_limit`, swap dialog body to the upgrade moment copy.

### 2. `src/components/cog/SongCard.tsx`
- Cream-light background, 16px radius, default border `--cog-border`. On hover/focus: border `--cog-border-gold`, lift 2px.
- Top-left: small cover swatch (use `song.cover_color` if set, else default warm gradient).
- Title: serif, 1.25rem, charcoal, truncate to 2 lines.
- Meta row: `{collaborators_count} people · {voice_memo_count} memos · updated {relativeTime}`. Warm-gray, 0.875rem.
- Trailing chevron only visible on hover (desktop). Whole card is the link to `/song/:id`.
- Long-press / right-click → contextual menu (Archive, Delete) using shadcn DropdownMenu.

### 3. `src/pages/SongWorkspace.tsx` at `/song/:id`
Behind `RequireAuth`. The hero screen. Loads `getSong(id)` + `getRecentActivity(id, lastSeen)`.

Layout (mobile-first, max-w-md mx-auto on phones, max-w-3xl on tablet+):
- Sticky header: back arrow → `/`, song title (serif `--t-song-title`), tiny meta (Key · BPM · last edit). Bottom-centered `cog-glow`.
- 5-panel grid (2×3, last cell is "People" full-width or as a 5th tile depending on width — match `download (15).webp` exactly):
  1. **Lyrics** — preview first 2 lines of Verse 1. Footer count "{n} sections, {m} lines". Tap → `/song/:id/lyrics`.
  2. **Voice** — mini waveform of latest memo + duration + name. Tap → `/song/:id/voice`. Empty state: "Hold to record your first idea".
  3. **Chords** — show key + chord progression chips. Tap → `/song/:id/lyrics` (chords editor lives there).
  4. **Notes** — preview first note line. Tap → `/song/:id/notes`.
  5. **People** — avatar stack (max 3) + "+N more". Tap → `/song/:id/people`.
- Below the grid: **Activity strip** — calm one-liner: "3 changes since you left ›" → `/song/:id/activity`. Hidden when no new activity.
- Floating gold action: bottom-right "+ Capture" — opens a sheet with two options (Type an idea / Hold to record). Per `COG_Product_Vision_04`.

### 4. `src/components/cog/PanelCard.tsx`
Reusable card for the 5-panel grid. Props: `label` (eyebrow), `title` (serif), `preview` (ReactNode), `count?` (footer chip), `to` (route), `glow?: boolean`. Active/focus = gold border per design system.

### 5. Stub routes (so links don't 404)
For each subroute Claude doesn't fully build this round, create a thin page that renders the header (title + back) and a centered "Coming soon in the next pass" placeholder card. Do this for all of:
`/song/:id/lyrics`, `/song/:id/voice`, `/song/:id/notes`, `/song/:id/people`, `/song/:id/activity`, `/song/:id/versions`, `/song/:id/credits`, `/song/:id/canvas`.
The Catalog + Workspace hub are the only fully-built screens this round.

## Hard rules (same as auth handoff)

- Only `@/integrations/cog/*` imports. No `supabase` import.
- Tokens only. `bg-[var(--cog-cream)]`, `text-[var(--cog-charcoal)]`, `border-[color:var(--cog-border)]`. No raw hex, no `bg-white`, no `text-gray-500`.
- Serif for all H1s (`font-display`). Inter for body.
- Mobile-first 390px. Touch targets ≥ 44px.
- Calm UX: no red badges, no notification dots, no aggressive upsell. The free-plan banner is a single quiet card.
- All copy must reflect Christian / songwriting context. Banned words per persona doc still apply (no "Dashboard", no "Workflow", no "Team", no "Project" — it's "song", "people", "room").
- Surface every Cog SDK error with friendly copy. `free_plan_limit` → the upgrade moment described above.
- Skeletons, not spinners. Cream skeleton blocks at the card shapes during load.

## Acceptance checklist (Claude self-verifies)

- [ ] Signed in as `parker@veepo.ca` (admin), `/` shows the catalog (or empty state if no songs yet).
- [ ] "+ New song" creates a song, redirects to `/song/:newId`, the workspace renders all 5 panels with empty states.
- [ ] Free-plan upgrade moment fires on the 2nd song attempt and routes to `/upgrade` (stub OK).
- [ ] Account menu (from previous handoff) is present in the catalog header AND in the workspace header.
- [ ] Back arrow on workspace returns to `/`.
- [ ] All 8 sub-route stubs render without 404.
- [ ] No direct `@/integrations/supabase/client` imports.
- [ ] All colors via CSS vars.
- [ ] Lighthouse mobile pass on `/` and `/song/:id` (Codex will re-run, you just shouldn't regress).

## Out of scope for this round
- Real lyrics editor, voice recorder, notes editor (next handoffs, in that order).
- Drag-to-reorder catalog, search, filters.
- Invite collaborator flow (planned for the People handoff alongside `song-invite-create`).
- Avatar upload wiring (the Settings → Profile uploader stays a stub).

## After Claude completes

1. Parker tests the create-song flow as admin.
2. Lovable runs the storage + RLS verification checklist (`scripts/codex/verify-storage.md`).
3. Next handoff: **Lyrics + Chords editor** (`COG_Feature_17`).