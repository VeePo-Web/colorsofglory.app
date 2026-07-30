# R5 — Songwriting Room: Live Without Cost, Findable Without Thought
## Realtime economics, the growing song, and the collaborator's sense of presence

**Owner:** Claude (frontend). Backend half shipped this pass (§5).
**Goal of the room (unchanged):** capture an idea and hear it back inside the song — instantly.
**Rule:** if a thing can be one thing, it is one thing.

R1 architecture → R2 feature-by-feature → R3 last mile → R4 audio/latency → **R5 is about what
happens when the room is *shared* and when the song gets *long*.** Both are success states. Both
currently degrade.

---

## 1. Every realtime event triggers a full-song refetch — P0

`SongCanvasExperience.tsx:998-1019`:

```ts
const schedule = () => { ...debounce 600ms... void hydrateVoiceMemos(); };
subscribeSongRoom(songId, {
  onActivity: schedule, onCardChange: schedule,
  onTakeChange: schedule, onCaptureChange: schedule,
});
```

`hydrateVoiceMemos` → `hydrateBoard(songId)` → **every card + every voice memo + every capture +
every suggestion**, then a full reconcile pass over the whole array (`:918-991`).

The 600ms debounce was the right first fix and the reconcile itself is genuinely careful — dirty-card
grace windows, tombstones, source-aware pruning, identity resolution, byte-identical bailouts. The
remaining defect isn't correctness, it's **economics**:

> Three co-writers editing → each keystroke-batch is a `canvas_cards` UPDATE → every device refetches
> the entire song, ~every 600ms, forever. Cost scales **O(song size × collaborators × edit rate)**.
> The room gets *slower the more successful the session is*.

And the payload that woke us up already told us which row changed — we throw it away.

**Fix — shipped backend-side this pass (§5):**

```ts
import { getSongRoomDelta } from "@/integrations/cog/room";
const d = await getSongRoomDelta(songId, sinceRef.current);
sinceRef.current = d.server_time;           // server clock, never Date.now()
applyRows(d.cards, d.memos, d.takes, d.captures);
if (d.truncated) await fullBootstrap();     // paged out — re-sync properly
```

Rules for the wiring:
- `since` is **always** the server's `server_time` from the previous response. Client clocks skew;
  a fast client clock silently drops rows forever.
- Full `getSongRoomBootstrap` on: mount, `truncated`, channel `SUBSCRIBED` after a disconnect, and
  tab refocus after >5 min. Delta for everything else.
- Reuse the existing reconcile (dirty grace, tombstones) — feed it the delta rows instead of the
  full set. Do **not** prune on a delta; absence means "unchanged", not "deleted". Deletions come
  from the realtime DELETE payload or the next full sync.
- Keep the 600ms debounce. Delta + debounce is the cheap combination.

Same-shape follow-up: `writeBoard(songId, cards)` still fires on **every** `cards` change
(`:880-882`) — a synchronous full-board `JSON.stringify` per keystroke. R2 flagged it; still open.
Debounce 600ms and share the timer with the delta scheduler.

## 2. Realtime has no connection state, so the room silently lies — P0

`subscribeSongRoom` exposes callbacks only — no `SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` status,
no reconnect hook. `rg "CHANNEL_ERROR|SUBSCRIBED" src` → **0 hits outside tests.**

Consequences on a phone in a church basement:
- Wi-Fi drops → the channel dies → **no error, no retry, no indicator**. The room looks live and is
  frozen. You keep writing; your co-writer's work is invisible; theirs of yours too.
- On reconnect nothing re-syncs, because nothing knows a disconnect happened.

**Fix:** surface channel status from `subscribeSongRoom` (`onStatus`), and on the transition
`error/closed → SUBSCRIBED` run one full bootstrap. Pair it with a single quiet room-level chip —
`Live` / `Reconnecting…` / `Offline · N saved here` — that also reads the R1 outbox depth. One
indicator, three states, no modal. That chip is the entire UI budget for sync.

## 3. Presence is computed but almost invisible — P1

`useSongPresence` is wired (`:1787`) and correct — ID-hashed color, initials, self-filtered. It feeds
a **count** (`othersHereNow`) and dots in the *invite sheet*. The feed itself
(`CanvasFeed.tsx`) has **zero** presence references.

So the highest-value emotional signal in a collaboration app — *someone is in this song with me right
now* — is spent on a number in a sheet the user rarely opens.

**Fix (small, high payoff):**
- A persistent stack of 2-3 presence avatars in the room header. Tap → the people sheet.
- When a card arrives over realtime from a present collaborator, its entrance uses **their** hue
  (identity color already exists) rather than the generic cascade. You *see who* wrote it appear.
- That is the whole feature. No cursors, no typing indicators — those complicate; presence dots and a
  colored arrival do the emotional job.

## 4. A long song has no way to find anything — P1

`rg "search|filter" src/components/canvas/feed/*.tsx` → **0 hits.**

The catalog is designed for growth from one song to many (Product Vision 12), but the *song* has no
equivalent. At 60+ cards — a normal finished worship song with takes, alternates and scripture — the
only retrieval mechanism is scrolling. The room's promise is "everything stays connected here";
connected content you can't retrieve is just a longer pile.

**Fix — one control, not a search page:**
- A single find field in the room header that filters the feed live across card title, body, section
  label, and contributor name. Substring, case-insensitive, no ranking, no modal, no results screen —
  the feed just narrows. Clear on Escape.
- Section chips (already needed from R2's free-text fragmentation fix) become the second axis: tap
  "Chorus" → feed narrows. Find + chips covers every real retrieval need.
- Do **not** build saved searches, tags, or advanced filters. Simple.

## 5. Shipped this pass by Lovable

**`song_room_delta(_song_id, _since, _limit)` RPC** — membership-gated `SECURITY DEFINER` read
returning only rows with `updated_at > since` across `canvas_cards`, `voice_memos`, `takes`,
`idea_captures`, `song_activity`, plus `server_time` (use as the next cursor) and `truncated`.
Backed by four new `(song_id, updated_at)` indexes, so the delta is an index range scan regardless of
song size.

```ts
import { getSongRoomDelta } from "@/integrations/cog/room";
```

With R3's `song_room_bootstrap` and R4's `song-playback-urls`, the room's full data contract is now:
**one read on entry, one signing call on entry, one small delta per change burst.** Nothing else
should hit the network during a writing session.

## 6. Build order

1. §1 delta wiring + debounce `writeBoard` — the cost curve, fixed.
2. §2 channel status + reconnect bootstrap + the one sync chip — the silent-freeze bug.
3. §4 find field — retrieval.
4. §3 presence avatars + colored arrival — the feeling.

## 7. Definition of done

- Three devices in one room, one editing continuously: network panel on the idle devices shows small
  delta reads, not full board reads. Payload size flat as the song grows.
- Airplane mode for 30s then back: the chip goes `Offline → Reconnecting → Live`, and the co-writer's
  work that landed during the gap is on screen within a second of reconnect — no reload.
- 60-card song: typing three letters in find narrows the feed in one frame.
- A card written by someone else arrives wearing their color, and their avatar is in the header.
