# Amens — Canvas Encouragement Layer · Contract

**Owner:** D3 (`src/lib/canvas/collab/amens.ts` logic, `useAmens.ts` hook,
`src/components/canvas/AmenChip.tsx`, the `src/integrations/cog/reactions.ts`
seam). **Mounted by:** the canvas host via D1's documented `cardAdornment`
slot (`CanvasStage` → `CanvasCard` → rendered after the face, in normal flow).
**Consumes:** `creatorColors` (`getCreatorColor`/`getCreatorInitials`), the
host's `identityByUserId` roster for names, E2's recap digest
(`recapDigest.ts` kind→copy + `useCanvasRecap` extraEvents). **Never:** adds
song content, promotes/decides an idea, renders a red badge, forks the
recorder or the activity feed.

**What it is:** a one-tap warm affirmation on any canvas idea card — "Amen"
(plus heart ♥ and keeper ✦). It says *"yes — this one, I'm with you"* so a
shy contributor's hum feels seen, feedback lives in the room instead of
iMessage, and the owner gets a calm read on what resonates. It creates
NOTHING about the song; worst case, ignore every amen and nothing is lost.

## The schema ask (A3 / Lovable — file, don't build)

```sql
create table card_reactions (
  id          uuid primary key default gen_random_uuid(),
  song_id     uuid not null references songs(id) on delete cascade,
  card_id     text not null,             -- canvas card id (cascade-clean with the card if/when FK'd)
  user_id     uuid not null default auth.uid(),
  kind        text not null check (kind in ('amen','heart','keeper')),
  note_text   text,                      -- short encouragement (UI ships next slice)
  note_voice_url text,                   -- 5-sec voice amen (needs a storage path decision)
  created_at  timestamptz not null default now(),
  unique (card_id, user_id, kind)
);
-- RLS: any member of the song may INSERT/DELETE their OWN rows; all members SELECT.
-- Realtime: add card_reactions to the publication (the client already listens).
```

Until this lands, the entire feature runs **device-local** — the seam's probe
(`probeReactionsTable`) detects the missing table once per session and every
server call degrades to a clean no-op. Nothing errors, nothing blocks, and
the moment the table deploys, the same client code syncs + goes live with no
frontend change.

## The offline-first model (`amens.ts` — pure, unit-tested)

- **Server rows are the truth for everyone else; this device's op queue is
  the truth for mine.** `applyToggle` is synchronous/optimistic; an unsynced
  add + a second tap annihilate (no tombstones); a server-backed amen gains a
  pending remove that hides it instantly.
- The flusher (`useAmens`) replays the queue in order, stops at the first
  failure, and retries on `online` + every 30 s. `mergeServerRows` completes
  ops the server already reflects (multi-device safe). State persists to
  `cog:amens-<songId>` so offline reloads keep the warmth.
- Demo rooms (`songId === "demo"`) and signed-out sessions use a stable
  device actor id (`cog:device-actor-id`) and never touch the network.

## The seam (`cog/reactions.ts`)

`probeReactionsTable` (session-cached for definitive answers only — transient
network failures retry) · `listCardReactions` · `addCardReaction` ·
`removeCardReaction` · `subscribeCardReactions` — realtime on a **dedicated
channel**, subscribed only after the probe confirms the table, so a missing
table's CHANNEL_ERROR can never take down the shared song-room channel.
Every function returns a safe empty/null/false instead of throwing.

## The UX (calm by construction)

- **Unselected card with amens:** a small display cluster — up to 3
  contributor-colored initial dots (newest first, deduped) + a quiet `+N` +
  the serif word *amen* (gold when yours). `role="img"` with a full
  "Sarah and 2 more said amen" label. **Not interactive** — on a drag/pan/
  zoom canvas a hot target on every card is a mis-tap hazard; actions follow
  the card grammar (selection reveals them), like compare/merge/edit.
- **Selected card:** the warm action row — **Amen** (serif, flex-1) ·
  heart · keeper — 44 px targets (the canvas-zoom minimum), gold
  `aria-pressed` state, one tap on = one tap off, plus a small "who" line.
- Appearance is **opacity-only** (`cog-amen-in`, 400 ms) — reduced-motion
  compliant by construction; no bounce, no scale, no red anywhere, no badge,
  no toast, no push.
- Buttons swallow pointer/click/keydown so an amen tap never selects, drags,
  or keyboard-toggles the card underneath.
- Amen your own idea: allowed (low-stakes). Viewers: may amen — reacting is
  not editing.

## The recap fold-in (E2)

`amensAsActivity` synthesizes `idea_amened` rows (IDs + kinds only — the hard
product rule; `payload: {}`) from others' amens; the host passes them to
`CanvasRecapGate → useCanvasRecap(songId, extraEvents)`, which filters them
through the SAME visit anchor + own-changes exclusion and folds them into the
same 5-line digest — "Sarah left 3 amens", grouped, never a second surface.
The `idea_amened` kind→copy lives in `recapDigest.ts` PHRASES, so the copy
also renders the day the backend starts logging real `idea_amened` activity
rows (a welcome-but-optional A3 addition).

## Invariants

1. **Creates nothing about the song** — a reaction is metadata on an idea;
   lyrics/melody/chords/sections are untouched.
2. **Signal, never a vote** — amens never auto-promote, never reorder, never
   gate the review queue; the owner reads them and decides.
3. **Calm** — small warm clusters of WHO, capped; no counts that spike, no
   red, no notifications; the recap groups.
4. **Reversible + never blocks** — optimistic, offline-queued, one tap to
   withdraw; every server call degrades silently.
5. **Lane-clean** — D3 computes; D1's `cardAdornment` slot renders; the
   schema is filed, not written; the recap is fed, not forked.

## Launch-audit fixes (2026-07-21, same day)

1. **Flush replay (high):** the flusher re-read `stateRef.current` mid-loop,
   but the ref lags React's commit — the same op could be sent twice
   (duplicate insert → unique violation). It now walks a snapshot of the
   queue; `confirmOp` reconciles each op individually.
2. **Toggle-while-in-flight (high):** withdrawing while your add was on the
   wire (or re-amening while your remove was) left the server opposite to
   your last tap. `confirmOp` now detects the annihilated op (absent from
   the queue) and enqueues the compensating op — the server always ends
   where the user's last tap left it. Both races unit-tested.
3. **Transient-failure wipe (high):** `listCardReactions` returned `[]` for
   both "empty song" and "couldn't read" — a network blip would have wiped
   others' amens locally and mis-completed pending removes. It now returns
   `null` for unreadable, and the hook skips the merge.
4. **Render purity (low):** keyframe injection moved from the component body
   to module load.

## Next slice (filed, not shipped)

- **Note + 5-sec voice amen** (the AmenSheet): the note_text/note_voice_url
  columns are in the schema ask so the table lands complete, but the UI
  waits on (a) the table existing and (b) a storage-path decision for voice
  notes (voice amens must not masquerade as `voice_memos` takes). Consumes
  C4's `useVoiceRecorder` when it ships — never a fork.
- A tiny "who amen'd" list popover if clusters outgrow the inline line.
