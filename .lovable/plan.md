# Plan — Idempotent Invite Accept

## Problem
`public.accept_song_invite(_token, _user_id)` currently increments `song_invites.use_count` on every call. If a user clicks the accept link twice (network retry, double-tap, refresh, deep-link reopen), each click consumes a slot — exhausting `max_uses` and locking out legitimate invitees. The `INSERT ... ON CONFLICT DO NOTHING` on `song_members` already makes membership idempotent, but the bookkeeping update around it is not.

## Fix (single migration, no edge function or SDK changes needed)

Rewrite `public.accept_song_invite` so the increment + status transition only happen the **first time** this `_user_id` redeems this invite. Detection key: existence of a `song_members` row for `(inv.song_id, _user_id)` **before** we insert.

New control flow inside the function (after the existing validation branches `INVITE_NOT_FOUND` / `INVITE_ALREADY_USED` / `INVITE_EXPIRED` / `INVITE_EXHAUSTED`, all unchanged):

```text
already_member := EXISTS(song_members WHERE song_id = inv.song_id AND user_id = _user_id)

INSERT INTO song_members (...) ON CONFLICT DO NOTHING   -- unchanged

IF already_member THEN
  -- idempotent replay: do NOT touch use_count, accepted_*, status
  -- do NOT write an audit row (avoids audit noise on every refresh)
  RETURN (inv.song_id, inv.role, 'OK')
END IF

-- first-time accept path: existing increment + status logic, unchanged
UPDATE song_invites
  SET use_count = use_count + 1,
      accepted_by_user_id = COALESCE(accepted_by_user_id, _user_id),
      accepted_at = COALESCE(accepted_at, now()),
      status = CASE WHEN use_count + 1 >= max_uses THEN 'accepted' ELSE 'pending' END,
      updated_at = now()
  WHERE id = inv.id;

write_audit(_user_id, 'accept_song_invite', ...)
RETURN (inv.song_id, inv.role, 'OK')
```

### Why this is safe
- The `SELECT ... FOR UPDATE` on `song_invites` at the top of the function still serializes concurrent first-time accepts against the same token, so two genuinely-new users racing the last slot still get the correct `INVITE_EXHAUSTED` for the loser.
- The `already_member` check sits inside that same locked transaction, so a replay by an existing member cannot interleave with a real accept by a different user.
- `song_members` has a `UNIQUE (song_id, user_id)` (relied on by the existing `ON CONFLICT`), so the membership-existence probe is exact.
- No schema changes, no RLS changes, no GRANT changes — function body only.

### Out of scope (explicitly)
- No change to `song-invite-accept` edge function (it already maps `OK` → 200 and surfaces `data.song_id` / `data.role`).
- No change to `src/integrations/cog/songs.ts` `acceptInvite()`.
- No change to invite expiry / revoke / create flows.
- No change to `max_uses` semantics for new users — only replays by the same accepted user are absorbed.

## Deliverable
One migration: `CREATE OR REPLACE FUNCTION public.accept_song_invite(...)` with the new body. Append a short note to `.lovable/plan.md` execution log under D2.

## Verification after build-mode switch
1. Read current function via `supabase--read_query` to confirm signature is unchanged.
2. Apply migration.
3. Smoke via `supabase--read_query`:
   - Seed a 1-use invite, call `accept_song_invite` twice as same user → `use_count = 1`, `status = 'accepted'`, both calls return `OK`.
   - Seed a 2-use invite, call as user A then user B → `use_count = 2`, `status = 'accepted'`.
   - Replay user A again → `use_count` still 2, returns `OK`, no audit row added on replay.

---
## Execution log — Idempotent invite accept (2026-06-04)

`accept_song_invite(_token, _user_id)` rewritten: after `FOR UPDATE` lock on the invite row, probes `song_members` for `(inv.song_id, _user_id)` and short-circuits with `OK` if already a member — no `use_count++`, no status flip, no audit row. New-user path unchanged. No edge function or SDK changes required; envelope still `{ ok:true, code:'OK', data:{ song_id, role } }`.