# R28 — Two ideas become a section (Merge & Splice)

**Goal:** a writer looks at two scraps on the canvas and thinks "those are the chorus."
Two taps and it *is* the chorus — a real section in the sheet, in one step, with no retyping.

## Backend (done — Lovable)

RPC `merge_cards_into_section(_song_id, _card_ids[], _kind, _label, _archive_sources)`
- Card order in the array = line order in the new section.
- Each card's body splits on newlines; blank lines are dropped.
- Creates the section at the end of the arrangement, writes `song_lyrics` (v1 lines with empty anchors),
  stamps the cards with the new `section_label`, archives them by default, logs
  `cards_merged_into_section` to the activity feed, and bumps `last_activity_at`.
- Returns `{ section_id, position, kind, label, line_count, cards_used }`.

SDK: `src/integrations/cog/merge.ts` → `mergeCardsIntoSection({ songId, cardIds, kind, label, archiveSources })`.
Errors already come back as human sentences.

## UI to build (Claude)

**Entry:** long-press a canvas card → "Select" mode. Selected cards get a gold border
(`--cog-border-gold`) and a small ordinal badge (1, 2, 3) so the merge order is visible.
A bottom bar rises: `2 ideas selected · Merge into section`.

**Merge sheet** (progressive, one screen, no wizard):
1. Section kind chips — Verse / Chorus / Bridge / Pre-Chorus / Other (gold fill when active).
2. Optional label field, placeholder "Chorus 2".
3. Live preview of the merged lines in order, in the lyric type style — the writer sees the
   actual result before committing. Drag to reorder lines = reorder `cardIds`.
4. Toggle: "Keep the original ideas on the canvas" (off = archive, the default).
5. Primary gold CTA: **Make this a section**.

**After merge:** sheet dismisses, canvas cards fade out (400ms, `--cog-ease-reveal`),
and the room navigates to `/song/:id/lyrics` scrolled to the new section, which fades in
from `translateY(8px)`. Toast: "Chorus added from 2 ideas." with an Undo that calls the
existing version-restore path.

**Rules**
- Merge button disabled below 2 selections; never explain why in a modal — just keep it dim.
- Viewers never see Select mode (`song_room_capabilities.can_write`).
- Optimistic: remove the cards locally the instant the RPC is issued; restore on error.

## Done when
Two scraps become a labelled section, in the sheet, in under five seconds, without typing a word.
