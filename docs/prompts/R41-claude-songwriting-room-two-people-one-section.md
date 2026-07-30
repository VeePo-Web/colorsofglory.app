# R41 — Songwriting Room Audit: "Two people, one section"

**Owner:** Claude (frontend)
**Backend:** shipped — `src/integrations/cog/focus.ts`
**Goal of the room:** everything for this song stays connected here — including
the people, so no one ever writes over anyone.

---

## The finding

The room protects the song *after* the fact: `saveSectionGuarded` refuses to
overwrite a newer version and hands back a conflict. Correct — but a conflict
dialog is a failure state. It arrives after both people have already spent
their creative energy on the same twelve words.

The room knows who is present (`subscribeSongPresence`) but not **where** they
are. That is the missing signal, and it is the cheapest possible fix: a soft
line that says *Sarah is writing here* before you start typing over her.

No locks. No "checked out by". No cursors flying around. Just awareness.

## What backend now provides

`src/integrations/cog/focus.ts` — ephemeral channel state only. No table, no
feed event, no lyric content ever transmitted.

| API | Use |
|---|---|
| `subscribeRoomFocus(songId, self, onChange)` | Returns `{ setSection, ping, stop }`. `onChange` gives every **other** member, stale entries already dropped. |
| `handle.setSection(id \| null)` | Call when a section opens/closes. |
| `handle.ping()` | Call on each keystroke. The `typing` flag decays itself after 4 s. |
| `focusIn(others, sectionId)` | Who is in one section. |
| `focusLine(others, sectionId)` | The one sentence to render, or `null`. |

Updates are throttled to one message per 800 ms — typing fast costs nothing.

## What to build

1. **One subscription per room.** Mount `subscribeRoomFocus` once in the song
   room shell (alongside the existing presence subscription) and put the
   `others` array in room context. Never subscribe per section.
2. **Wire the two calls.**
   - Lyrics editor mounts/opens a section → `setSection(sectionId)`; unmount or
     collapse → `setSection(null)`.
   - The lyric textarea's `onInput` → `ping()`. Nothing else calls `ping`.
3. **Render one line, one place.** Directly under the section label (Verse 1,
   Chorus), render `focusLine(others, section.id)` when it is non-null:
   warm-gray, `--t-label`, fading in over `--dur-base`. Nothing when it is null.
   That is the entire visible surface of this feature.
4. **A whisper on the hub.** On the section list / canvas, a section that has
   someone in it gets a small gold dot on its card corner — no number, no
   avatar stack, no tooltip.
5. **Soften the save.** If `focusLine` is non-null for the section you are
   editing, the save affordance reads *"Save — Sarah is here too"* instead of
   *"Save"*. Same button, same behaviour; the guarded save still owns
   correctness.
6. **Silence when alone.** Solo writers — the common case — must see zero
   difference from today. Verify this explicitly.

## Rules

- Never block, lock, or disable editing because someone else is present.
- No live character-by-character sync. Guarded save stays the source of truth.
- No red, no counts, no notifications, no feed rows.
- Avatars appear only in the existing room presence strip, not per section.
- Simplicity check: this ships as **one line of text plus one dot**. Anything
  more is wrong.

## Done when

- Two devices in the same verse each see the other's first name within ~1 s.
- The line disappears within a few seconds of the other person leaving.
- Typing continuously produces at most ~1 network message per second.
- A solo session renders no focus UI at all.
