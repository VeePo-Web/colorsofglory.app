# R19 — Songwriting Room Audit: "The sheet saves itself, once"

**Goal of this pass:** the lyrics + chords editor opens instantly and every save is
a single, all-or-nothing act. No half-saved songs, no waterfall of requests.

## What changed (Lovable, backend + SDK only)

| Before | After |
|---|---|
| Opening `/songs/:id/sheet` = 3 parallel queries (sections, lyrics, meta) | 1 RPC `song_sheet_bootstrap` |
| Saving = up to 6 sequential writes, non-atomic (a dropped connection could leave sections without lyrics) | 1 RPC `save_song_sheet` inside a single transaction |
| Key/tempo lived only inside a hidden `__sheet_meta__` row | Also mirrored to `songs.key_signature` / `songs.tempo_bpm` on every save |
| Viewers were blocked only by table RLS | Explicit `write_not_allowed` error from the save RPC |

SDK signatures are unchanged — `getSongSheet(songId)` and
`saveSongSheet(songId, doc, prev)` in `src/integrations/cog/sheet.ts` behave
exactly as before. No page edits are required for the win.

## UI brief (Claude)

### 1. Open state
- The sheet must paint from the TanStack cache first, then reconcile with the
  single bootstrap call. Key `['sheet', songId]`, `staleTime: 15s`.
- Skeleton = section labels only (serif, gold-pale shimmer). Never a spinner
  covering the page: the writer should see the shape of their song immediately.

### 2. Save state — one quiet word
- Autosave debounce 800ms after the last keystroke, plus an immediate save on
  blur, on section add/remove, and on navigating away.
- The only save affordance is a single line of warm-gray text under the header:
  `Saving…` → `Saved` → (after 3s) fades out. No spinners, no "unsaved changes"
  banner, no dirty dot.
- On failure show one `sonner` error toast with a "Try again" action that calls
  the same save. Because saves are now atomic, a retry is always safe — never
  warn the user about partial data.

### 3. Read-only (viewer) mode
- If `capabilities.can_write === false`, render the sheet with no caret, no
  add-section button, no chord affordances. Show one line at the top:
  "You're viewing this song." Never render a disabled editor.
- Never let a viewer reach the save path; the RPC returns `write_not_allowed`
  and the SDK surfaces it as a `CogError`.

### 4. Key / capo / tempo control
- One compact control row under the title: `Key G` · `Capo 2` · `84 BPM`.
  Tapping any opens a single sheet with all three (the writer thinks of them
  together). Changing the key transposes visually only — chords are stored
  key-independent, so transposition never dirties lyric content.
- Because key/tempo now mirror onto the song row, the catalog card and room
  header can show them without loading the sheet. Use the song record, not the
  sheet, on those surfaces.

### 5. Performance gates
- Second visit to the sheet paints in < 100ms from cache.
- A typing burst produces at most one save request per 800ms window.
- No request is issued for an unchanged section (the SDK already diffs).

## Definition of done
- One request to open, one request to save.
- Save status is a single word, never a modal or a banner.
- A viewer can never reach a write path.
- Key, capo and tempo are one control, not three scattered ones.
