# R11 — The Feed That Doesn't Shout (Songwriting Room + Feed Audit, round 11)

Owner: Claude (frontend). Backend shipped by Lovable this round.
Goal of the room, unchanged: **everything for this song stays connected here.**
R11 is about the feed's *meaning* — one row per human intention, not one row per
database write.

## The one sentence

The feed currently renders raw events, so a collaborator who uploads six takes
in two minutes buries the one lyric change that actually mattered — the feed
reports work instead of communicating it.

---

## Findings

### P0-1 — Burst flooding
Six memos → six rows. Fifteen card moves during one arrangement pass → fifteen
rows. The signal-to-length ratio collapses exactly when the song is most active.
**Fix:** render from `getGroupedFeed(songId)`. Same actor + same kind inside a
10-minute window arrives pre-collapsed with an `item_count`. Line reads
"Sarah added 4 voice memos · 2:14pm". Tap expands to the individual items using
the returned `entity_ids` — no second network call for the common case.

### P0-2 — Self-noise
Your own actions echo back at you through realtime and pad the feed with things
you just did.
**Fix:** entries carry `is_self`. Collapse self-entries harder — render them at
reduced emphasis, and never let a self-entry trigger the "new since you left"
divider or any arrival animation.

### P0-3 — Mechanical verbs
`card.moved`, `take.created` are database vocabulary.
**Fix:** one copy map from `kind` + `entity_type` + `item_count` to a human
sentence, with singular/plural handled once. Never interpolate raw kind strings.
Movement/reorder events are the lowest-value class in the feed — collapse an
entire arrangement pass to a single "Parker rearranged the song."

### P1-4 — No time structure
A flat list of timestamps forces the reader to compute recency.
**Fix:** day headers only (Today / Yesterday / date). Inside a day, relative
times. No hour buckets, no "3 minutes ago" tickers re-rendering every minute —
compute once on paint and on tab refocus.

### P1-5 — Arrival must be calm
Realtime inserts that jump the list break reading.
**Fix:** when new entries arrive and the user is not at the top, do **not**
splice them in. Show one quiet "New activity" pill; tap scrolls to top and
merges. At the top, merge directly with a soft fade — no slide, no highlight
flash, and nothing at all under reduced motion.

### P1-6 — Paging
`song_feed_grouped` pages backwards via `before` = the oldest `last_at` you hold.
**Fix:** infinite scroll with a 30-entry page, prefetch at 70% depth, exact-height
skeletons so nothing shifts. No "Load more" button.

### P1-7 — Empty and quiet states
A solo songwriter's feed is legitimately empty; that must read as peace, not
failure.
**Fix:** one warm serif line ("Everything you do here will show up in this
feed.") — no illustration, no CTA.

### P2-8 — Simplicity guard
No filters, no per-kind toggles, no unread counts per type, no @mentions in this
round. One list, one grouping rule, one copy map.

---

## Backend contract (live)

```ts
import { getGroupedFeed } from "@/integrations/cog/activity";

const { entries, server_time } = await getGroupedFeed(songId);
// entry: { actor_name, actor_avatar, actor_color, kind, entity_type,
//          item_count, first_at, last_at, entity_ids[], activity_ids[], is_self }

// older page:
await getGroupedFeed(songId, entries.at(-1)!.last_at);
```

`song_feed_grouped` is membership-gated, joins the actor profile server-side (so
the feed needs no second lookup for names/avatars), caps at 100 per page, and
returns `server_time` for skew-free relative timestamps.

## Definition of done

1. A six-take upload burst is one line with a count, expandable on tap.
2. An arrangement pass is one line, not fifteen.
3. No feed row uses database vocabulary.
4. Nothing splices under the reader's eyes; day headers give structure.
5. Names and avatars render on first paint with no extra request.
6. The empty feed feels intentional.
