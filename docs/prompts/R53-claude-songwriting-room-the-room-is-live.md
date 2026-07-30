# R53 — "If someone else is in the room, you can see it happen"

## The audit (stress test, two devices, one song)

Phone A (owner) and Phone B (contributor) in the same song. What actually happened before this round:

| Action on B | What A saw | Verdict |
|---|---|---|
| Records a take | appears | pass |
| Moves a canvas card | appears | pass |
| **Suggests a line** | **nothing, ever** | fail — `lyric_suggestions` was not published |
| **Leaves a note / replies** | **nothing until tab change** | fail — `song_notes` not on the room channel |
| **Taps amen** | **nothing** | fail — `card_reactions` not on the room channel |
| Deletes a suggestion | nothing | fail — no `REPLICA IDENTITY FULL`, so the filtered DELETE never matched |
| Opens 4 tabs | 3 websocket channels + a random-suffix tempo channel each | fail — socket churn, duplicate refetch storms |

The three broken rows are exactly the three that make the room feel inhabited. Everything else was already live, which is why this was invisible: the room looked "realtime" and quietly wasn't, precisely where a second human matters.

## Reference standard

Figma: a remote change lands as a change, not a notification. Linear: one socket, batched patch, no spinner. Notion: comments appear in place. None of them ask you to refresh, and none of them announce it.

## Backend, shipped

1. Migration — `lyric_suggestions`, `song_notes`, `card_reactions` added to the realtime publication, all three set to `REPLICA IDENTITY FULL` so DELETE events still carry `song_id` and pass the filter.
2. `src/integrations/cog/live.ts` → `subscribeRoomChanges(songId, onChange)`
   - ONE channel topic `room:{songId}` per song, **refcounted** — N components, 1 subscription.
   - Covers activity, cards, takes, captures, suggestions, notes, reactions, members, lyrics, sections, songs.
   - **Coalesced 120 ms**: a burst (accept suggestion → lyric + activity + reaction) fires one batched callback.
   - Payloads ignored. The channel says which slice changed; React Query owns the truth.

## Frontend work (Claude)

### 1. Replace the three subscriptions with one

In `src/hooks/useRealtime.ts`, rewrite `useRealtimeSong` to a single effect:

```ts
useEffect(() => {
  if (!songId) return;
  return subscribeRoomChanges(songId, (kinds) => {
    const keys = new Set<string>();
    const add = (k: QueryKey) => keys.add(JSON.stringify(k));
    for (const kind of kinds) {
      if (kind === "activity")    { add(qk.activity(songId)); add(qk.feed(songId)); }
      if (kind === "cards")       add(qk.canvas(songId));
      if (kind === "takes")       add(qk.memos(songId));
      if (kind === "captures")    add(qk.captures(songId));
      if (kind === "suggestions") { add(qk.anchors(songId)); add(qk.nextMove(songId)); }
      if (kind === "notes")       add(qk.anchors(songId));
      if (kind === "reactions")   add(qk.reactions(songId));
      if (kind === "members")     add(qk.cast(songId));
      if (kind === "lyrics" || kind === "sections") add(qk.songDetail(songId));
      if (kind === "song")        add(qk.songDetail(songId));
    }
    add(qk.nextMove(songId)); // the room's one next move re-derives on any change
    for (const k of keys) void qc.invalidateQueries({ queryKey: JSON.parse(k) });
  });
}, [songId, qc]);
```

Delete `useRealtimeMemos` and the separate tempo subscription usage inside the room — both are now covered. Keep `subscribeSongTempo` only if a surface outside a song room uses it.

### 2. Land changes silently, in place

- **No toasts** for remote changes. Ever. A remote take appearing in the list IS the notification.
- **No spinners** on realtime-driven refetch: these queries keep `placeholderData: keepPreviousData`, so the list never blanks.
- **No badge counts.** If something new arrived while you were on another tab, the R51 next-move strip already says so in a sentence.

### 3. The one visible tell: arrival

When a remote item enters a list (take, suggestion pin, note, reaction), animate it in — 400 ms, `translateY(8px) → 0`, `opacity 0 → 1`, `--cog-ease-reveal`, with the author's R52 colour on the left edge fading from 100% → 30% over 2 s. That fade is the entire "someone was here" language. Nothing else.

Respect `prefers-reduced-motion`: opacity only.

### 4. Optimistic first, channel second

Every local mutation writes to the cache immediately (R51 law 3). When the echo of your own change arrives on the channel, the invalidation refetches and reconciles — the user must never see their own item flicker, move or duplicate. Verify: react to your own note; the pin must not blink.

### 5. Reconnect

On `visibilitychange → visible` and on socket `SUBSCRIBED` after a drop, invalidate `qk.roomBootstrap(songId)` once. Coming back from a locked phone shows the current room, not the one from an hour ago. No "reconnecting…" banner — just correct content.

## Removals (trim the fat)

1. Delete `useRealtimeMemos` (folded in).
2. Delete any per-tab realtime subscription in canvas/lyrics/notes components.
3. Delete every "updated just now" / "syncing" indicator.
4. Delete remote-change toasts.
5. Delete the random-suffix tempo channel usage inside the room.

## Acceptance

- Two devices: suggestion, note, reply, amen, delete — each appears on the other within ~1 s, with no refresh and no toast.
- DevTools → WS: exactly **one** postgres_changes channel per open song, regardless of tab count.
- A remote accept-suggestion burst triggers **one** render pass, not four.
- Your own actions never flicker when their echo returns.
- Lock the phone for five minutes, unlock: the room is current, with no banner.

## Why this matters to the one goal

The room's promise is *everything for this song stays connected here*. Connected means the second person is real-time real. R51 gave the room a next move, R52 gave it a who and a where — R53 makes those two things update the instant they become true, over one socket, silently.