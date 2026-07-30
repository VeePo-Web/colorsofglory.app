# R50 — CLAUDE: "The room opens at once"

## The audit finding

Opening a song used to be one request (`song_room_bootstrap`). Since then the
room grew: the feed strip, waiting invitations, open line suggestions, unfiled
recordings, and card reactions each fetch themselves after mount. On a phone on
church wifi that means the room paints, then twitches five more times — spinner
dots, numbers appearing late, reaction pills popping in under the writer's
thumb. Nothing is broken; the room just feels assembled instead of opened.

**The one goal:** the writer taps a song and the room is *there* — complete,
still, and instantly usable.

## What backend now gives you

`song_room_bootstrap(_song_id, _card_limit)` returns the same object plus:

| Key | Meaning |
|---|---|
| `feed_preview` | The 5 newest activity rows: `kind`, `entity_type`, `entity_id`, `created_at`, `is_you`, `is_unseen`, `actor { name, avatar_url, avatar_color }` |
| `pending_invite_count` | Invitations still waiting (R48) |
| `open_suggestion_count` | Line suggestions still open |
| `unfiled_memo_count` | Recordings with no part yet (R44) |
| `reactions` | `{ card_id, kind, count, mine }` for every reacted card |

SDK: `src/integrations/cog/room.ts`
- `getSongRoomBootstrap(songId)` — unchanged call, richer payload
- `reactionIndex(rows)` — Map keyed by card id, built once per payload
- `roomWaitingLine(bootstrap)` — the single quiet line, or `null`

## Build

1. **One fetch on entry.** The room's mount does exactly one network call.
   Delete/disable the on-mount fetches for feed preview, pending invites,
   suggestion count, unfiled count, and reactions — seed their query caches from
   the bootstrap payload instead (`queryClient.setQueryData`) so the existing
   hooks keep working for refreshes and realtime invalidation.
2. **Reactions render from the index.** Build `reactionIndex` once per payload
   (memo on the payload reference) and read it while mapping cards. No per-card
   fetch, no per-card state.
3. **Feed strip.** The room header's feed strip renders `feed_preview` directly
   — real names, real avatar colours, `is_unseen` as a soft gold dot only. Full
   feed still loads lazily when the writer opens it.
4. **One waiting line.** Under the header, render `roomWaitingLine(...)` in
   warm-gray at `--t-label`. If it's `null`, render nothing — no empty row, no
   reserved space that collapses.
5. **No layout shift.** Because everything arrives together, the room must paint
   once. Verify: no element moves after first paint on a throttled 3G profile.

## Do not

- Add a second "room summary" request. If something new needs to be there on
  open, it goes in the bootstrap payload, not a new call.
- Show counts as badges, pills, or anything red. One sentence, warm-gray.
- Skeleton every panel. One calm cream shell, then the whole room.

## Done when

`tsc` 0 · build ok · tests green · DevTools network on room entry shows **one**
RPC · no visible shift after first paint · counts and reactions correct without
any follow-up request · the waiting line disappears entirely when there's
nothing waiting.