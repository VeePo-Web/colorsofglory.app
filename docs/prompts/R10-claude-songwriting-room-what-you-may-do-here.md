# R10 — What You May Do Here (Songwriting Room + Feed Audit, round 10)

Owner: Claude (frontend). Backend shipped by Lovable this round.
Goal of the room, unchanged: **everything for this song stays connected here.**
R10 is about the second person in the room — and about never letting anyone
discover a rule by hitting a wall.

## The one sentence

Permission today is guessed in components from role strings, so a viewer sees
buttons that fail, a locked song looks writable until the toast, and a full
storage quota surfaces only *after* a recording exists. The room should tell the
truth before the tap, quietly.

---

## Findings

### P0-1 — Permission discovered by failure
Record / capture / edit affordances render for everyone and fail server-side.
That is the worst possible ordering: effort first, refusal second — and for audio
it can mean a lost take.
**Fix:** fetch `getSongRoomCapabilities(songId)` on mount, in parallel with
bootstrap and resume. Gate every write affordance on `caps.can.*`. One source of
truth; zero role-string logic in components.

### P0-2 — Disable, don't hide (mostly)
Hiding actions makes a viewer think the app is broken or the song is empty.
**Fix:** for *content* actions (write, record, capture, edit board), render them
present but non-interactive with a single calm line explaining `caps.reason`:
- `view_only` → "You're viewing this song."
- `song_locked` → "This song is locked by the owner."
- `storage_full` → "Storage is full — free space to keep recording."
For *ownership* actions (invite, manage members, rename, archive song) **hide**
them entirely for non-owners. Nobody needs to see a door they don't own.

### P0-3 — Storage runs out mid-take
`caps.storage_ok` is known before the mic opens.
**Fix:** when `storage_ok` is false, the record control is disabled *before*
arming, with the storage line and a single route to the upgrade screen. Never
allow a recording that cannot be saved.

### P1-4 — One explanation, never repeated
A viewer must not read "view only" eleven times on one screen.
**Fix:** exactly one persistent, low-contrast context line at the top of the room
("You're viewing this song — you can listen, read and comment."). Individual
disabled controls get no inline copy and no tooltip stack.

### P1-5 — Viewers still get the good parts
Read-only must not feel like a demo. Playback, search, section filters, feed,
scroll restore, resume — all fully available. `caps.can.comment` and
`caps.can.react` are true for viewers; keep those paths first-class.

### P1-6 — Capabilities can change mid-session
An owner can lock the song or change a role while someone is inside.
**Fix:** refresh capabilities on the existing realtime signal for `songs` and
`song_members`, and on tab refocus. If a capability drops while an editor is
open, let the in-flight edit finish saving, then transition to read-only — never
discard typed work.

### P1-7 — Errors map to the same vocabulary
Server refusals still happen (races). `forbidden` / `song_locked` /
`storage_full` from any write must render the *same* sentence as the pre-emptive
state. One vocabulary, no surprises.

### P2-8 — Simplicity guard
No permissions matrix UI. No "request access" flow. No per-control tooltips.
If the answer needs a legend, the design is wrong.

---

## Backend contract (live)

```ts
import { getSongRoomCapabilities } from "@/integrations/cog/room";

const caps = await getSongRoomCapabilities(songId);
// caps.role         -> "owner" | "collaborator" | "viewer"
// caps.reason       -> "view_only" | "song_locked" | "storage_full" | null
// caps.can.record_audio, caps.can.write_lyrics, caps.can.invite, ...
```

`song_room_capabilities` is membership-gated, answers only about the caller, and
folds role + song lock + owner storage headroom into one boolean map plus a
single machine-readable `reason`. It is stable and cheap — safe to refetch.

## Definition of done

1. A viewer never taps a control that then refuses them.
2. Exactly one explanation line per room, never per control.
3. Recording is impossible — not merely failing — when storage is full.
4. Ownership actions are invisible to non-owners; content actions are visibly
   disabled with reason.
5. Role or lock changes mid-session degrade gracefully without losing typed work.
6. Nothing new in settings; no new modal.
