# R23 — Songwriting Room Audit: "What changed while you were gone"

**Lane:** Claude (frontend only). Backend shipped by Lovable.
**Goal of the room:** everything for this song stays connected here — and the way back in should already know what you missed.
**Rule:** simple over clever. No red badges. No notification spam.

## Backend now available

SDK: `src/integrations/cog/catalog.ts`

| Function | What it does |
|---|---|
| `getCatalogBoard(limit?)` | ONE request → every song you're in (ordered by last activity) with title, cover colour, key/tempo, lyric snippet, member count, your role, `unseen_count` (events by *other* people since your `last_seen_at`), and `last_event` `{ kind, actor_name, created_at }`. Also `owned_count` (for the free-song gate) and `total_unseen`. |
| `markSongSeen(songId)` | Call once when the room opens. |
| `markAllSongsSeen()` | "Catch me up" — clears every marker. |

Privacy: nothing but IDs, kinds, names and counts. Never render content you didn't fetch from the song itself.

## The catalog screen `/`

One scroll. No tabs, no filters until there are more than 12 songs.

### Song card
- Serif title. Under it ONE calm line built from `last_event`:
  - unseen > 0 → `Sarah added a voice memo · 2h` in charcoal
  - unseen = 0 → `Updated 2h ago` in warm gray
- Unseen marker = a **4px gold dot** on the left edge of the card. Never a number, never red.
- Right side: member avatars (max 3, +N), then `key · bpm` chips only if set.
- Locked song (`is_locked`): gold-pale card, small lock glyph, tap opens the upgrade sheet — never a dead card.

### The "since you left" band
- Only when `total_unseen > 0`, pinned above the list: `3 songs moved while you were away` + a ghost "Catch me up" button → `markAllSongsSeen()` with an optimistic dot fade (250ms, `--cog-ease`).
- Disappears entirely at zero. No empty banner shell.

### Entering a room
- On mount of `/song/:id`, fire `markSongSeen(songId)` and optimistically clear the dot in the cached catalog. Do NOT wait for the response, do NOT refetch the catalog.
- Keep the previous `last_seen_at` in memory for the session so the room's activity feed can draw its **"New since you left"** divider — the dot clears in the catalog, but the divider stays until you leave the room.

### Empty + gates
- No songs: glow, one serif line "Start your first song.", one gold CTA. Nothing else.
- `owned_count >= 1` on the free plan: the "New song" button stays visible and gold, and opens the upgrade sheet. Never hide or disable it.

## Performance
- One call on mount. Render from cache instantly, revalidate underneath — never a full-screen spinner on a warm cache.
- Cards are memoised; the gold dot is the only thing that re-renders on a seen change.
- Prefetch `song_room_bootstrap` on card press-in (pointerdown), not hover.

## Definition of done
- Opening the app tells you what moved in under one glance and one request.
- Every unseen marker can be cleared in one tap without leaving the list.
- Entering a song clears its marker instantly, and the room still shows where you left off.
- No count badge, no red, nothing shouting.
