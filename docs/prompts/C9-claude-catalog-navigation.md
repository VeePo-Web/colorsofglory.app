# C9 — CLAUDE: Song Catalog + Navigation Cohesion
## Cluster 10/12 · Lane: `claude/*` · Owner: Claude · Persona: Fable 5 (`/feature`)

> Run with `/feature`. The catalog is home base — "one song becomes a catalog" (Vision
> 12). And this prompt finally **unifies navigation** across the whole app. Mobile-first;
> tokens only; seam only; meet `MOBILE-UX-BENCHMARK.md`.

## YOUR ROLE
Claude: all `src/` UI. Seam only; no schema/auth/tests. `docs/BUILD-PATHWAY.md`.

## CONTEXT
`src/pages/SongCatalogPage.tsx` exists; navigation is currently inconsistent (BottomNav vs
SongTabBar, the canvas double-nav flagged in `MOBILE-AUDIT-FINDINGS.md` + C1). Specs:
Vision 11 (Your Song Catalog), Vision 12 (When One Song Becomes a Catalog), reference
images for the catalog. Plan gating from L9 (free = 1 song).

## OBJECTIVE
A warm, fast catalog of songs + a single coherent navigation model across capture / room
/ layers / canvas / catalog / settings — so a songwriter is never lost.

## PHASE 0 — SPEC
Read Vision 11/12 + the catalog reference image. The one moment: *I open my catalog and
see my songs like a shelf of works in progress, and tapping one drops me right back in.*

## PHASE 4 — BUILD
1. **Catalog grid/list:** song cards (serif title, last-touched, collaborator color dots,
   a tiny "what's inside" glance — # memos / has lyrics / key). Calm, gold accents.
2. **Navigation cohesion (the big one):** define ONE model and apply it — bottom nav
   (Capture / Songs / Settings) for top level; inside a song, a consistent way to reach
   room ↔ layers ↔ canvas (reconcile BottomNav + SongTabBar; resolve the canvas
   double-nav with C1). Document the final nav map. No duplicate destinations.
3. **Free-song gate (calm):** the "second song → upgrade" moment surfaced gracefully from
   L9's entitlement (a warm prompt, not a wall); first song is free + magical.
4. **New song entry:** an obvious "start a song" that drops into capture.
5. **Empty/first-run:** a brand-new user's catalog invites the first song beautifully.
6. Mobile-first: 44×44, reduced-motion, tokens, motion, no layout shift.

## PHASE 5 — VERIFY
`tsc` 0 · `build` ok · tests green · walk: catalog with songs, tap-in, new song, free-gate
prompt, empty. Evidence + a mobile re-drive of catalog + nav.

## ACCEPTANCE CRITERIA
- [ ] Catalog shows songs with a meaningful glance; tap returns to the song fast.
- [ ] ONE coherent nav model app-wide; no duplicate destinations; canvas double-nav resolved.
- [ ] Second-song upgrade prompt is calm (reflects L9 entitlement); first song free.
- [ ] Empty/first-run designed; meets the mobile benchmark; ≤250 lines/component.
- [ ] `tsc`+`build`+tests green; 7-lens pass.

## DEPENDENCIES
- **L9** (entitlement/plan gate) · **C1** (canvas nav decision) · **C2** (room nav).
  Build against the seam; adapter if not ready.

## CONSTRAINTS
Frontend · tokens · seam · iOS-first · `/feature` · `claude/catalog-nav` → merge → delete.
The gate must never feel like a trap — calm upgrade, no dark patterns.

## REFERENCES
- `src/pages/SongCatalogPage.tsx`, `src/components/cog/BottomNav.tsx`, `SongTabBar.tsx`
- Vision 11/12 PDFs; `docs/prompts/C1-…canvas-cleanup.md`, `C2-…song-workspace-room.md`, `L9-…storage-plans-stripe.md`
- `docs/MOBILE-AUDIT-FINDINGS.md`, `docs/MOBILE-UX-BENCHMARK.md`, `docs/BUILD-PATHWAY.md`
