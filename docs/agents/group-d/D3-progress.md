# D3 Canvas Collaboration — Progress Log

> Recreated 2026-07-08 — the original uncommitted log was lost to a concurrent session's cleanup of untracked files. Entries below are condensed from the session records.

## Reconciliation + commit (2026-07-08)

**Outcome:** two D3-lane passes ran in parallel; the other pass committed first (its own `subscribeSongPresence` with `PresenceIdentity`, `useSongPresence` + calm join toasts, props-driven `SongCanvasCollabLayers` with invite/credits CTAs and honest empty states, card-derived manual recap with deep links, and a card-derived pending-review queue). This session **reconciled instead of clobbering**: deleted its duplicate presence/roster hooks (superseded by `useSongPresence` + `useSongCollaborators`), and contributed the piece the committed surface lacked — the **return-visit auto-recap from the real server activity feed**:

- `src/lib/canvas/collab/recapDigest.ts` — pure grouped digest (groups (actor, kind) → plain English, skips upload-lifecycle noise, caps 5, color always beside the name). Tested in `src/test/recap-digest.test.ts` (7 tests).
- `src/lib/canvas/collab/useCanvasRecap.ts` — snapshot-then-advance visit anchor `cog:canvas-last-visit-${songId}` + fire-and-forget `mark_song_seen`; first visits and own-changes stay silent; one snapshot per visit.
- `src/components/canvas/CanvasRecapGate.tsx` — adapted to the committed `WhatChangedRecapSheet` signature (`songId` required, `items` provided so demo fallback never renders); mounted in the canvas as `{!showRecap && <CanvasRecapGate songId={songId} />}` beside the manual recap.
- `src/test/canvas-collab.test.tsx` — rewritten to gate-only coverage (the old version tested a component API that no longer exists): first-visit silence + anchor write, capped others-only digest on return, own-changes-only silence.

**Verified:** tsc clean in all D3 files; the two D3 suites pass; build green (see commit).

**Known seams for the next D3 pass:**
- Manual recap items are card-derived (deep links); return-recap items are activity-derived (no `targetCardId` yet). Unify the pipelines when activity rows carry entity ids reliably.
- The pending-review queue is card-derived client state — the server-backed loop (Steps 4–7) is blocked solely on the `song_suggestions` table + `voice_memos.parent_memo_id` (contract §8, Lovable's lane).
- Two-session live presence check still to run with signed-in sessions (Step 10).

## Step 0 — Precondition audit (2026-07-07, historical)

A 6-agent audit verified the charter's claims against the repo before any code: hardcoded `COLLABORATORS`/`ACTIVITY`, fake `setTimeout` suggestion send, `DEMO_ITEMS` recap (unreachable — `setShowRecap(true)` never called), spoofable `?role=viewer` gate, localStorage-only canvas persistence, and — schema truth — **no suggestions table, no `parent_memo_id`, no `pending_review` anywhere in the DB**, while `get_song_detail` already returns `pending_suggestion_count`. Seams that existed unconsumed: `members.ts#listMembers/myRole`, `activity.ts#getActivitySince/listActivitySince/markSongSeen/getRecapDigest` (RPCs ARE in generated types; the `as any` casts are stale). Findings and upstream requests were filed in `docs/CANVAS-COLLAB-CONTRACT.md`; the same day, D2/E1/E2/E3 and the parallel D3 pass landed concurrently, resolving several preconditions in real time.
