# R27 — The song hub: "The room answers in one glance"

**Audience:** Claude (frontend owner). Backend is shipped — no SQL, no edge functions.

## The one job
`/song/:id` is the screen every session starts and ends on. It has exactly one job:
**tell me the state of my song in one glance, and give me one obvious way back in.**
It is not a dashboard. It is the doorway to five rooms.

Simple beats clever: five tiles, one nudge, nothing else.

## The performance bug this fixes
The hub currently hydrates from `song_room_bootstrap`, which downloads up to 400 canvas
cards, every memo and every capture — just to render five numbers. Switch the hub to
`getHubBoard(songId)` (`src/integrations/cog/hub.ts`). Keep `song_room_bootstrap`
for `/song/:id/canvas` only, where the cards are actually drawn.

## Data seam (already built)
`src/integrations/cog/hub.ts`

- `getHubBoard(songId)` → song meta + `lyrics` / `voice` / `chords` / `notes` / `people`
  tile summaries + a `waiting` block (`unseen_activity`, `open_suggestions`,
  `unfiled_captures`, `failed_transcripts`) + `role` / `can_write`.
- `tileSubtitle(board, "voice")` → already-pluralised subtitle strings.
- `nextAction(board)` → **at most one** `{ label, to }`, or `null` when the room is calm.

## Layout (390px first)

**1. Header**
- Serif song title (`--t-song-title`), left-aligned, generous top space.
- One metadata line in `--cog-warm-gray`: `Key of G · 72 BPM · 4/4` — omit any part that's unset.
  If nothing is set, omit the line entirely rather than printing placeholders.
- Dedication, if present, on its own italic line beneath.
- Gold `.cog-glow` anchored bottom-center behind everything.

**2. The one nudge (only when `nextAction()` is non-null)**
- A single full-width row directly under the header: label in charcoal, chevron on the right.
- `--cog-cream-light`, 16px radius, hairline `--cog-border-gold`.
- Never two nudges. Never a red badge. Never a count bubble on the tiles themselves.
- When `nextAction()` returns `null`, render nothing — the space simply closes up.

**3. The five tiles**
2-column grid, 12px gap, the Lyrics tile spanning both columns (it is the song).
```
  ┌──────────────────────────────┐
  │ Lyrics                       │
  │ 3 sections · 24 lines        │
  └──────────────────────────────┘
  ┌─────────────┐ ┌──────────────┐
  │ Voice       │ │ Chords       │
  │ 6 takes     │ │ 2 progr...   │
  └─────────────┘ └──────────────┘
  ┌─────────────┐ ┌──────────────┐
  │ Notes       │ │ People       │
  │ All clear   │ │ 3 people     │
  └─────────────┘ └──────────────┘
```
- Tile: `--cog-cream-light`, `--cog-border`, 16px radius, min-height 96px.
  Title in serif 1.125rem charcoal; subtitle from `tileSubtitle()` in `--cog-warm-gray` `--t-label`.
- People tile shows up to 5 overlapping 24px avatars (initial + `avatar_color` fallback) instead of an icon.
- Voice tile shows three idle gold waveform bars in the corner. No other tile gets ornament.
- Press: `scale(0.97)`, 150ms. Route straight to the panel — no intermediate sheet.

**4. Capture bar**
- The existing hold-to-record capture bar stays pinned above the safe area, unchanged.
  It is the only floating element on the screen.

## Locked / viewer states
- `is_locked`: tiles still open, but write affordances inside are already gated elsewhere —
  the hub shows one quiet line under the header: `This song is locked.` Nothing more.
- Viewer (`can_write === false`): identical layout. `nextAction()` already suppresses
  write-only nudges. Do not render disabled buttons.

## Performance rules
- One `getHubBoard` call on mount. Nothing else. No bootstrap, no members query, no memo list.
- Cache under `["hub", songId]` with `staleTime: 30_000`; realtime song events invalidate that key.
- Paint the header from the catalog's cached song row instantly, then let the tiles fill in —
  tiles render their skeleton as the subtitle line only (a 12px `--cog-cream-dark` bar), never a spinner.
- Tiles must not shift height when data arrives: reserve the subtitle line from first paint.

## Motion
- Tile entrance: `translateY(8px) → 0`, opacity 0→1, 400ms `--cog-ease-reveal`, 40ms stagger.
- The nudge row fades in 250ms after the tiles, never before — the song comes first.

## Copy discipline
`3 sections · 24 lines` · `6 takes` · `All clear` · `Invite someone in` · `See what changed`.
Banned: "dashboard", "overview", "items", "0 results", any red count badge.

## Done when
- The hub paints from a single small request and never downloads canvas cards.
- A brand-new song shows exactly one nudge: `Record the first idea`.
- A calm song shows five tiles and no nudge at all.