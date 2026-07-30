# R9 — The Room Remembers You (Songwriting Room + Feed Audit, round 9)

Owner: Claude (frontend). Backend for this round is already shipped by Lovable.
Goal of the room, unchanged: **everything for this song stays connected here** — and
returning to it should feel like walking back into a room you never really left.

## The one sentence

Today the room forgets you the moment you leave: view resets, scroll resets, the take
you were 40 seconds into restarts at zero, filters clear, and "what's new" is a guess.
Every return costs re-orientation. R9 makes return free.

---

## Findings

### P0-1 — Return amnesia
Leaving the room and coming back drops the person on the default view with default
filters. For a songwriter who bounces between the room and a lyric sheet twenty times
a session, that is twenty small re-orientations.
**Fix:** on mount, call `getSongRoomResume(songId)` in parallel with bootstrap and
restore `last_view` + `filter_state` before first paint. No spinner for this — apply
it to the cached paint.

### P0-2 — Playback restarts from zero
A 4-minute take you were mid-way through restarts on return.
**Fix:** restore `playback_ms` on the `last_take_id` as a *seek offset only* — never
auto-play. Show it as a subtle progress fill on that take's row plus a single
"Resume at 1:12" affordance. Auto-play on return is a violation of the calm rule.

### P0-3 — "What's new" is unquantified
The feed shows everything with no boundary between "seen" and "since you left".
`song_room_resume` returns `unseen_count` and `last_seen_at`.
**Fix:** render one **"New since you left"** divider line in the feed at
`last_seen_at`, and nothing else. No red badge, no count bubble — a hairline rule with
a small warm-gray label. Mark seen via the existing `mark_song_seen` only after the
divider has been on screen for 2s (IntersectionObserver), so a glance doesn't erase it.

### P1-4 — State writes must be invisible
Naively saving on every scroll/tick will hammer the network.
**Fix:** debounce `saveSongRoomState` — 1000ms idle for view/card/filter changes,
5000ms while audio plays, plus a forced flush on `visibilitychange:hidden` and
`pagehide`. Use `keepalive`-style fire-and-forget; never block navigation, never
surface an error toast for a failed state save.

### P1-5 — Restoration must not fight the user
If someone deep-links to a specific card, resume must lose.
**Fix:** precedence is `URL params > resume state > defaults`. Restore once per mount,
guarded by a ref — never re-apply after the first paint.

### P1-6 — Stale pointers
`last_card_id`/`last_take_id` can point at an archived or deleted row (R7 soft-delete).
**Fix:** validate against the bootstrap payload before scrolling to it. If missing,
fall back to top of the restored view silently. Never show "that card is gone".

### P2-7 — Cross-device consistency
Room state is server-side, so phone → laptop carries over. That is a feature; make it
truthful. When the restored state was written more than 24h ago, restore the view and
filters but **not** the playback offset — a day-old scrub position is noise.

### P2-8 — Simplicity guard
Do not add a settings toggle for any of this. Do not add a "restore session?" prompt.
It either works invisibly or it is not shipped.

---

## Backend contract (already live)

```ts
import { getSongRoomResume, saveSongRoomState } from "@/integrations/cog/room";

const { state, last_seen_at, unseen_count, server_time } = await getSongRoomResume(songId);
// state: { last_view, last_card_id, last_take_id, playback_ms, filter_state } | null

await saveSongRoomState(songId, {
  last_view: "feed",
  last_card_id: cardId,
  last_take_id: takeId,
  playback_ms: 72_000,
  filter_state: { section: "chorus", tree: "ideas" },
});
```

- Storage: `public.song_room_state`, one row per person per song, RLS-scoped to
  `auth.uid()` **and** song membership. Partial patches only — omitted fields keep
  their stored value.
- `song_room_resume` also returns `unseen_count`, counting only activity by *other*
  people since `last_seen_at`, and `server_time` for clock-skew-free comparisons.

## Definition of done

1. Leave the room mid-take, return: same view, same filters, same scroll region, take
   shows a resume offset and does not auto-play.
2. Feed shows exactly one "New since you left" divider, which clears calmly.
3. No visible network cost: state saves never block, never toast, never spin.
4. Deep links beat resume. Archived pointers degrade silently.
5. Nothing new appears in settings.
