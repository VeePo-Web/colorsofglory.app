# R59 — "The room has two surfaces"

**Audit round 59 · Songwriting Room · Information architecture**
Owner: Claude (frontend). SDK shipped by Lovable: `src/integrations/cog/roomNav.ts`.

---

## 1. The stress test

Open the app for the first time and try to answer one question: *where am I?*

The spec gives the room ten routes — `/lyrics`, `/voice`, `/notes`,
`/people`, `/versions`, `/activity`, `/credits`, `/canvas`, plus the hub and
the song itself. Walk it as a stranger:

- You record a hum on `/voice`. The lyric it belongs to is on `/lyrics`.
  The comment about it is on `/notes`. Three screens, one thought.
- `/activity` says "Sarah edited Verse 2." You tap it. Where does it go —
  `/lyrics`, or `/versions`? Both are defensible, which means neither is
  obvious.
- `/versions` and `/activity` are the same information at two time scales,
  on two screens, in two visual languages.
- `/credits` and `/people` are the same eight humans, twice.
- You navigate four levels deep, then hit back four times to get out.

Ten destinations is nine chances to be lost. Every prior round made an
individual surface excellent; **none of them reduced the number of surfaces.**
This is the largest remaining piece of fat in the product and the one most
directly opposed to "someone seeing it for the first time understands
immediately."

---

## 2. The reference standard

- **Figma** — one canvas. Layers, comments, version history, and sharing are
  panels and sheets *over* it. You never leave the artwork.
- **Linear** — issue view + list. Everything else (activity, related, links)
  lives in the right rail of the thing itself. There is no "activity page."
- **Things 3** — you can only ever be in a list. Editing anything happens
  in place, expanding under your finger.
- **Apple Notes** — one note. Sharing, history, and collaborators are all a
  single button that opens a sheet. Nobody has ever gotten lost in Notes.

The shared rule: **content is a place; everything else is a sheet.**

---

## 3. The vision

The room is **two surfaces**:

| Surface | What it is | The question it answers |
|---|---|---|
| **Song** | The parts in order, each with its lines, its chords, its takes, its notes inline | *What does the song sound like right now?* |
| **Ideas** | The canvas — loose cards, hums, fragments not yet in the song | *What else have we got?* |

That's it. Nothing else is a place. Six things open **over** whichever
surface you're on, as bottom sheets: **People · History · Credits · Share ·
Search · Settings.**

- `/notes` is gone — a note lives on the line or the take it is about (R52).
- `/voice` is gone — takes live under the part they belong to (R44).
- `/chords` is gone — chords live above the lines (R42).
- `/versions` + `/activity` merged into one **History** sheet: one reverse
  timeline, recent events at the top, restore points further down. Same
  information, one language, one scroll.
- `/credits` is a tab inside the **People** sheet, not its own thing.

**Two surfaces, six sheets, zero sub-pages.**

---

## 4. What shipped (SDK — do not rebuild)

`src/integrations/cog/roomNav.ts`

| Export | Use |
|---|---|
| `RoomSurface` / `ROOM_SURFACES` | The only two places. Render the switcher from this array — never hardcode. |
| `RoomOverlay` | The only six sheets. If a destination isn't in this union, it doesn't exist. |
| `roomPath(songId, dest)` | Canonical URL. **Overlays never change the path** — a sheet is not a location. |
| `parseRoomPath(pathname, hash)` | Restore where someone was, including the exact section or take. |
| `resolveLegacyRoute(segment)` | Redirect map for the ten spec routes. Ship these as `<Navigate replace>` so old links and any built screens keep working. |
| `destinationForEvent(event)` | Where a feed item goes. Every event resolves *inside* a surface — never to a detail page. |

---

## 5. What you build

### 5.1 The switcher — two words, no icons

Top of the room, centred, under the song title: `Song` · `Ideas`.
Two text labels, 15px, charcoal. Active one is gold with a 2px gold underline
that **slides** between them (250ms `--cog-ease`). No pill, no segmented
control chrome, no icons, no third item ever.

Swipe left/right anywhere on the surface also switches, with the underline
tracking the drag. The surfaces cross-fade (200ms); they do **not** slide as
whole screens — they are two views of one room, not two pages.

### 5.2 The sheets

One button, top-right of the room: the **cast row** (R52) — up to three
stacked identity circles. Tapping it opens the **People** sheet, which
contains the Credits tab. That is the only always-visible sheet trigger.

The other five open contextually, never from a permanent bar:
- **History** — tap the "changed since you left" line in the feed strip.
- **Share** — from inside People ("Bring someone in").
- **Search** — pull down on either surface (the standard iOS gesture).
- **Settings** — long-press the song title.
- **Credits** — the second tab of People.

All sheets: bottom-anchored, `border-radius: 20px 20px 0 0`, cream-light,
drag-to-dismiss, backdrop at 30% charcoal, 400ms `--cog-ease-reveal` in.
**A sheet never opens another sheet.** If a sheet needs to take you
somewhere, it dismisses first, then navigates.

### 5.3 Back means one thing

- A sheet open → back closes the sheet.
- On **Ideas** → back goes to **Song**.
- On **Song** → back leaves to the catalog.

Maximum depth from the catalog to anywhere in the room: **two**. Verify this
by trying to get three levels deep. You should not be able to.

### 5.4 Deep links and returning

- Feed items and notifications use `destinationForEvent` — they land you on
  the surface with the section/take scrolled into view and given a single
  800ms gold ring, then nothing.
- On leaving, store `parseRoomPath` output into `song_room_state`; on return,
  restore it silently. No "resume where you left off?" prompt — just be there.

### 5.5 Redirects

Add `<Route path="/song/:id/:legacy" element={<LegacyRedirect />} />` that
calls `resolveLegacyRoute` and `<Navigate replace>`s. Old links never 404,
and no one can bookmark their way into a page that no longer exists.

---

## 6. Removals (trim the fat)

1. The routes and page components for `lyrics`, `voice`, `notes`, `chords`,
   `people`, `versions`, `activity`, `credits` — replaced by two surfaces and
   six sheets.
2. The bottom tab bar inside the room, if one exists. Two surfaces do not
   need a tab bar; they need two words.
3. Any breadcrumb, any "back to song" link, any nested header.
4. The separate Activity page's visual language — History inherits the feed's.
5. Any icon in the surface switcher.

---

## 7. Acceptance — hand it to a stranger

1. "Where do the lyrics live?" — they tap `Song`. Correct on the first try.
2. "Where's the hum Sarah recorded?" — under the part it belongs to, on
   `Song`. They find it without switching surfaces.
3. "Who else is in here?" — they tap the faces. One tap.
4. From any point in the room, one back press produces an obvious result and
   two get them out.
5. Open an old `/song/:id/activity` link — lands in the room with History
   open, no flash of a missing page.
6. Count the screens they can name after two minutes: **two.**

---

## 8. How this serves the one goal

*One song, one private room.* A room with ten doors is not a room, it's a
corridor. After R59 the room is one space with a second table in the corner
for loose ideas, and everything else is something you pull out, look at, and
put back — which is exactly what a stranger already expects a room to be.
