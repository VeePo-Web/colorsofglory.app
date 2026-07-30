# R37 — Songwriting Room: "Try it another way"

## The one goal
The room must never make a writer afraid to experiment. If they want to rewrite
the chorus, drop a verse, or try the whole thing in a different shape, they
should be able to branch without endangering the version that already works.

## Backend ready
- RPC `duplicate_song(_song_id, _title)` → `{status:'created', song_id, title,
  sections}` or `{status:'limit_reached'}`. Copies parts, words and chords into
  a new song owned by the caller; logs `song_copied` in the new room's feed.
  Recordings are intentionally not copied.
- SDK `src/integrations/cog/duplicate.ts`: `duplicateSong`, `suggestedCopyTitle`.

## UI — build exactly this, nothing more

### 1. Entry
Room overflow menu → **"Try it another way"**. Sits directly above
"Recently removed". Never a duplicate icon on the song card.

### 2. The sheet (one screen, two elements)
- Serif heading: **Try it another way**
- One muted line: `A fresh copy of "<title>" — words and chords come with it,
  recordings stay here.`
- A single text field pre-filled with `suggestedCopyTitle(title)`, text
  pre-selected so typing replaces it.
- Gold full-width CTA: **Make the copy**.
No role pickers, no checkbox list of what to include, no "advanced" section.

### 3. After
- Navigate straight into the new room (slide-from-right) — do not return to the
  catalog and make them find it.
- Toast: `Copied. You're in the new one.` with an **Back to the original**
  action for 8 seconds (reuse the R34 undo-toast component).
- The new room's feed already shows "copied from <original title>" as its
  first entry — do not add a banner saying the same thing.

### 4. Plan limit
If `status === 'limit_reached'`, do NOT show an error. Swap the sheet body in
place for one calm line — `Your free plan keeps one song at a time.` — plus the
gold **See plans** CTA. Same sheet, no modal stacking, no red.

## Performance
- Optimistically push the new room's route only after the RPC resolves
  (it is a single fast transaction); show the CTA in a pressed/disabled state
  with no spinner text change.
- On arrival, seed the react-query cache for the new song from the RPC response
  so the room header paints before its bootstrap returns.
- Invalidate `["catalog"]` in the background, never blocking navigation.

## Anti-patterns (forbidden)
- A "version tree" UI, branch names, or merge-back flows.
- Asking which pieces to copy.
- Copying recordings or collaborators — a copy is a private draft until shared.
