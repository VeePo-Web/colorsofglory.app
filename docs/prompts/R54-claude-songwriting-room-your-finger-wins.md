# R54 — "Your finger wins"

## The stress test

Two phones, one canvas, both dragging. Fifteen cards. 3G throttling on one device.

| Observation | Verdict |
|---|---|
| Every drag frame wrote a `card_moved` row into `song_activity` | fail — a 2s drag produced ~60 activity rows; the feed became a mouse log |
| After R53, each of those rows fired an invalidation | fail — dragging one card refetched the whole room dozens of times |
| Card jumped backwards mid-drag when the slow phone's stale write landed | fail — last-write-wins with no ordering |
| No `moved_by` — impossible to tell your own echo from someone else's | fail |
| Two people on the same card: silent tug-of-war, no visible cause | fail |

This is the classic multiplayer canvas failure, and it's the one that makes an app feel broken rather than slow.

## Reference standard

Figma: dragging is local and instantaneous; the network is a background reconciliation, never a source of position while your pointer is down. Miro: the other person's cursor explains any movement you didn't cause. Linear: position changes don't enter the activity log — only meaning does.

Rule adopted: **the pointer is the source of truth while it's down; the server is the source of truth the moment it lifts.**

## Backend, shipped

- `canvas_cards.moved_by`, `canvas_cards.moved_at`.
- `canvas_move_card(_card_id, _x, _y, _z_index, _client_ts)` — stamps mover, and **rejects** a move whose client timestamp is older than another user's last move. Slow requests can no longer undo fresh ones.
- `canvas_move_card` and `canvas_bulk_move` **no longer write activity**. Position is not a creative event. (R32: the feed is a door, not a diary.)
- `src/integrations/cog/drag.ts` — `beginDrag` / `moveCard` / `endDrag` / `isHeldLocally`, with per-card 200 ms throttling and a guaranteed final write.

## Frontend work (Claude)

### 1. Drag loop

```
pointerdown  → beginDrag(id); capture pointer; card scale(1.03), shadow 0 8px 24px rgba(28,26,23,.12)
pointermove  → set position in LOCAL state only (transform: translate3d, never top/left)
             → moveCard(id, x, y)                    // throttled write, fire-and-forget
pointerup    → moveCard(id, x, y, { final: true }); endDrag(id)
             → card scale(1), shadow settles, 150ms --cog-ease
```

Position during a drag lives in a ref + `transform`, never in React state per frame, and never in React Query. One `requestAnimationFrame` writer for the whole canvas.

### 2. Ignore remote position for held cards

In the canvas store's remote-merge step:

```ts
if (isHeldLocally(card.id)) return prev; // your finger wins
```

### 3. Show the cause of movement

If a card moves and it wasn't you, animate it to the new position over 180 ms (`--cog-ease`) instead of teleporting, and pulse a 2px ring in the mover's R52 colour for 600 ms. No name label, no toast — the colour is the sentence.

If the other person's finger is currently on that card (R41 focus presence reports `cardId`), show the same ring steady at 40% opacity and make the card non-draggable for you, with no error, no lock icon, no message. It simply isn't grabbable until they let go. Two people cannot fight over one card by construction.

### 4. Multi-select and drag

One `canvas_bulk_move` on release, never during. The selection moves together as one transform group.

### 5. Snap and settle

On release, snap to an 8px grid client-side before the final write so two cards never land 3px off alignment. That's the entire "tidy" feature — no align tools, no distribute menu, no snap guides.

## Removals (trim the fat)

1. Delete "Card moved" from every feed/activity renderer — it can no longer occur.
2. Delete any per-frame optimistic cache write to `qk.canvas`.
3. Delete lock icons / "X is editing" chips on cards — the coloured ring replaces them.
4. Delete any align/distribute/tidy toolbar. Grid snap on release is enough.
5. Delete undo entries for pure moves; drag-back is the undo.

## Acceptance

- Drag a card for 5 seconds on 3G: it tracks the finger at 60fps and never rubber-bands.
- Two devices dragging different cards: neither sees jitter; each sees the other card glide with a coloured ring.
- Two devices reaching for the SAME card: the second person simply can't grab it, silently.
- A 5-second drag produces ≤ 26 network writes and **zero** activity rows.
- Kill the network mid-drag, restore: the final position lands on release; nothing snaps back.

## Why this matters to the one goal

A canvas is a shared table with ideas on it. If a card moves for no visible reason, the table stops feeling shared and starts feeling haunted. R54 makes movement always explainable — you did it, or a colour did — and makes the feed forget movement entirely so it can keep being about the song.