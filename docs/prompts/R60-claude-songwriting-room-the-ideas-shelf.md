# R60 — The ideas shelf
## Claude build prompt — Ideas surface (mobile-first)

### The stress test
Open Ideas on a 390px phone with 14 cards. A free-floating x/y board on a phone
means: pinch to find anything, cards drift off-canvas, "where did my hum go?",
two-finger gestures fighting the page scroll, and no reading order at all.
R54 made dragging conflict-free. Nobody asked whether dragging belongs on a phone.

### Reference standard
- **Apple Notes / Reminders** — capture is a list. Order is meaning.
- **Things 3** — long-press lifts, the list parts, drop is final. No zoom, no canvas.
- **Figma FigJam mobile** — read-only board; editing is a list. Even Figma gave up
  on freeform touch editing.
- **Trello** — a column is a shelf; a card is a row. Zero spatial literacy required.

### The decision (simplify)
**The board and the shelf are the same data.** `position` is the one reading order:
top row first, then left to right. On phones, Ideas is a **single vertical shelf**.
Coordinates are preserved for larger screens but are never authored on a phone.

### Build
1. `IdeasShelf` — one column, 12px gaps, cards at full width, `position` order from
   `listIdeas()`. No canvas, no zoom, no pan on <768px.
2. **Long-press 180ms → lift** (scale 1.02, shadow, haptic). Drag vertically only.
   Neighbours part with a 200ms `--cog-ease` translate. Drop = `reorderLocal()`
   immediately, then `moveIdea()` in the background. Failure re-sorts silently on
   the next realtime tick — never a toast.
3. **Tidy** — on opening Ideas from a desktop-authored board, call `tidyIdeas()` once
   if any two cards share a position. Silent; no activity event.
4. Card row = kind glyph, one line of title (or first lyric line / take duration),
   and the author's R52 colour as a 3px left rule. Nothing else.
5. **Never a dead end**: last row is always `+ Capture an idea`, and each card's
   swipe-left reveals exactly two actions — `To a part` (R44 filing) and `Remove`
   (R34 restorable).

### Remove
- The pinch-zoom / pan canvas controller on mobile.
- The `z_index` bring-to-front control.
- The "arrange" / "auto-layout" button — tidy is automatic.
- Card x/y coordinate display in any debug or inspector UI.
- The separate "Ideas tree / Final tree" toggle: one shelf; filing to a part is the promotion.

### Backend (done)
- `canvas_reading_order(_song_id)` — recompute `position` from coordinates.
- `canvas_reorder_card(_card_id, _new_position)` — gap-free 1-based reorder.
- SDK: `src/integrations/cog/ideas.ts` (`listIdeas`, `moveIdea`, `tidyIdeas`, `reorderLocal`).

### Done when
A stranger opens Ideas, sees a list they already know how to use, drags one hum
above another with one thumb, and files it into the chorus without ever zooming.
