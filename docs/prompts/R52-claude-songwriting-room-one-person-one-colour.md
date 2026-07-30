# R52 — One person, one colour. Every note lives where it's about.

**Audit target:** collaboration identity and the anchoring of every human
signal (notes, replies, suggested lines, moment pins) in the room, the canvas
and the feed.
**Verdict:** the room can *do* collaboration and cannot *show* it. Two
structural defects, both invisible in a solo song and both fatal the moment a
second person arrives.

---

## 1. The two defects (stress-tested)

### Defect A — identity is not stable
`getCreatorColor(userId)` hashes a UUID into a 5-colour palette on the client.

- With 4 collaborators the odds two of them collide are ~**73%**. Two people
  render as the same clay dot. Colour stops meaning anything, and the moment it
  stops meaning anything the writer stops reading it.
- It hashes `userIdOrName` — so a card keyed by name and a presence dot keyed by
  id give the **same person two different colours on the same screen**.
- Figma's whole multiplayer legibility rests on: cursor colour = avatar ring =
  selection outline = comment pin, forever. We break that binding today.

### Defect B — conversation is detached from its subject
R45 (replies), R46 (moment notes) and R19/R45 (line suggestions) all ship
server-side. In the UI every one of them resolves to *a list somewhere else*.

- A note about the second line of the bridge is read on a Notes screen, out of
  earshot of the bridge.
- A moment note at 1:23 of a take is a row with a timestamp, not a pin you tap
  to hear the thing being talked about.
- Google Docs, Notion, Figma and Splice all landed on the same answer:
  **the comment is a pin at the place**. Never a list. Lists are the fallback,
  not the interface.

Both defects share a root cause: the client was left to invent presentation for
data the server never described spatially.

---

## 2. What shipped (backend — done)

- **`song_cast(song_id)`** — everyone in the song with `color_index` derived
  from join order **on the server** (owner is always slot 0), plus
  `display_name`, `initials`, `avatar_url`, `role`, `is_you`. Same slot for
  everyone, on every device, forever.
- **`song_anchors(song_id)`** — one request returning three marker sets:
  - `lines[]` — open suggestions keyed to `{section_id, line_id}`, with the
    lead author's `color_index`
  - `moments[]` — every take note as `{take_id, at_ms, preview, color_index}`
  - `sections[]` — section-level note counts
- **`src/integrations/cog/cast.ts`** — `getSongCast`, `getSongAnchors`,
  `colorForSlot`, `castIndex`, `lineAnchorIndex`, `momentsByTake`,
  `sectionNoteCounts`.

Gold (`--cog-gold`) stays reserved for system state. No collaborator ever
renders gold — a gold ring always means the app, never a person.

---

## 3. What to build (frontend — Claude)

### 3.1 Retire the hash

`getCreatorColor()` is now **deprecated for anything with a real user id**.

- Add a `SongCastProvider` at the song route boundary: fetches `song_cast` once
  (alongside `song_room_bootstrap`, non-blocking), exposes
  `usePerson(userId) → { name, initials, color, role, isYou }`.
- Replace every `getCreatorColor(...)` call inside a song with `usePerson`.
  Keep the hash **only** for cards with no author (legacy/local-first), and
  have it fall back to a neutral warm grey, not a palette colour.
- Delete `getCreatorInitials` call sites inside the room — the server sends
  initials, so two surfaces can never disagree.

### 3.2 The pin (one component, three placements)

`src/components/room/AnchorPin.tsx`. 14px circle, `color.base` fill,
`color.glow` shadow, 2px cream ring. Count > 1 shows the number inside at 9px.
**44px invisible tap target.** That is the entire component.

| Placement | How it reads | Tap does |
|---|---|---|
| **Lyric line** (suggestion) | 2px underline in the author's colour under the line + pin in the right gutter | opens the accept/reject popover **on that line** |
| **Take waveform** (moment) | pin sitting on the waveform at `at_ms / duration` | seeks to `at_ms`, starts playback, opens the thread |
| **Section header** (notes) | pin beside the section label | opens the section's thread |

No pin ever opens a different screen. If a tap navigates away from the thing
the pin was attached to, it is wrong.

### 3.3 Accept / reject, in place (law 4)

A suggested line renders inline in the lyric sheet:

```
  Your old line, struck through            ← 40% opacity, line-through
  Their suggested line                     ← author colour, medium weight
  [ ✓ ]  [ ✗ ]        Sarah · 2h           ← 44px each, adjacent
```

- ✓ applies optimistically: the old line vanishes, the new line settles into
  normal charcoal in 250ms, pin disappears. **Zero spinner.**
- ✗ collapses the block in 150ms with a "Kept yours · Undo" toast (5s).
- No diff screen, no suggestions route, no "review queue" page. The queue is
  the lyric sheet.
- Owner-only. A contributor sees their own suggestion pending in their colour
  with a quiet "waiting" dot — never an accept button they can't press.

### 3.4 Presence uses the same colour (law 1)

Wire `subscribeRoomFocus` (R41) through `usePerson`: the 20px avatar next to a
section header is the person's slot colour, their initials, and nothing else.
No name label, no cursor, no follow-mode, no join/leave toast. When they type,
the ring breathes at 2s. That is the whole presence system, deliberately.

### 3.5 Instant feel

- `song_anchors` is fetched **once** per room entry, cached
  `["song", id, "anchors"]`, `staleTime: 30_000`. Pins paint from cache on
  navigation between room tabs — never refetched on tab switch.
- Indexes (`lineAnchorIndex`, `momentsByTake`) are built once in a `useMemo`
  at the provider, never per line. Rendering 200 lyric lines must be O(1) per
  line lookup.
- Every write (accept, reject, add note, reply) mutates the cached anchor set
  locally first, then reconciles. A failure rolls back with a quiet toast.
- Realtime: on `song_activity` invalidation, refetch anchors **once**, debounced
  400ms. Never subscribe per-pin.

### 3.6 Trim the fat in the same pass

1. **Delete the standalone Notes list screen** for a song. Every note is
   reachable from its subject; the list is redundant surface area. (If a
   catch-all is needed, it is the feed — R32 — not a second inbox.)
2. **Delete any "Suggestions" route/tab.** §3.3 makes it dead.
3. **One author affordance per card.** A canvas card currently can show a dot,
   initials and a name — keep the dot + initials, drop the name (it's in the
   long-press sheet).
4. **No unread counts on tabs.** A pin is the unread signal. Nothing else.

---

## 4. Acceptance — 390px, two real accounts, one song

- [ ] Two collaborators never render the same colour, on any device, ever.
- [ ] The same person is the same colour in: presence, pins, card dots, feed
      rows, take lanes, credits.
- [ ] Every note and suggestion is reachable by tapping the thing it is about.
- [ ] A moment pin seeks and plays from that millisecond in one tap.
- [ ] Accept/reject happens without leaving the lyric sheet and without a spinner.
- [ ] Reject is undoable for 5 seconds.
- [ ] Anchors cost exactly one request per room entry.
- [ ] Scrolling a 200-line song stays at 60fps with pins rendered.
- [ ] A viewer sees pins and threads, and no accept/reject control.
- [ ] Nothing in this feature is red, badged, or counted on a tab.

---

## 5. Against the big vision

The room exists so a song gets finished *with other people*. Identity and
anchoring are what turn "a database with collaborators" into a room where you
can feel someone else was here. After R51 the room always knows the next move;
after R52 it always shows **who** and **where** — and both answers are given in
one glance, with no list, no screen and no second tap.