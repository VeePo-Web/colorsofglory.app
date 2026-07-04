# Library / Song-Organization — Backend Fields Handoff (for Lovable)

**Date:** 2026-07-06 · **From:** Library lane (frontend) · **To:** Lovable (backend/SDK)
**Why:** The frontend song-organization surface (catalog, views, albums, search, batch,
windowing, whiteboard routing) is complete. The remaining high-value library features are
blocked only on small additions to the **`SongCard`** row returned by `listMySongs()` and one
new sort input. Each is additive and non-breaking. The frontend is already built to render
these the moment the data exists (graceful absence today).

## The one shape that unblocks four features

`listMySongs(): Promise<SongCard[]>` in `src/integrations/cog/songs.ts`. Add these optional
fields to the `SongCard` type + the underlying `me-songs` query. All optional so the UI keeps
working if null.

| # | Field on `SongCard` | Type | Feeds | Notes |
|---|---|---|---|---|
| 1 | `pending_suggestions` | `number` | **Needs-attention shelf** — an auto shelf "N songs need you" above the grid, linking each to its review queue | Count of open line-suggestions / pending review for that song for the current user. Already exists per-song on `SongDetail.counts.pending_suggestions`; promote it onto the list row. |
| 2 | `inviter_name` | `string \| null` | **Invited-tab enrichment** — invited cards show "invited by Sarah · Contributor" | Only meaningful when `my_role !== 'owner'`. Display name of the inviter. |
| 3 | `last_opened_at` | `string \| null` (ISO) | **Sort: "Last opened by me"** — distinguishes my re-entry point from collaborator edit noise on busy shared songs | Per-member last-open timestamp. Frontend adds it to the existing sort menu. |
| 4 | `storage_bytes_used` (song) **or** a workspace usage getter | `number` | **Storage-trust line (PV13)** — a calm one-line "Your songs are safe. New uploads may pause soon." near the grid when near cap → `/upgrade` | Frontend already reads `PlanTier.storageBytesIncluded` via `fetchPlanTiers()`; it just needs **current usage**. Cleanest: a `fetchStorageUsage(): Promise<{ usedBytes: number; includedBytes: number }>` in `pricingApi.ts`. Never blocking, never red. |

## One optional write (nice-to-have, lower priority)

| # | Function | Signature | Feeds |
|---|---|---|---|
| 5 | `renameSong` | `renameSong(song_id: string, title: string): Promise<void>` (edge fn `song-rename`) | **Quick rename from the library** — rename a "New song" from the press-and-hold sheet without opening it. Contextual-menu doc already lists Rename as a song action. |

## Real cover art (#20) — when storage/image upload exists

Frontend already isolates cover rendering behind `coverColor(song.cover_color)`. When songs can
carry an image (`cover_image_url`), swap the color swatch for the image in `SongGridCard`,
`SongListRow`, and the album mosaics — a one-seam change, no new plumbing.

## What the frontend does today without these

- Needs-attention / invited-by / last-opened: simply not shown (no empty rows, no errors).
- Storage line: absent (never faked — we will not invent a usage number).
- Rename: done by opening the song.

## Contract notes

- All additions are **optional and backward-compatible**; ship any subset.
- Analytics stay content-free (ids/counts/booleans only) — no titles/lyrics in events.
- The library lane will wire each feature behind a presence check the same day the field lands.
