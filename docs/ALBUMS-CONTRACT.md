# ALBUMS CONTRACT — shared albums, the real Drive (Lane C · C7 filing)
## For Lovable (backend owner). Frontend seam: `src/lib/library/albums.ts` — built to swap in ONE place.

### Why this exists
Albums (the library's folders — an EP, a setlist, a season) shipped C1–C6
entirely on `localStorage` (`cog:library-albums`). Everything works — one
+ New door, colors, faces, the gold dot, in-album people filters, breadcrumb,
drag-to-file, the one shelf — but **a band's folders don't travel**: the
Worship EP exists only on the phone that made it, and is lost with browser
data. The whole point of Drive is that the folder is the SAME folder on
every member's screen. This contract is the one backend ask that closes it.

### The objects (append to the schema, forward-only)
```
albums
  id          uuid pk default gen_random_uuid()
  owner_id    uuid not null default auth.uid()      -- the creator
  name        text not null
  color       text null                             -- semantic key ("sage") — the
                                                    -- frontend owns the palette
                                                    -- (src/lib/library/albumColors.ts)
  position    int  not null default 0               -- shelf order (owner's)
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()

album_songs
  album_id    uuid not null references albums(id) on delete cascade
  song_id     uuid not null references songs(id)  on delete cascade
  position    int  not null default 0               -- tracklist order
  added_by    uuid not null default auth.uid()
  added_at    timestamptz not null default now()
  primary key (album_id, song_id)
```

### The visibility model (v1 — decided, don't re-litigate)
- **Read**: an album is visible to its owner AND to anyone who is a member of
  at least one song on it (`song_members`). That is "band-readable via song
  membership" — the Worship EP appears on every bandmate's shelf because
  they're in its songs, with zero new sharing UI.
- **Write**: owner-only for rename / color / delete / shelf reorder /
  tracklist reorder / add / remove. (v2 may open add-song to contributors —
  ship v1 owner-write first; the frontend already renders read-only
  gracefully because every album action button is prop-gated.)
- RLS deny-by-default; the read policy is the EXISTS-over-`album_songs`×
  `song_members` join; no `SECURITY DEFINER` needed for reads if the join is
  RLS-clean — otherwise a `list_my_albums()` RPC returning
  `{id, owner_id, name, color, position, song_ids[]}` is acceptable and
  preferred over N+1.

### What the frontend guarantees (already true on main)
- `color` is a semantic key, never a hex — unknown/absent keys render the
  mosaic cover. No migration ever needed for palette changes.
- Membership is additive multi-membership (a song may sit on two albums).
- Faces, the gold dot, and "Sarah · 2h" on covers are all DERIVED client-side
  (band index + catalog pulse) — the backend stores nothing for them.
- Archived songs are filtered client-side; keep them in `album_songs`.

### The swap plan (Claude's side, when this lands)
`albums.ts` keeps its exact surface (`listAlbums / createAlbum / updateAlbum /
deleteAlbum / reorderAlbums`) and becomes backend-backed with the local copy
as the warm cache. One-time migration on first authenticated load: upsert
every `cog:library-albums` entry (name, color, songIds → rows), then clear
the key. No other file changes — that is why the seam exists.

### Acceptance (the proof)
Two phones, two members of the same songs: member A makes "Worship EP"
(sage), files three songs. Member B's shelf shows the same sage cover, same
faces, same order, without any share step. A renames it; B sees the new name
on next load. B cannot rename it (v1).
