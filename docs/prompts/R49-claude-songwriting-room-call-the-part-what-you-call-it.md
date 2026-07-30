# R49 — Call the part what you call it

**Audit finding.** Section headers are system-generated and unchangeable in the UI: "Verse 1",
"Chorus", "Bridge". But nobody in a real writing room talks like that. They say "the big chorus",
"the quiet one", "Mum's part", "the tag we always forget". When the label on screen doesn't match
the words being spoken, people stop pointing at the structure and go back to describing sections in
messages — which is exactly the fragmentation this room exists to end.

Second, smaller bug in the same place: the numbering counts every section, so a song reads
"Verse 1 / Chorus 2 / Verse 3". That is wrong and it quietly erodes trust in the arrangement.

**The fix, kept simple.** Tap a section header, type the name, done. Clearing the field puts the
default back. Changing what kind of part it is lives in the same one sheet.

No colour-coding. No icons per section type. No nicknames list.

## Backend (already shipped — do not build)

- `rename_song_section(_section_id, _label, _kind)` — write-permission gated, clears to default on
  empty, caps at 60 chars, logs `section_renamed` (no lyric content in the payload).
- SDK: `src/integrations/cog/sectionName.ts` — `sectionTitle`, `defaultTitle`, `renameSection`,
  `kindWord`, `KIND_CHOICES`, `hasCustomName`.

## UI to build

### 1. Fix the numbering everywhere first
Replace every place that renders a section header with `sectionTitle(section, allSections)`. It
numbers per kind, and only when there's more than one of that kind — a song with one chorus says
"Chorus", not "Chorus 1". This applies to the lyrics editor, the canvas, the hub, the listen path,
performance mode, the feed, and search results. One helper, one truth.

### 2. Tap the header
The section header becomes tappable (whole label, 44px hit area). Tapping opens an inline edit — not
a sheet, not a modal — the header text turns into an input in the same position, same serif type,
same size, cursor at the end. Placeholder is `defaultTitle(...)` in muted. Enter or blur saves.
Escape cancels. Nothing moves on screen.

### 3. Changing the kind
Under the inline input while it's open, a single horizontal strip of `KIND_CHOICES` as small chips
using `kindWord`. The current kind is filled gold; tapping another swaps it and saves with the name
in one call. The strip disappears when the input closes.

### 4. Clearing
Emptying the field and pressing Enter restores the default name. No "Reset" button.

### 5. Read-only members
Viewers see the header as plain text — no tap affordance, no disabled state.

## Performance
- Rename is fully optimistic: the header text changes on Enter, before the RPC resolves. On failure,
  revert silently and re-show the input with the typed text intact.
- `sectionTitle` is pure — memoize per section list, don't recompute per render row.
- No refetch after rename; patch the cached section in place.

## Copy
- Placeholder: the default name itself (e.g. "Verse 2")
- Never: "Rename section", "Label", "Section type", "Custom name". The feature has no words of its
  own — you just type over the name.
