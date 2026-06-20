# C2 — CLAUDE: Song Workspace / Room Hub
## Cluster 3 · Lane: `claude/*` · Owner: Claude (the experience) · Persona: Fable 5 (`/feature`)

> Run with the `/feature` 7-Phase loop. The Room is the heart of the product —
> "everything for this song stays connected here." Mobile-first; tokens only;
> data via the seam.

---

## YOUR ROLE (do not overstep)
Claude: all `src/` UI. Call the seam (`src/integrations/cog/*`); never the raw
Supabase client. No schema/auth-logic (Lovable) or tests (Codex). `docs/BUILD-PATHWAY.md`.

---

## CONTEXT
The **private room** is the central metaphor (`CLAUDE.md` §1, Product Vision 02/03).
One song = one room holding everything: lyrics, voice memos, chords, notes, people,
plus activity + versions. Route: `/songs/:id/room`. Current code:
`src/pages/SongWorkspacePage.tsx` (~7KB), nav via `src/components/cog/BottomNav.tsx`
+ `SongTabBar.tsx`.

Spec + reference images (read in Phase 0):
- `…/2. More Onboarding- System -- with reference images/COG_Product_Vision_02_One_Song_One_Private_Room_UX_Build_Handoff.pdf`
- `…/COG_Product_Vision_03_Song_Workspace_Anatomy_UX_Build_Handoff.pdf`
- reference images `download (15).webp` (5-panel hub) + `download (16).webp` (annotated workspace)

---

## OBJECTIVE
The Room as a calm, beautiful, mobile-first hub that makes the song feel whole — a
glanceable home that connects every part of the song in one tap, matching the
mockups at capture-level craft, and meeting the Mobile UX Benchmark
(`docs/MOBILE-UX-BENCHMARK.md`).

## PHASE 0 — SPEC
Read Vision 02/03 + the two reference images. State the room's one essential moment:
*the songwriter opens the song and instantly sees/feels everything it contains and
where to go next.* Note what each panel previews.

## PHASE 2 — AUDIT (7 lenses)
Audit `SongWorkspacePage` against the mockups + benchmark: does it show the song
header (serif title, glow), the panel grid (Lyrics / Voice / Chords / Notes /
People), an activity peek ("what changed"), and clear navigation? Flag friction,
visual gaps, a11y, perf, empty states.

## PHASE 4 — BUILD
1. **Song header:** serif title, cream + radial glow, plan/role context, back to catalog.
2. **The panel grid:** each of Lyrics / Voice / Chords / Notes / People is a
   preview card showing a live glance (e.g. last lyric line, # memos, key/BPM, # notes,
   collaborator avatars) and taps into its layer/route.
3. **Activity peek:** a calm "what changed since you left" strip (links to C6).
4. **People row:** collaborator avatars with role hint (links to C5).
5. **Primary action:** the mic / capture entry stays one tap away (reuse capture).
6. **Navigation cohesion:** reconcile BottomNav + SongTabBar so the room ↔ layers ↔
   canvas relationship is obvious and consistent (coordinate with C1's route decision).
7. **Empty/first-run:** a brand-new song's room invites the first idea, never blank.
8. Mobile-first: thumb-reachable, 44×44 targets, reduced-motion, COG tokens, motion system.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk happy path + empty-room + offline. Paste evidence.

## DELIVERABLES
1. Refactored `SongWorkspacePage` (split if > ~250 lines) matching the mockups.
2. Reusable panel-preview card component.
3. Navigation cohesion note (room ↔ layers ↔ canvas).

## ACCEPTANCE CRITERIA
- [ ] Matches Vision 02/03 mockups; all five panels preview live data via the seam.
- [ ] Activity peek + people row present; capture one tap away.
- [ ] Meets `docs/MOBILE-UX-BENCHMARK.md` (thumb zones, clarity, motion, empty states).
- [ ] No component > ~250 lines; tokens only; `tsc`+`build`+tests green.

## DEPENDENCIES
- Seam data from L1 (song + children) and the relevant layer SDKs. Use defined seam
  functions; build against an adapter if a function isn't ready, and hand the
  signature list to Lovable.

## CONSTRAINTS
Frontend only · tokens only · seam only · iOS-first · `/feature` loop · `claude/song-workspace-room` → merge → delete.

## REFERENCES
- `src/pages/SongWorkspacePage.tsx`, `src/components/cog/BottomNav.tsx`, `SongTabBar.tsx`, `src/integrations/cog/*`
- Vision 02/03 PDFs + `download (15/16).webp`
- `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`, `CLAUDE.md` §1/§3
