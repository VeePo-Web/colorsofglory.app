# F1 · Library / Catalog — progress

*2026-07-08 · single session · baseline = main + A3 data-access (57c1023)*

## Step 1 — Baseline audit ✅
The charter's audit (314-line page, no search/sort, text empties) was **stale**.
The real catalog had already grown far past it: search (titles + album names),
persisted sort/view/density prefs, albums + pins + batch select, `EmptyLibraryHero`,
status-chipped `SongGridCard`/`SongListRow` (already extracted to
`src/components/library/`), `LibrarySkeleton`, windowed rendering, scroll
restoration, coach marks. Route confirmed: catalog = `/songs`; `/` = capture.
Mandate re-scoped to the true gaps; everything below is additive.

## Steps 2–4 — Search / sort / compose ✅ (mostly pre-existing)
- Search, tab filter, and sort already composed in one `visibleSongs` pipeline.
- **Added:** `created` ("Recently created") sort — charter's missing third sort —
  in `libraryPrefs` (type, label, validation), `LibraryControls` menu, and the
  page's sort branch.
- **Added:** live "*N matches*" count (aria-live) under the controls while
  searching; browse counts already live on the tab badges.

## Steps 5, 6, 8, 9 — Empty states / card / skeletons / scale ✅ (verified shipped)
`EmptyLibraryHero` (first-song invitation), per-tab + no-results empties, PV11
status chips, aria-labeled cards, skeleton grid, windowed rendering at scale.
No changes needed; verified against the charter's done-checks.

## Step 7 — Card actions ✅ (the real gap; built this session)
- **Rename** (owner): new sheet row → dialog; optimistic + rollback;
  `renameSong` added to `@/integrations/cog/songs` (filed with A3, follows
  `archiveSong`'s RLS-update pattern).
- **Delete** (owner, the one destructive action): inline Keep/Delete confirm in
  the sheet (`#C0392B`), optimistic removal, `song-delete` edge fn, rollback on error.
- **Leave** (invited): the actions sheet now opens for invited songs (it was
  owner-only); inline Stay/Leave confirm; `song-leave` edge fn.
- Owner-only sections (pin, albums, select, archive) now explicitly role-gated
  in the sheet; archive↔restore already wired from sheet, swipe, and batch bar.

## Step 10 — a11y + verification + contract ✅
- New rows/dialogs follow the existing patterns (44px targets, dialog semantics,
  Escape close, autoFocus on the safe option in confirms).
- `npm run build` green; vitest run — see main session report (pre-existing
  failures on main are unrelated to the catalog).
- Published **docs/CATALOG-CONTRACT.md**.

## Dependencies consumed
A3 `listMySongs`/mutations (+ filed `renameSong`) · E1 role split via
`my_role` (documented in contract §3) · G1 `canCreateSong` · A1 tokens ·
C2 `SeedIdeasShelf` (hosted, untouched).
