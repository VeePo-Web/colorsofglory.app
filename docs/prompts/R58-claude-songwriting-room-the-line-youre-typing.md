# R58 — "The line you're typing is never behind the keyboard"

**Audit round 58 · Songwriting Room · The act of writing a line on a phone**
Owner: Claude (frontend). SDK shipped by Lovable: `src/integrations/cog/keyboard.ts`.

---

## 1. The stress test

390px phone. Verse 1 is open. Someone types the fourth line.

- Line 1–3: fine.
- Line 4: **the caret is under the keyboard.** You are typing blind.
- You scroll up with your thumb; the textarea re-scrolls itself on the next
  keystroke and yanks you back.
- You reach the end of the verse. To get to the chorus you must dismiss the
  keyboard, scroll, tap the chorus, wait for the keyboard to come back —
  the screen flashes twice. Four gestures to continue the same thought.
- The record button, the next-move strip and the tab bar are all sitting
  *underneath* the keyboard, occupying nothing but still reserving space, so
  the writable area is smaller than it looks.
- Rotate the phone: the layout keeps its portrait height because `100vh` on
  iOS Safari does not change when the keyboard opens.

Fifty-seven rounds have polished everything *around* writing a line. Nobody
has measured the keyboard. This is the single most-performed action in the
product and it is the least designed one.

---

## 2. The reference standard

- **iA Writer / Bear** — the caret sits at a fixed comfortable height; the
  text moves, not the view. You never chase your own cursor.
- **Things 3** — one row of contextual keys above the keyboard, never more
  than three, and they change with what you're doing. It is the only chrome
  visible while typing.
- **iMessage / Notes** — the keyboard never dismisses when you move between
  fields. Focus travels; the keyboard stays put.
- **Notion mobile** — the toolbar hugs the keyboard exactly; there is no gap
  and no overlap, ever, including on rotation and on split keyboards.

The rule they all share: **while the keyboard is up, the screen contains the
words and nothing else.**

---

## 3. What shipped (SDK — do not rebuild)

`src/integrations/cog/keyboard.ts`

| Export | What it does |
|---|---|
| `startKeyboardTracking()` | Call once at app mount. Tracks `visualViewport` and publishes the keyboard inset as a CSS variable `--cog-kb` (`0px` when closed) plus a `cog-kb-open` class on `<html>`. Disposes cleanly. Desktop-safe. |
| `subscribeKeyboard(fn)` / `getKeyboardState()` | `{ inset, open, viewportHeight }` if you need it in JS. |
| `keepCaretVisible(textarea, { container?, margin? })` | Scrolls by the **smallest amount that works**. Returns 0 when nothing moved — which must be the common case. |
| `caretOffsetTop(textarea)` | Caret line offset via a reused mirror element. |
| `moveCaretTo(nextTextarea, "start" \| "end")` | Moves focus **without the keyboard dismissing** (no blur-then-focus flicker). |
| `CARET_MARGIN_PX` | 24 — the breathing room constant. Use it, don't invent another. |

---

## 4. What you build

### 4.1 Layout: one variable, everywhere

Never use `100vh` in the room again. The sheet container becomes:

```css
height: calc(100dvh - var(--cog-kb, 0px));
padding-bottom: calc(env(safe-area-inset-bottom) * (1 - var(--cog-kb-on, 0)));
```

Simplest correct form: give the scroll container
`padding-bottom: var(--cog-kb, 0px)` and let it be. Anything pinned to the
bottom uses `bottom: var(--cog-kb, 0px)`. The variable transitions at
**250ms `--cog-ease`** so the layout rides up with the keyboard instead of
snapping after it.

### 4.2 Caret discipline

On `input`, `keyup` (arrows), and `focus` of any lyric textarea:

```ts
keepCaretVisible(el)
```

Rules:
- **Never** call `scrollIntoView` on a textarea. Remove every existing call.
- **Never** re-scroll while the user is actively touch-scrolling: set a flag
  on `touchstart` in the scroll container, clear it 400ms after `touchend`,
  and skip `keepCaretVisible` while it's set. The user's thumb outranks us.
- `behavior: "auto"` during typing (instant, invisible). Only use `"smooth"`
  for the section jumps in 4.4.

### 4.3 While the keyboard is up, everything else leaves

When `cog-kb-open` is on `<html>`, fade out over 150ms and remove from flow:
the tab bar, the next-move strip (R51), the record button, the reactions row,
the presence avatars (R41/R53), and the section's take list. The screen is:
the section label, the lines, and the key bar. Nothing else.

They all come back on `focusout`, 150ms, no layout jump (they were removed
from flow — reserve nothing).

### 4.4 The key bar — exactly three keys, no more

One 44px row pinned at `bottom: var(--cog-kb)`, cream-light, hairline top
border, no shadow. Three targets, left to right:

1. **↑ / ↓** paired arrows — previous / next line. Uses `moveCaretTo`.
2. **The part name** — e.g. `Chorus →`. Tapping it moves the caret into the
   first empty line of the next section, keyboard never dismissing. This is
   the Temu-style forward push: the writing surface always offers the next
   place to write. At the last section the label becomes **`+ New part`** and
   creates one (default `verse`) — you can never reach an end.
3. **Done** — dismisses. Right-aligned, text only, charcoal, not gold.

That is the entire toolbar. **Do not add:** formatting, chord insert, rhyme
tools, undo, a mic, an emoji row, or a second row. Chords are placed by
tapping above a line when the keyboard is *down* — that stays as is.

### 4.5 Autosave stays silent

R55's merge autosave already runs. It must not fire a re-render that moves
the caret. Confirm: the textarea is uncontrolled while focused, and server
echoes for the section you are editing are ignored until blur (line-level
suggestions still arrive — they render in the gutter, never in your text).

### 4.6 Rotation and interruption

- On `orientationchange` the SDK re-measures automatically; just make sure
  nothing caches a height in JS.
- If the app is backgrounded mid-line, the R55 autosave has it. On return,
  restore focus to the same line id and caret offset (store both in
  `song_room_state.filter_state` alongside the existing room state).

---

## 5. Removals (trim the fat)

1. Every `scrollIntoView`, `window.innerHeight` read, and `resize` listener
   in the lyric sheet.
2. Every `100vh` / `h-screen` inside the room.
3. Any keyboard-avoidance wrapper component or `KeyboardAvoidingView`-style
   padding hack.
4. Any second toolbar row, formatting controls, or keyboard-visible FAB.
5. Any `blur()` call used to "reset" focus between lines.

---

## 6. Acceptance — walk it on a real phone

1. Type twelve lines into a verse without ever scrolling manually. The caret
   stays roughly a third up from the keyboard the whole way. The page never
   jumps.
2. Thumb-scroll up while the keyboard is open, then keep typing. The view
   does not fight you for at least 400ms after your thumb leaves.
3. Tap `Chorus →`. The keyboard never blinks. You are on the chorus's first
   empty line.
4. Reach the last section. The key becomes `+ New part`. Tap it — a new verse
   exists and you are typing in it.
5. Rotate mid-line. Nothing overlaps; the caret is still visible.
6. Background the app mid-line, return. Same line, same caret position.
7. Desktop: `--cog-kb` is `0px`, the key bar is absent, nothing regressed.

---

## 7. How this serves the one goal

*Everything for this song stays connected here* is only true if writing a
line here is better than writing it in Notes. Notes has one advantage today:
its keyboard behaves. After R58 ours behaves better — and it does one thing
Notes can never do, which is offer you the chorus as the next tap.
