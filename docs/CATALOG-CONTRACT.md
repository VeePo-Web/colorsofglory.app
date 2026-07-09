# CATALOG CONTRACT — F1 · Library / Catalog
*Published by the F1 Library/Catalog agent · 2026-07-08*

The song catalog lives at **`/songs`** (guarded). `/` is the capture-first home
(`CapturePage`) — `CLAUDE.md §4`'s "`/` = catalog" is superseded by the real route map.

---

## 1. Data dependencies (A3 — `@/integrations/cog/songs`)

| Call | Used for | Notes |
|---|---|---|
| `listMySongs()` → `SongCard[]` | The grid, via `useSongs()` (TanStack, `qk.songs()`, 60s stale) | Newest activity first from the `list_my_songs` RPC |
| `createSong({ title })` | "+ New song" flow | Plan-gated by G1's `canCreateSong()` → `/upgrade?source=song_gate_free` |
| `archiveSong` / `unarchiveSong` | Card swipe, actions sheet, batch bar | Direct RLS `UPDATE` (owner) / `song-unarchive` edge fn |
| `renameSong(id, title)` | Actions sheet → Rename dialog | **Filed by F1**: added to `songs.ts` following `archiveSong`'s RLS-update pattern (owner `UPDATE` policy). A3: fold into the seam's canonical shape if it grows params. |
| `leaveSong(id)` | Actions sheet on invited songs | `song-leave` edge fn (Lovable) |
| `deleteSong(id)` | Actions sheet, owner only, inline confirm | `song-delete` edge fn (Lovable) |

All mutations are **optimistic on a local working copy** (seeded from the query
cache) with rollback on error, then `refetch()` to reconcile the 60s-stale cache.

Albums and pins are **local-only** (`@/lib/library/albums`, `pins`) — no backend.
If albums ever need to sync across devices, file a table with Lovable.

## 2. Search / sort / filter model

One composed pipeline in `SongCatalogPage.visibleSongs`, in this order:

1. **Tab** — Owned (`my_role === "owner" && status !== "archived"`), Invited
   (`my_role !== "owner"`, not archived), Archived (`status === "archived"`).
   Tab badges show live per-tab counts.
2. **Album focus** (Owned only) — a real album's `songIds`, or the `__ungrouped__`
   smart group. Album order wins over sort inside an album (tracklist order).
3. **Search** — instant client-side title match; also matches **album names**
   (surfaced as tappable chips). A distinct "No songs match “q”" state (never the
   empty-shelf copy) offers "Search your memory instead →". A live
   "*N matches*" count (aria-live polite) renders under the controls while a
   query is active — browse counts stay on the tab badges.
4. **Sort** — `recent` (Recently edited, **default**) · `created` (Recently
   created) · `alpha` (A to Z, with A–Z list sections + scrubber) · `ideas`
   (Most ideas). Persisted in `localStorage` (`cog:library-prefs`) with view +
   density. Pinned songs hold the top of Owned regardless of sort.

Switching tabs resets album focus and scrolls to top; sort, view and search
persist across tabs.

## 3. Card action → capability map

Role comes from `SongCard.my_role` (server-computed by `list_my_songs`) — the
catalog never invents roles (E1 owns the role model; per-song surfaces use
`useCapabilities`. Card-level gating on `my_role` avoids N per-card queries and
matches E1's owner/member split).

| Action | Owner | Invited member | Guard |
|---|---|---|---|
| Open / quick-route (canvas, sheet, voice) | ✅ | ✅ | — |
| Rename | ✅ | ❌ | Dialog; optimistic + rollback |
| Pin / Albums / Select songs | ✅ | ❌ | Local-only organization |
| Archive / Restore (sheet, swipe, batch) | ✅ | ❌ | Always reversible, Undo toast |
| Leave | ❌ | ✅ | **Inline confirm** ("You'll need a new invite to rejoin") |
| Delete | ✅ (the one destructive action) | ❌ | **Inline confirm** ("This can't be undone"), `#C0392B` accent |

Nothing destructive fires on a single tap.

## 4. Empty states

- **First song (Owned, zero songs):** `EmptyLibraryHero` — serif invitation +
  glow + gold "Start your first song" CTA into the create → brainstorm flow.
- **Invited:** "No invited songs yet. Songs shared with you will appear here."
- **Archived:** "Archived songs stay safe and readable here."
- **No search results:** distinct copy + memory-graph escape hatch.
- Inside an album: "This album is empty. Tap “Add songs” above to fill it."

## 5. Scale

- Skeleton card grid while loading (`LibrarySkeleton`) — never a spinner.
- **Windowed rendering**: plain grid/list paints 60 cards and appends 60 more as
  an IntersectionObserver sentinel nears (append-only; scrollbar never jumps).
  Sectioned views (A–Z, month groups) render whole so headers stay correct.
- `listMySongs` is unpaginated; fine to ~hundreds of rows. If catalogs outgrow
  that, file a paginated `list_my_songs(limit, offset, query)` with A3 —
  the windowing above already isolates the render cost.

## 6. Reduced motion / a11y

- Global `prefers-reduced-motion` kill-switch in `src/index.css` disables the
  hover-lift / active-scale / entrance animations.
- Cards carry full aria labels (title, idea count, last edit); tabs use
  `aria-selected`; sort menu is `menu`/`menuitemradio`; sheets are
  `role="dialog" aria-modal` with Escape-to-close; match count is `aria-live`.
