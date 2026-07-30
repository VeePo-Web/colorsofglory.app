# R39 — Songwriting Room Audit: "An amen that actually reaches someone"

**Lane:** Claude (frontend only). Backend shipped by Lovable.
**Goal reminder:** the room exists to finish a song. Encouragement is what keeps
a co-writer coming back to finish it.

## The gap

`src/integrations/cog/reactions.ts` has been running in **device-local mode**:
the `card_reactions` table did not exist, so every function short-circuited via
`probeReactionsTable()`. Amens looked like they worked and reached nobody. A
collaborator could pour hours into a bridge and never see that someone loved it.

## What ships (backend, now live)

`public.card_reactions` — `song_id`, `card_id`, `user_id` (defaults to the caller),
`kind` (`amen` | `heart` | `keeper`), optional `note_text` (≤140 chars), `created_at`.
- Unique per `(card_id, user_id, kind)` — one amen per person per card, so a
  double-tap can never double-count.
- RLS: room members read all reactions on their songs; you may only insert and
  delete your **own**.
- Added to the realtime publication — the existing dedicated reactions channel
  in `subscribeCardReactions` now actually receives events.

**No SDK change is required.** The probe flips to `true` on first call and the
same code path becomes server-backed. Nothing to migrate, nothing to rewrite.

## UI to build

### 1. The gesture
Double-tap a card = amen. That is the whole interaction. No picker, no long-press
menu, no emoji tray. `heart` and `keeper` stay schema-only for now — do **not**
surface a kind selector. Simple over complete.

### 2. The mark
A single small gold dot-and-count in the card's bottom-right corner:
`✦ 3`. Warm-gray when you haven't amened, `--cog-gold` when you have.
No avatars stack, no bubble, no animation longer than 150ms — one
`scale(1) → scale(1.18) → scale(1)` pulse on the mark, nothing on the card.

### 3. Who
Tap the mark → a small popover listing first names only ("Sarah, Caleb").
No timestamps, no scrolling list, cap at 5 + "and 2 more". Read-only.

### 4. Instant, always
- Optimistic: flip the mark and the count on the tap, before any request.
- On a `null`/`false` return from the SDK (offline, transient), **keep** the local
  state and retry on the next room focus. Never revert an amen in front of the user.
- `listCardReactions` returning `null` means "couldn't read" — merge nothing.
  It does **not** mean zero. Do not wipe local marks on a failed read.

### 5. The feed
Reactions are the one thing that must **not** enter the activity feed as rows —
they'd drown it. Instead, the feed's existing "since you left" header may carry
one extra clause when applicable: *"…and 4 amens on your bridge."* One clause,
never a list, only when the amens are on cards the reader authored.

### 6. Notifications
None. No push, no email, no badge. The amen is found when you next open the room.
This is the calm-UX law.

## Performance
- One `listCardReactions` call per room open, folded into the existing room load —
  not per card. Rows are capped at 1000 and tiny.
- Reactions keep their **own** realtime channel. Never move them onto the shared
  song-room channel: a reactions channel error must never take down activity,
  cards or takes.
- Realtime callback re-lists rather than patching — the payload is small and this
  sidesteps RLS-shaped partial rows. Debounce re-lists at 300ms.

## Acceptance
- Double-tap on device A shows on device B within a second, no refresh.
- A second double-tap withdraws it; a third re-adds it; the count never drifts.
- Going offline mid-tap never loses the amen or shows an error toast.
- Zero new feed rows, zero notifications, zero new screens.
- Only one reaction kind is reachable from the UI.
