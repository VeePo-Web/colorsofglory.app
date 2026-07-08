# CANVAS COLLABORATION CONTRACT — D3
## The multiplayer overlay of `/songs/:id/canvas`

> **Status: v0.3 (2026-07-08).** Two D3-lane passes ran in parallel and were reconciled: presence, roster wiring, the manual card-derived recap, and a card-derived pending-review queue shipped from one pass; the **return-visit auto-recap from the real activity feed** shipped from the other (`CanvasRecapGate` + `src/lib/canvas/collab/`). **The remaining hard blocker for a persistent, server-backed review loop is §8.1 — the `song_suggestions` table.** Earlier draft history (v0.1 requirements, v0.2 partial-ship) is folded in below.

---

## 1. The loop D3 owns

Every collaborator action on the canvas is a **proposal**, never a change:

```
contributor acts ──► proposal (pending) ──► owner decides ──► accepted → applied via store/D2
   (suggest line,                              (Review Queue)   keep original → dismissed,
    record over,                                                song untouched
    submit idea)                              original ALWAYS preserved either way
```

**Proposal kinds:** `line` (F19 line-level suggestion), `layer` (Product 04 "record over this"), `idea` (F11 pending idea into the review zone).

**Invariants (non-negotiable):**
1. A non-owner's action never mutates the song directly — it lands as `pending`.
2. The original is never destroyed, even after an accept (snapshot preserved).
3. Only the owner resolves proposals (E1 `isOwner`).
4. Calm activity intelligence (Product Vision 08): no red badges, no pulsing counts, presence is ambient.

---

## 2. Presence — SHIPPED

`subscribeSongPresence` lives in `src/integrations/cog/realtime.ts` (additive; `subscribeSongRoom` untouched). As-built API:

```ts
export type PresenceIdentity = { userId: string; name: string; color: string; initials: string };
export function subscribeSongPresence(
  song_id: string,
  self: PresenceIdentity,
  onChange: (members: PresenceIdentity[]) => void,
): () => void; // unsubscribe closure (untrack + removeChannel)
```

Channel `presence:song:${song_id}`, presence-keyed by `userId` (multiple tabs collapse to one peer). Consumed ONLY via `useSongPresence(songId, self)` (`src/lib/canvas/useSongPresence.ts`) — fails soft (presence is an enhancement, never a dependency), flags `isSelf`, and the canvas surfaces it as the header presence stack with calm join toasts. Components never call `supabase.channel()` directly. Live cursors remain deferred until D1 exposes a viewport-space slot (§4).

## 3. Roster — SHIPPED

Real members flow through `useSongCollaborators(songId)` (`src/lib/invite/`), feeding: the header presence-stack fallback, the People-layer "In this room" card (`SongCanvasCollabLayers`, now props-driven with honest solo/empty states — no fabricated people), and the invite sheet roster. Contributor color is always paired with name/initials.

## 4. REQUEST → D1 (CanvasStage slots) — still open

1. **`presenceSlot`** viewport-space cursor layer (receives pan/zoom transform) for live cursors.
2. **`cardAdornment(cardId)`** per-card calm pending-review marker (soft `--cog-gold-pale`; never red).
3. **`sheetPortal`** portal target with background-inert handling for D3's bottom sheets.

## 5. Recap ("what changed since you left", Product 12) — SHIPPED in two halves

- **Manual recap:** the room's "See the full recap" button opens `WhatChangedRecapSheet` with card-derived items (other hands' cards, deep-linking to each card via `onJumpToCard`).
- **Return-visit auto-recap:** `CanvasRecapGate` (mounted in the canvas beside the manual path) + `useCanvasRecap` + `recapDigest.ts` (`src/lib/canvas/collab/`): snapshot-then-advance visit anchor `cog:canvas-last-visit-${songId}`, fire-and-forget `mark_song_seen` RPC, `getActivitySince` from the real activity feed, own changes excluded, upload-lifecycle noise skipped, grouped plain-English lines capped at 5. First visits and unchanged rooms stay silent.
- **Unification seam (future):** when activity rows carry entity ids reliably, feed `buildRecapDigest` output through the same deep-link mapping so both halves share one pipeline.

## 6. E1 capabilities — landed upstream

`src/lib/permissions/` (`useCapabilities`, `useSongRole`) gates the canvas from real membership; the spoofable `?role=viewer` URL gate is dead. The review queue applies/keeps under owner gating; full `isOwner`-gated server-backed queue waits on §8.1.

## 7. What D3 consumes (verified seams)

| Surface | Where |
|---|---|
| Activity | `cog/activity.ts` — `getActivitySince`, `listActivitySince`, `markSongSeen`, `getRecapDigest` (RPCs are in generated types; stale `as any` casts can be dropped) |
| Roster | `useSongCollaborators` (`src/lib/invite/`); `cog/members.ts` (`listMembers`, `myRole`) remains the seam under it |
| Recorder (C4) | `useVoiceRecorder`, `enqueuePendingUpload` (carries `parentMemoId`), `StackSheet`/`MemoStack` (`canRecordOver`/`onRecordOver`) |
| Avatars | `CollaboratorAvatarStack`; contributor color: DB `avatar_color` first, `creatorColors` aurora hash as fallback |

## 8. SCHEMA REQUESTS (Lovable's lane — the remaining hard blocker)

1. **`song_suggestions` table** — the spine of a persistent review loop. No suggestions/proposals table exists anywhere in the schema, yet `get_song_detail` already returns `pending_suggestion_count` (`types.ts:2795`) — ask Lovable what that reads from. Proposed: `id, song_id, kind ('line'|'layer'|'idea'), card_id?, section_id?, original_snapshot jsonb, proposed_payload jsonb, proposed_by, status ('pending'|'accepted'|'declined'), decided_by?, decided_at?, created_at`. RLS: members read; contributor/owner insert own; **only owner updates `status`**. Add to the song-room realtime channel.
2. **`voice_memos.parent_memo_id`** (uuid nullable, FK voice_memos.id) — layers survive only client-side today; `voiceApi` already sends `parent_memo_id` and the server drops it. See `docs/features/VOICE-MEMO-STACKING-RESEARCH.md`.
3. Prefer proposals keyed by `card_id` over a new status column on `canvas_cards` (one review spine).

**Until §8.1 lands:** the pending-review queue is card-derived (client state), `LineSuggestionSheet`'s send cannot persist to a queue that survives sessions, and record-over proposals can't be owner-gated server-side. These close together when the table exists.

## 9. Step status

| D3 step | Status |
|---|---|
| 1 — logic layer + slots | Logic in `src/lib/canvas/collab/` + canvas hooks; slot mounting waits on D1's published `CanvasStage` slots |
| 2 — real roster | **DONE** |
| 3 — live presence | **DONE** (ambient avatars + join toasts; cursors deferred to D1 slot; two-session live check still to run with signed-in sessions) |
| 4 — Owner Review Queue | Card-derived interim shipped; **server-backed queue blocked on §8.1** |
| 5 — line-suggestion loop | Blocked on §8.1 |
| 6 — pending markers | Blocked on D1 `cardAdornment` slot |
| 7 — record-over proposals | Blocked on §8.1 + §8.2 |
| 8 — recap | **DONE** (two halves, §5) |
| 9 — calm/gating/a11y pass | Largely landed (E1 gating, honest empty states, reduced-motion sheets); full pass with 4–7 |
| 10 — two-session E2E | After 4–7 |

---

*D3 · Canvas Collaboration · v0.3 · reconciled across parallel D3 passes; audit evidence in `docs/agents/group-d/D3-progress.md`.*
