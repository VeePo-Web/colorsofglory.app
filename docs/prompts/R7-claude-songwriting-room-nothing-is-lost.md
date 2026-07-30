# R7 — Songwriting Room Audit: "Nothing Is Lost, Nothing Is Scary"

**Owner:** Claude (frontend/UX). **Backend for this round is already shipped by Lovable.**
**The one goal of the room:** a songwriter gets an idea out of their head and into the song in seconds, and never loses it.

R1–R6 covered simplification, performance, audio arbitration, realtime economics, and the pager.
R7 covers the last untouched axis: **destructive actions, recovery, and confidence.**

---

## Findings

### P0 — Deleting a card was permanent and silent
`deleteCanvasCard` issued a hard `DELETE`. A mis-swipe on a lyric fragment destroyed
it forever, with no undo, no trash, no version fallback. For a product whose promise is
"your song is protected," this is the single worst defect in the room.

**Now fixed at the backend layer.** Deletes are soft:
- `archiveCanvasCard(id)` — removes from feed/search/section counts instantly, keeps the row.
- `restoreCanvasCard(id)` — undo.
- `listArchivedCanvasCards(songId)` — last 30 days, newest first.
- Rows are purged automatically after 30 days.
- `deleteCanvasCard` is now an alias for archive and is deprecated — stop importing it.

### P0 — No undo affordance anywhere
Every destructive or semi-destructive action (remove card, un-file a section, clear a
take) completes with a plain success toast. There is no path back.

### P1 — Confirmation dialogs where undo belongs
Any `window.confirm`/AlertDialog in the room for removing a card should be deleted.
Confirmations tax every correct action to protect against a rare wrong one. Undo taxes
nothing. Simple beats safe-feeling.

### P1 — Removed cards have no home
There is no way to see what was removed from this song. A writer who deletes the wrong
chorus draft on Tuesday has no recovery path on Thursday.

### P2 — Optimistic removal isn't reconciled
If archive fails (offline, revoked role), the card must return to its exact position,
not the end of the list.

---

## What to build

### 1. Undo toast (the core of R7)
Replace every card-removal path with:
1. Optimistically remove the card from local state (remember its index + tree).
2. Call `archiveCanvasCard(id)`.
3. Show a single toast: **"Removed" · Undo** — 8 second life, one at a time.
4. Undo → `restoreCanvasCard(id)` and re-insert at the remembered index.
5. Archive failure → re-insert at remembered index, toast "Couldn't remove that."

Rules: no confirmation dialog anywhere in this flow. No red. Toast copy is calm,
lowercase-warm, never "Deleted!" — the app never shouts about loss.

### 2. "Recently removed" drawer
In the room's overflow menu (not the primary surface): **Recently removed**.
- `listArchivedCanvasCards(songId)` → list of card previews with relative time and who removed it.
- Each row: tap to preview, single "Restore" action → `restoreCanvasCard`.
- Empty state: "Nothing removed in the last 30 days."
- Footnote: "Removed cards are kept for 30 days."

### 3. Filter archived cards out of every local cache
Realtime deltas now return archived rows (with `archived_at` set) so remote removals
propagate. Any card arriving with `archived_at != null` must be **dropped from local state**,
not rendered. Do this in one place — the delta reducer — not per component.

### 4. Reconcile the swipe gesture
If a card-level swipe means "remove," it must be a deliberate distance/velocity threshold
with a visible rail, and it must land in the same undo path. If the pager already owns
horizontal swipe (R6), do NOT add a competing horizontal remove gesture — put remove in
the card's contextual menu instead. Simpler wins.

---

## Acceptance
- No hard delete of a card exists anywhere in `src/`.
- Removing a card shows exactly one undo toast; undo restores it to the same slot.
- No confirm dialog for card removal.
- Recently removed drawer lists, previews, and restores.
- A remote collaborator's removal disappears locally within one delta tick.
- No layout shift or scroll jump when a card is removed or restored.

## SDK reference
```ts
import {
  archiveCanvasCard,
  restoreCanvasCard,
  listArchivedCanvasCards,
} from "@/integrations/cog/canvas";
```
