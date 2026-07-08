# ACTIVITY CONTRACT — E2 · Calm Activity Intelligence
**Published by:** E2 (Activity Feed Agent) · **Consumed by:** D3 (`WhatChangedRecapSheet`), and any surface that needs plain-English event language.
**Last updated:** 2026-07-07

---

## 1. The law: activity is IDs + event kinds only

Activity payloads never carry raw lyric or memo content, and nothing that renders
activity may reach into `payload` for display text. Every rendered sentence is built
from **kind + actor display name + count** — nothing else. The single source of that
language is:

```
src/components/activity/activityCopy.ts
```

D3's recap sheet must import from this module instead of keeping its own
`DEMO_ITEMS` copy. Do not fork the map.

## 2. The copy map API

```ts
import {
  ACTIVITY_KIND_COPY,   // Record<SongActivityKind, ActivityKindCopy> — compiler-checked exhaustive
  FALLBACK_KIND_COPY,   // calm fallback for kinds newer than this build
  copyForKind,          // (kind: string) => ActivityKindCopy  (never throws)
  activitySentence,     // (kind, actorName | null, count = 1) => string  (null actor → "Someone")
  activityHref,         // (songId, kind) => deep-link into the song surface that changed
  UNKNOWN_ACTOR,        // "Someone"
} from "@/components/activity/activityCopy";

interface ActivityKindCopy {
  icon: LucideIcon;                              // fitting, gentle icon
  sentence: (actor: string, count: number) => string;
  sub: string;                                   // quiet second line, content-free
  surface: "voice" | "people" | "canvas" | "room";
}
```

### The 16 kinds → calm sentences (count-aware)

| kind | single (n=1) | grouped (n=3) | surface |
|---|---|---|---|
| `take_committed` | Sarah recorded a new take | Sarah recorded 3 new takes | voice |
| `capture_created` | Sarah captured an idea | Sarah captured 3 ideas | canvas |
| `capture_promoted` | Sarah shaped an idea into the song | Sarah shaped 3 ideas into the song | canvas |
| `memo_uploaded` | Sarah added a voice memo | Sarah added 3 voice memos | voice |
| `memo_finalized` | Sarah finished a voice memo | Sarah finished 3 voice memos | voice |
| `memo_transcribed` | A voice memo of Sarah's was written into words | 3 of Sarah's voice memos were written into words | voice |
| `invite_accepted` | Sarah joined the song | (same) | people |
| `member_left` | Sarah left the song | (same) | people |
| `owner_transferred` | Sarah passed the song to a new owner | (same) | people |
| `card_moved` | Sarah rearranged an idea on the canvas | Sarah rearranged ideas on the canvas | canvas |
| `card_linked` | Sarah connected two ideas | Sarah connected ideas together | canvas |
| `card_unlinked` | Sarah separated two ideas | Sarah separated some ideas | canvas |
| `card_grouped` | Sarah gathered ideas into a group | Sarah gathered ideas into groups | canvas |
| `card_section_set` | Sarah placed an idea in a section | Sarah placed 3 ideas in sections | canvas |
| `card_promoted_final` | Sarah moved an idea into the final song | Sarah moved 3 ideas into the final song | canvas |
| `card_deleted` | Sarah tidied away an idea | Sarah tidied away 3 ideas | canvas |

Unknown kind → `Sarah made a change` / `Sarah made N changes` (surface `room`).
Unknown actor → `Someone …`.

`activityHref` resolves: voice → `/songs/:id/voice`, people → `/songs/:id/people`,
canvas → `/songs/:id/canvas`, room → `/songs/:id/room`.

## 3. Data shapes (owned by A3 — consume, don't fork)

```ts
// src/integrations/cog/songs.ts — one event
type SongActivityRow = {
  id: string; created_at: string;
  action: string;            // ← the kind string lives in `action`
  entity_type: string; entity_id: string | null;
  actor_user_id: string | null; actor_name: string | null; actor_color: string | null;
  payload: Record<string, unknown>;   // NEVER rendered
};

// src/integrations/cog/activity.ts — one server-grouped digest row
type ActivityDigestRow = {
  kind: SongActivityKind;
  actor_user_id: string | null;
  event_count: number;        // authoritative group count
  last_at: string;
  sample_entity_ids: string[] | null;   // up to 5, for deep-link targeting
};
```

RPCs: `getSongActivity` / `getRecentActivity` (rows), `listActivitySince` (digest),
`markSongSeen` (baseline write), `getRecapDigest` (AI paragraph), realtime via
`subscribeSongRoom({ onActivity })`.

## 4. "Since you left" semantics (what D3 can rely on)

- **Read-then-mark, always.** The prior `last_seen_at` is read (via
  `getNotificationPrefs(songId).last_seen_at`) **before** `markSongSeen(songId)`
  runs. Marking first would zero the delta. If the read fails, treat as first
  visit but still mark — so the *next* visit has a baseline.
- The baseline is **pinned for the visit** (staleTime: Infinity): realtime
  arrivals fold under "Since you left" without the divider jumping.
- On unmount the song is marked seen once more, so events watched arriving live
  don't reappear as "new" next visit.
- **First visit (no baseline):** no split; everything renders under one calm
  "Recent activity" section.
- **Grouping:** the since-section uses the server digest (`event_count` — the
  client never re-counts); "Earlier" folds rows client-side with the same rule
  (same actor + kind within a 60-minute window; `groupRows` in
  `src/components/activity/useActivityFeed.ts`, exported and unit-tested).
- **Recap:** requested only when a baseline exists and the delta has ≥ 3 events;
  failures resolve to `null` silently — cards never wait on the recap, no error
  UI ever shows.

## 5. Calm rules (Product Vision 08 — binding on all consumers)

- No red badge counts, no unread dots, no toasts for activity, ever.
- Realtime arrivals enter softly (list `aria-live="polite"`; entrance animation
  disabled under `prefers-reduced-motion`).
- Actor color is never the only signal — always paired with name/initials.
  DB actor colors are hex (tint with an alpha suffix); the neutral fallback is
  `var(--cog-muted)` (guarded by the design-drift test — no raw brand hex).
- Activity cards **link** to the surface that changed; they never act
  (no restore — E3; no review accept/decline — D-group).

## 6. Role gating

Owner-only items (the "N ideas are waiting for your review" rollup) gate on
`getSong(songId).my_role === "owner"` (A3's membership-derived role).
**E1 dependency:** when E1 ships `useCapabilities`, swap this check for the
capability hook — the gate is intentionally one expression in `ActivityPage.tsx`.

## 7. Filed with other lanes

- **A3:** add `last_seen_at` to the declared `SongNotificationPrefs` type (the
  column exists and `select("*")` already returns it; E2 currently reads it via a
  narrowing cast). A dedicated `getSongSeen(songId)` read would also be welcome.
- **E1:** `useCapabilities` (see §6) — E2 will adopt it on arrival.
- **A5:** the `/songs/:id/activity` un-redirect is landed in `src/App.tsx`
  (RequireAuth-guarded, lazy `ActivityPage`). It was first landed in
  `src/routes/songRoutes.tsx`, but that route-module refactor was rolled back
  by a parallel session — if the modular routes return, carry this line over.
- **D3:** replace `DEMO_ITEMS` in `WhatChangedRecapSheet` with `listActivitySince`
  + this module's `activitySentence`/`copyForKind`.
