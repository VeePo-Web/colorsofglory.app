# R3 — Songwriting Room: The Last Mile
## Resilience, motion accessibility, mobile ergonomics, and save-trust

**Owner:** Claude (frontend). Backend half of this pass is already shipped by Lovable (see §6).
**Goal of the room (unchanged):** capture an idea and see it land in the song — instantly, without ever wondering if it saved.
**Rule for this pass:** when in doubt, delete the choice. Every fix below removes a decision or a doubt.

R1 covered architecture. R2 covered feature-by-feature flow. R3 is the last mile: the things that only
show up on a real phone, on a bad connection, with a real thumb, for a real person who taps Back.

---

## 1. Resilience — P0

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1.1 | **There is no error boundary anywhere in the app.** A single render throw inside the feed (a malformed card body, a null take) white-screens the entire room and the user loses the idea they were mid-capture on. | `rg "ErrorBoundary\|componentDidCatch" src` → 0 hits | Add `<RoomErrorBoundary>` around the room outlet and a second one around `CanvasFeed`. Fallback = cream card, "This part of the room stumbled", a *Reload this section* button that resets the boundary, and — critically — a **Copy my last idea** button reading from the outbox journal. Never a blank screen. |
| 1.2 | **No offline awareness.** `navigator.onLine` is never read. Offline, writes silently enqueue and the room looks identical to a healthy room. | `rg "navigator.onLine\|offline" src` → 0 hits | One line under the room header, only when offline or when the outbox depth > 0: `Offline — 2 ideas waiting`. Gold dot, no red. Clears itself. |
| 1.3 | **No route-level loading skeleton for the room.** `src/pages/SongWorkspacePage.tsx:184` gates on `isLoading && !song` and the room paints empty. Skeletons exist (`components/shell/BrandedSkeleton.tsx`) but the room doesn't use one. | see file | Room skeleton: header block + 3 card ghosts in the feed rhythm. Reuses `BrandedSkeleton`. |
| 1.4 | **No scroll restoration.** Leaving a long feed for a memo sheet and coming back drops you at the top. | `rg "scrollRestoration\|scrollTo\(0" src` → 0 hits | Persist the feed scrollTop per song in memory (not localStorage) and restore on mount with `useLayoutEffect`. |

## 2. Motion accessibility — P0

| # | Finding | Fix |
|---|---|---|
| 2.1 | **`prefers-reduced-motion` is honoured in exactly zero places** — no CSS media query, no `useReducedMotion()` from Framer Motion. The room is one of the most animated surfaces in the product (card entrance cascade, pulse rings, weave glow, waveform). For a motion-sensitive user this is nauseating and there is no escape hatch. | 1) Global CSS block: `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; scroll-behavior:auto!important } }`. 2) Wrap the room's Framer variants in `useReducedMotion()` so entrance becomes opacity-only. 3) The record pulse ring becomes a static ring + timer. |
| 2.2 | The entrance cascade has no cap (R2 §perf) — with reduced motion it must be skipped entirely, not merely shortened. | Cascade delay `= reduce ? 0 : idx * 30`. |

## 3. Mobile ergonomics — P1

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 3.1 | **`min-h-screen` still in 20+ files** including `SongWorkspacePage`, `VoiceMemosPage`, `NotesPage`, `SongSheetPage`, `PeoplePage`. On iOS Safari the dock sits under the URL bar. | `rg -c min-h-screen src` | Global swap to `min-h-dvh`. Ban `min-h-screen` via an eslint `no-restricted-syntax` rule so it cannot come back. |
| 3.2 | **Safe-area insets applied inconsistently** — present in 10 files, absent from the room's own scroll container. | `rg "safe-area" src` | Every fixed bottom element (dock, mini-player, capture bar) gets `pb-[env(safe-area-inset-bottom)]`; the feed gets matching bottom padding so the last card is never hidden under the dock. |
| 3.3 | **iOS input zoom.** Raw `<input>`/`<textarea>` in `CardEditSheet.tsx:146,195,218,232` and `LineSuggestionSheet.tsx:233` inherit sub-16px sizing → Safari zooms the viewport on focus and never zooms back. | see files | Force `text-base` (16px) on every editable field in the room. This is non-negotiable on a mobile-first product. |
| 3.4 | **No haptics.** `navigator.vibrate` is never called, though `useVibration.ts` exists unused. Hold-to-record, card commit, and section-drop are the three moments that should be felt. | `rg "navigator.vibrate" src` → 0 | Wire `useVibration` to exactly three events: record start (10ms), save committed (10ms), destructive confirm (20-40-20). Nothing else. |
| 3.5 | **Touch targets.** Card overflow/actions triggers in `CanvasCard.tsx` render below 44px. | | Minimum 44×44 hit area via padding, not size — visual glyph can stay small. |

## 4. Save trust — P1

| # | Finding | Fix |
|---|---|---|
| 4.1 | Save narration is a string set in three places (`SongCanvasExperience.tsx:1089,1130,1287`) with no notion of *pending*. If the write is still in the outbox, the user has already been told "Saved to this song." That is the one lie the room cannot afford. | Derive the toast from real state: `queued → "Saving…"`, `flushed → "Saved to this song."`, `failed → "Still saving — it's safe on this device."` Source it from the outbox depth already shipped in `src/integrations/cog/outbox.ts`. |
| 4.2 | No visible sync state anywhere. | Single gold dot beside the song title: solid = synced, slow pulse = pending, hollow = offline. One glyph, no text, no badge counts. |

## 5. Keyboard & focus — P2

- `Escape` is handled in only 2 places inside `SongCanvasExperience.tsx` while there are nine overlay flags (R2). Every sheet closes on Escape and on backdrop tap — no exceptions.
- `useModalFocusTrap.ts` exists and is tested but is not applied to `CardEditSheet`, `CompareModeSheet`, `LineSuggestionSheet`, or `WhatChangedRecapSheet`. Apply it to all four; return focus to the invoking element on close.
- Icon-only buttons in `CanvasCard.tsx` have **zero** `aria-label`s (6 buttons, 0 labels). Label all of them.

## 6. Already shipped by Lovable (wire this up)

**`song_room_bootstrap(_song_id, _card_limit)`** — one membership-gated read returning
`{ song, my_role, last_seen_at, members[], cards[], memos[], captures[], sections[], unseen_activity_count }`.
Room entry today costs **six** sequential round trips (`qk.songDetail`, `songMembers`, `memos`, `canvas`,
`captures`, `activityDigest` in `src/hooks/useAppQueries.ts`). This collapses them into one.

SDK: `import { getSongRoomBootstrap } from "@/integrations/cog/room"`.

Wiring:
1. On room mount, call `getSongRoomBootstrap(songId)` once.
2. **Seed the cache** — `queryClient.setQueryData(qk.songDetail(id), b.song)`, same for `songMembers`,
   `memos`, `canvas`, `captures`. Every existing hook then reads warm from cache; no component changes.
3. Leave realtime invalidation exactly as it is — refetches stay granular.
4. Use `unseen_activity_count` to decide whether `CanvasRecapGate` opens at all, instead of opening
   optimistically and then discovering there was nothing to recap.

Also live from earlier passes: `canvas_upsert_card_idempotent` + the durable outbox
(`src/integrations/cog/outbox.ts`) — the source of truth for §4.

## 7. Build order

1. §2 reduced motion + §3.1/§3.3 (`min-h-dvh`, 16px inputs) — one sweep, mechanical, ship first.
2. §1.1 error boundaries + §1.2 offline line.
3. §6 bootstrap wiring + §4 save trust (they share the outbox state).
4. §1.3 skeleton, §1.4 scroll restoration.
5. §5 keyboard/focus/aria.

## 8. Definition of done

- Reduced-motion phone: room fully usable, nothing pulses.
- Airplane mode: capture an idea → line says waiting → back online → toast flips to Saved, one card, no duplicate.
- Throw an error inside a feed card in dev: room stays, one card shows the fallback.
- Room entry on a throttled 3G profile: one RPC in the network panel before first meaningful paint, not six.
- Every editable field: focus on iOS causes no zoom.
