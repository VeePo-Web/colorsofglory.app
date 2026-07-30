# R32 — The feed is a door, not a diary

**Goal:** the writer opens the song, glances at the feed, and taps straight to the
thing that changed. Every row is a door. No row is a dead end.

## What was wrong

The feed rendered raw event rows: `card_moved · 3f2a…`. To show a name it fetched a
profile, to show a section label it fetched a section — an N+1 waterfall on the one
screen that must feel instant. And nothing was tappable, so "Sarah edited Verse 2"
made you go find Verse 2 yourself.

## Backend (done — Lovable)

- `song_feed(_song_id, _limit, _before)` — one request returns fully-resolved rows:
  actor name + avatar colour, a short human label for the entity, `is_unseen`,
  `is_you`, and a `target { view, id }`. Membership-gated, SECURITY DEFINER,
  labels only (never lyric or audio content).
- Consecutive same-kind events by the same person within **10 minutes** collapse into
  one row with `event_count`. Six card moves read as `moved 6 cards`, not six lines.
- Cursor pagination via `_before`; `has_more` tells you whether to keep going.
- SDK: `src/integrations/cog/feed.ts` — `fetchSongFeed`, `feedRowHref`, `unseenCount`.

## UI to build (Claude)

### 1. The row
One line, one tap. `{avatar dot} {Name} {verb phrase} {label} · {relative time}`.
- Avatar is a 24px circle filled with `avatar_color`, initial in cream. No photos in
  the feed — colour is faster to read than a face.
- `is_you` rows use "You" and drop the avatar to a plain gold dot.
- `event_count > 1` appends `· 6` in muted warm-gray. Never "×6", never a badge.
- Unseen rows carry a 2px gold bar on the left edge that fades out on next visit.
  No red dots, no counts in the tab bar — calm is a product rule.

### 2. The verbs
Map `kind` → one short past-tense phrase, sentence case, never jargon:
`take_committed` → *added a take*, `card_moved` → *moved*, `card_promoted_final` →
*moved into the song*, `invite_accepted` → *joined*, `memo_transcribed` →
*turned a hum into words*. If a kind has no mapping, render *made a change* — never
the raw enum.

### 3. The tap
`feedRowHref` gives the destination. Navigating must land **on the thing**: the sheet
scrolls the section into view and pulses its label gold for 600ms; the canvas pans and
selects the card; the takes drawer opens with that take expanded. A row that can't
resolve a target renders as plain text with no press state — never a tappable row that
goes nowhere.

### 4. Grouping in time
Section the list with quiet serif dividers: `Today`, `Yesterday`, `Earlier this week`,
then month names. No date on every row — relative time only (`4m`, `2h`, `Tue`).

### 5. Seen state
Call `markSongSeen` once, on unmount or after 2s of the feed being visible — not on
mount. The writer must actually see the gold bars before they clear.

### 6. Performance
- Key `['feed', songId]`, `staleTime: 20s`, `placeholderData: keepPreviousData`.
- Realtime insert on `song_activity` → invalidate, don't refetch on every keystroke.
- Infinite scroll uses `before = last row's created_at`. Page size 40.
- Empty state: one serif line, *Nothing has changed since you started.* plus the
  three first-action chips from the canvas prompt. Never a spinner, never a shrug icon.

## Rules
- Never show raw lyric lines, memo audio, or entity IDs in the feed.
- Never surface a notification count anywhere in the room chrome.
- If a row would need a second request to render, it doesn't ship.

## Done when
Every row names a person, names the thing, and opens it in one tap — and the whole
feed paints from one request in under 100ms on a second visit.
