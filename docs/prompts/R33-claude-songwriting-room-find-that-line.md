# R33 — Find that line

**Goal:** the writer half-remembers a line — *"something about the harbour"* — and wants
it back in two seconds. Not a filter, not a tab, not a results page. One field, live
results, one tap to the place.

## What was wrong

There was no way to search inside a song. To find a line you scrolled the sheet; to find
an idea you panned the canvas. Every other surface in the room got faster while the one
thing a songwriter does most — *go back to something they already wrote* — stayed manual.

## Backend (done — Lovable)

- `song_search(_song_id, _q, _limit)` — one membership-gated pass across lyrics, notes,
  canvas cards, captures, and take names. Archived rows excluded.
- Each hit returns `{ source, entity_id, title, snippet, match_at, match_len, updated_at }`.
  The snippet is a 120-char window centred on the match and `match_at` is the offset
  *inside the snippet*, so the UI bolds without re-scanning or regex.
- Ranking is fixed and boring on purpose: lyrics → ideas/captures → notes → takes,
  each newest first. No relevance scores shown, ever.
- Queries under 2 characters return an empty array rather than the whole song.
- SDK: `src/integrations/cog/search.ts` — `searchSong`, `searchHitHref`, `splitHit`.

## UI to build (Claude)

### 1. The field
Search lives in the room header as a magnifier icon that expands **in place** into a
full-width field. It never navigates to a search page and never opens a modal.
Placeholder: `Find a line, an idea, a take`. Escape or the back-chevron collapses it and
restores the previous scroll position exactly.

### 2. Live results
- Debounce 180ms. Show results in a sheet that rises to 60% height under the field.
- Group by source with quiet serif headers: `Lyrics`, `Ideas`, `Notes`, `Takes`.
  Hide a group entirely when empty — never render "0 results" per group.
- Row = `{title in warm gray, small} / {snippet with the match bolded in charcoal}`.
  Use `splitHit`; the matched span is `font-weight: 600`, never highlighted with a
  background colour (gold background reads as a chord chip).
- Take rows show a 12-bar mini waveform instead of a snippet, and a play affordance that
  previews in place without leaving the results.

### 3. The tap
`searchHitHref` gives the destination. Landing must be exact: the sheet scrolls the
section in and pulses its label gold for 600ms; the canvas pans and selects the card;
the voice drawer opens with that take expanded. Same landing behaviour as the feed
(R32) — one shared `useJumpTarget` hook, not two implementations.

### 4. Empty and idle
- Idle (field open, nothing typed): show the three most recently touched things in the
  song under a single line, `Recently`. No history list, no saved searches.
- No matches: one line, *Nothing in this song says "harbour" yet.* Nothing else.

### 5. Performance
- Key `['search', songId, q]`, `staleTime: 30s`, `keepPreviousData` so results never
  flash empty mid-typing.
- Prefetch nothing. Cancel in-flight queries on each new keystroke.
- The search sheet is a lazy chunk — it must not load until the magnifier is tapped.

## Rules
- One search field per room. Never a global search and a room search on the same screen.
- Never show a result count, a relevance score, or a "search tips" affordance.
- Never let search results become a place you can edit from — they are a door, not a desk.

## Done when
Typing five letters surfaces the line, and one tap puts the caret back where the writer
left it.
