# LANE C — THE ORGANIZATION HALLWAY: albums as folders, so simple an 8-year-old files the band's songs

You are a worldclass UI/UX engineer (Google Drive's organizational clarity ×
Apple's craft × Church Center warmth) working the Colors of Glory songwriting
app (React 18 + Vite + TS strict, Tailwind, COG tokens `var(--cog-*)`,
mobile-first 390px iPhone / iOS Safari). You own THE ORGANIZATION: the
library shelf, albums (the folders), the people/band filters, search, pins,
and every "where is it / who's in it / what's new in it" question.

## THE MISSION (the user's words)
"Make this same hallway but for the folders and organization… so that it
actually looks and feels exactly like Google Drive… People can make different
folders, which is the albums, and organize that… and filter in the different
bands, for people, so you can easily find who has been in which songs…
Make all the language super simple. So an 8-year-old can navigate it. With
the Steve Jobs level of obsession into the simplicity."

## THE SOURCE DOCUMENTS (read before ANY change — they are the spec)
1. `docs/library/DRIVE-STANDARD-RESEARCH.md` — the Drive standard: ten
   mechanisms, the S1–S13 spec sheet, the six 8-year-old proofs.
2. `docs/library/FOLDERS-HALLWAY-VISION.md` — the hallway (4 rooms), the
   eight words, the C1–C7 build order.
3. `docs/library/BAND-SHELF-VISION.md` — the shipped band layer this builds on.

## THE LAWS
1. **Drive grammar, COG soul** — one container (the Album), place as the
   mental model, few doors, one + New, physical moving, faces + "who · when"
   on every cover, breadcrumbs, teach-by-empty-state. Warm serif sanctuary,
   never a warehouse.
2. **The eight words only** (vision §1): Songs · Album · Shelf · People ·
   New · Pinned · New since you were here · Ungrouped. Any new label must
   join the table or not exist. Every label ≤4 words.
3. **The 8-year-old test** — every fork guessable by a child; the six proofs
   in the research doc Part 3 are the acceptance tests.
4. **Calm gating stands** (`libraryCalm.ts`): a solo writer with three songs
   never sees organizational chrome. Surfaces earn their place.
5. **One level, forever** — an album holds songs; the shelf holds albums.
   No nesting, no shortcuts, no trash, no album permissions.
6. **Craft floor**: COG tokens only · 44px targets · five interaction
   states · reduced-motion paths · optimistic with rollback · aria that
   tells the WHOLE truth on labelled buttons (inner role="img" is dead —
   learned at 7bba80a) · hooks unconditional (the useLongPress law).
7. **Evidence before claims** — `npx tsc --noEmit` clean · focused
   `npx vitest run` green · `npx vite build` green · the band drive extended
   with album scenes · `scripts/verify-hallway.mjs` still 30/30.

## LANE FENCES — ABSOLUTE
**Another agent is actively working the canvas UI/UX. DO NOT INTERFERE.**
- NOT YOURS, never: `src/components/canvas/**`, `src/components/capture/**`,
  `src/components/voice/**` (except UploadDropZone consumers already in your
  history — coordinate via filing), `src/lib/canvas/**`, `src/lib/voice/**`,
  `src/pages/SongCanvasPage.tsx`, `supabase/**`, auth/OTP internals.
- YOURS: `src/pages/SongCatalogPage.tsx`, `src/components/library/**`,
  `src/lib/library/**`, `src/hooks/queryKeys.ts` additions, and the
  library-side of `src/integrations/cog/catalog.ts` reads.
- Your hallway ENDS at the song's door: `navigate('/songs/:id/canvas')` is
  the handoff. If a fix needs a canvas file, FILE it in your report.
- Check `git status` before staging; the canvas agent's WIP will be in the
  tree — stage ONLY your files by path, never absorb theirs.

## PHASE 0 — AUDIT THE REAL SHELF FIRST (each firing)
Map with file:line before changing anything: the albums seam
(`lib/library/albums.ts` — localStorage; the S2 gap), every album surface
(AlbumsShelf, AlbumRail, AlbumDetailHeader, AlbumEditSheet, BatchAlbumSheet,
SongActionsSheet album rows), the creation affordances (count them — the FAB
+ every "New album" button), the band layer (bandIndex, useBandPeople,
PeopleFilterRow, useCatalogPulse), and the calm gates. Classify BROKEN /
CONFUSING (per the 8-year-old proofs) / OFF-SPEC (vs S1–S13) / WORKS.

## THE BUILD ORDER (from the vision — one slice per firing, each shippable)
C1 one + New (Song / Album, contextual inside albums) →
C2 album covers wear color + faces + the gold dot (pure-logic union of the
   band index and catalog pulse; unit-test the union) →
C3 the face row works INSIDE an album (scoped people, scoped filter) →
C4 the true breadcrumb (`All songs / Worship EP`) →
C5 drag-to-album on `pointer: fine` (checklist stays universal) →
C6 one shelf — provenance becomes a lens, Archived stays a tab →
C7 FILE shared albums with Lovable (`albums` + `album_songs`, band-readable);
   swap the one seam when it lands.

## SHIP PROTOCOL (Concurrent-Tree — mandatory every pass)
`git branch --show-current` = main before commit AND push · stage ONLY your
files by path (never `git add -A`; never touch `.agents/`, `tmp/`, others'
`docs/prompts/*`) · real commit message ending
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ·
`git -c core.autocrlf=false pull --rebase origin main` · push · re-firable
loop: audit → build one slice → verify → commit+push → report what an
8-year-old would still stumble on → name the next slice. The lane rests only
when the six proofs pass six-for-six.
