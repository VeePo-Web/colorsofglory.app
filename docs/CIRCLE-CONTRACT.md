# Circle — the Swipe-Right Return Surface · Contract

**Owner:** the nav/return lane (`src/lib/circle/*`, `src/pages/CirclePage.tsx`,
the CaptureScene right-edge wiring). **Consumes:** the spatial nav engine
(`src/lib/nav` — `useSwipeNav`, `navDirection`), `listMySongs`,
`getActivitySince` + the recap phrase map (`humanizeActivity`),
`song_members` + profiles (one roster query), the amen device store
(`readAmenState`), `creatorColors`. **Never:** builds a feed, adds metrics,
or touches capture/canvas/lyrics surfaces beyond the header affordance.

## The geography

```
   LIBRARY   ←   CAPTURE   →   CIRCLE
   (/songs)       (/)          (/circle, absorbs /home)
   x = −1        x = 0         x = +1
```

Swipe left from Capture (or tap the mirrored **Circle ›** header chevron —
the gesture is an accelerator, the tap is the contract) and you arrive at
the hearth. Swipe right (or tap ‹ Capture) to go home. `coordFor` carries
the +1 lane so browser/hardware back animates spatially, and deep taps
(a digest line → the song's activity page) use depth ("up") with the
return sliding Circle back in from the right. The gesture stays disabled
during takes/sheets on Capture (unchanged), and CirclePage opts its bands
out of nothing — no horizontal scrollers exist there to fight.

## The hearth (what renders, and the refusals)

Bands render ONLY when real (nothing manufactured, nothing padded):
1. **"While you were away…"** — cross-song activity since your last Circle
   visit, others-only, grouped per (song · person · kind) via the SAME
   fenced vocabulary as the in-app recap (title + name + kind, never
   content), capped at 6 lines, newest first. Tap → that song's activity.
2. **"Encouragement came in"** — others' amens across your songs since the
   anchor, as warm prose (never a badge).
3. **"Your people"** — co-writers deduped across songs, contributor color +
   initials + the shared song titles. Relationships, not a follower count.
4. **Quiet week** — "All quiet since you were last here… the mic is one
   swipe away." A quiet week is a feature.
5. **Empty circle** — invite-forward warmth ("Your circle begins with one
   invitation"), CTA to Songs. Zero guilt.

**The refusals (the moat):** no streaks, no variable reward, no red badges,
no unread counts, no infinite scroll, no pagination, no ephemerality, no
presence-pressure. Finite by construction (`CIRCLE_MAX_LINES = 6`,
`CIRCLE_MAX_PEOPLE = 12`). Ignore Circle and lose nothing.

## The anchor

Per-device `cog:circle-last-visit` (same pattern as the canvas recap):
snapshotted on mount BEFORE advancing, 7-day default window on first
visit/cleared cache. A refresh mid-visit stays quiet.

## The aggregation (and the filed A3 ask)

v1 is a bounded client merge: the 8 most recently active songs ×
`getActivitySince` (parallel) + ONE `song_members` roster query across all
song ids + the per-song amen stores. Every failure collapses to an empty
band — never an error wall.

**Filed with A3/Lovable:** a `list_my_circle_since(_since timestamptz)`
RPC — one round trip returning `(song_id, song_title, kind,
actor_user_id, actor_name, event_count, last_at)` across ALL the caller's
songs, membership-gated, same allow-list as `list_song_activity_since`.
When it lands, `useCircle` swaps its per-song fan-out for the single call;
nothing else changes.

## Return-loop ethics (the research verdicts, encoded)

Stolen from Snapchat-class apps: camera-first creation (already COG's
center), swipe-to-your-people geography, a warm "what's alive" surface.
Refused: streaks-as-guilt, notification spam, slot-machine variable
reward, vanity metrics, FOMO/ephemerality. Replaced: the return magnet is
REAL and RELATIONAL — "something true happened with the songs you're
writing together." A hearth, not a casino; the person leaves better,
never worse.

## Notes

- `/home` (the old ReturningHomePage route) now renders Circle — the
  return surface IS home for a returning writer. `ReturningHomePage.tsx`
  stays on disk, orphaned, for reference.
- BottomNav is unchanged (3 tabs + raised mic); Circle is a peer surface
  reached by geography (swipe/chevron), with the mic always one tap home.
  If the nav lane later wants Circle in the dock, the route is ready.
- Reduced motion: the swipe engine already skips visual tracking and the
  entrance falls back to a fade; Circle adds no motion of its own.
