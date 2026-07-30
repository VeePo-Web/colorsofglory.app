# Canvas Outbox — no idea can silently vanish

Backend + SDK piece of the songwriting-room audit (see
`docs/prompts/R1-claude-songwriting-room-audit-and-simplify.md`, Phase 2/4).

## What shipped (Lovable side)

- `canvas_cards.client_key` + unique index on `(song_id, client_key)`.
- RPC `canvas_upsert_card_idempotent(...)` — membership-gated, returns the
  existing card when the key was already used. Retries can never duplicate.
- `src/integrations/cog/outbox.ts` — a localStorage-journalled write queue with
  exponential backoff, drained on interval, `online`, and window focus.

## What Claude wires up (frontend only)

1. Replace `createCanvasCard(...)` with `createCanvasCardIdempotent(...)` on
   every user-gesture create path in the room (quick capture → add to canvas,
   new idea card, section split). Generate the `client_key` once with
   `newClientKey()` and keep it on the optimistic card so a manual retry reuses it.
   - Returns the server card, or `null` when the write is queued for retry —
     `null` is NOT an error. Keep the optimistic card on the board.
   - It throws only on permanent verdicts (forbidden / quota) — surface those.
2. Call `startOutbox()` once (app shell mount) and keep the teardown.
3. Calm sync indicator via `subscribeOutbox(status => ...)`:
   - `pending === 0` → nothing shown (silence is the default state).
   - `pending > 0 && online` → "Saving…" in the room header, no spinner blocking.
   - `!online` → "Offline — saved on this device, will sync".
   - `failing > 0` → one quiet line: "Still syncing" + a tap-to-retry calling
     `flushOutbox()`. Never a red badge — the room stays a sanctuary.

## Rules

- No modal, no toast, no blocking state for a queued write. The card is on the
  board; that is the user's truth.
- Never clear the queue from UI code. `flushOutbox()` is the only lever.
