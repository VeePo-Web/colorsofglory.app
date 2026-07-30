# R8 — Songwriting Room Audit: "Cold Start and No Signal"

**Owner:** Claude (frontend/UX). Backend for this round is shipped.
**The one goal:** an idea gets into the song in seconds — *even on the worst network in the church basement.*

R7 made removal recoverable. R8 attacks the two moments the room is weakest:
**the first 800ms after tapping into a song**, and **the moment there is no signal.**

---

## Findings

### P0 — A double-tapped idea saved twice
`quickCapture` had no idempotency key. A double tap on Save, a retry after a timeout,
or an outbox replay after reconnect each created a *separate* capture. The writer sees
their idea listed twice and has to clean up — the exact opposite of the promise.

**Fixed backend-side.** `quickCapture` now accepts `client_key`:
```ts
const key = crypto.randomUUID();          // generated ONCE when the user commits
await quickCapture({ song_id, lyric_snippet, client_key: key });  // safe to retry forever
```
The same key always resolves to the same capture row. **Every capture call site must
pass `client_key`.** Generate it at commit time, keep it with the pending item in the
outbox, and reuse it on every retry — never regenerate on retry.

### P0 — Cold start shows a spinner, not the song
The room waits on `song_room_bootstrap` before painting anything. On a cold 4G start
that is a blank screen with a spinner where the song title should be.

Fix: **paint the shell instantly.**
- Persist the last bootstrap payload per song to `localStorage` (or IndexedDB) on every
  successful fetch, keyed `cog:room:<songId>`.
- On mount, render that cached payload immediately (title, section chips, card skeleton
  count, member avatars) while the live fetch runs, then reconcile.
- Never show a full-screen spinner in a room the user has opened before.

### P0 — Capture is blocked when the bootstrap is in flight
The capture affordance should be usable **before** the song finishes loading. Capture
depends on `songId` only — nothing else. Enable the dock at first paint.

### P1 — No offline signal, no queue visibility
There is no indication that a save is pending, and no indication the device is offline.
- One quiet, non-red room-level chip: "Saved" / "Saving…" / "Waiting for signal · N".
- Never block input on it. Never modal it. Never use red.
- Tapping the chip when items are queued lists them; that's the whole UI.

### P1 — Skeletons don't match the real layout
Any skeleton whose height differs from the real card causes a jump on hydrate.
Skeletons must be the exact card height at each `kind`.

### P2 — Empty room has no first move
A brand-new song's empty feed should be one warm line and one action, not a grid of
placeholders: "This song is empty. Hum something." → capture.

---

## What to build

1. **Thread `client_key` through every capture path** — quick capture, voice memo
   intake, promote. Store it alongside the pending item; reuse on retry.
2. **Cached-first room paint** — write/read `cog:room:<songId>`, reconcile on arrival,
   drop the full-screen spinner.
3. **Sync chip** — a single calm status pill wired to the outbox queue length and
   `navigator.onLine`.
4. **Exact-height skeletons** per card kind.
5. **Empty-room single move.**

## Acceptance
- Tapping Save twice, fast, on the same idea produces exactly one card.
- Airplane mode: idea is accepted, chip reads "Waiting for signal · 1", reconnect
  produces exactly one card.
- Re-entering a previously-opened song paints real content in the first frame, zero
  full-screen spinners.
- No layout shift between skeleton and hydrated card.
- Capture is tappable before the room finishes loading.

## SDK reference
```ts
import { quickCapture } from "@/integrations/cog/capture";
quickCapture({ song_id, lyric_snippet, client_key });  // retry-safe
```
