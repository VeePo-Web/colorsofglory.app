## Status: the RPC already exists

`public.accept_song_invite(_token text, _user_id uuid)` is live and already handles the atomic membership leg correctly:

- `SELECT ... FOR UPDATE` row lock on the invite (prevents double-spend on concurrent accepts)
- Idempotent: returns `OK / already_member=true` if the user is already a member
- Validates `status='pending'`, `expires_at > now()`, `use_count < max_uses` (auto-transitions to `expired` / `accepted` on the boundary cases)
- Inserts into `song_members` with `ON CONFLICT (song_id, user_id) DO NOTHING`
- Increments `use_count`, sets `accepted_by_user_id` / `accepted_at`, flips `status='accepted'` when fully consumed
- Writes `audit_logs` entry (`action='accept_song_invite'`)
- Edge function `supabase/functions/song-invite-accept` is already wired to this RPC with proper status-code mapping

**No changes needed to the membership/atomicity logic itself.**

## Gap: referral attribution on accept

The only missing piece vs the original Claude spec is the **reward leg**. Today, accepting an invite does not link the invitee to the inviter for the referral-cash program. Per `attribute_referral`'s direct-only + first-valid-wins contract, invite acceptance is the correct attribution moment for invitees who arrive through a song invite and have no prior code attribution.

Note on terminology: COG's reward model only mints cash on **paid invoice events** (`record_invoice_paid`) once the invitee subscribes. Attribution at accept-time is the *setup* for that future payout — it does not mint a reward immediately. This matches the existing founder/referral system.

## Proposed plan

### 1. Extend `accept_song_invite` (one migration)

Add a best-effort attribution call at the end of the OK path (after the membership insert, before `RETURN QUERY OK`):

```sql
-- Best-effort referral attribution: invitee -> inviter
-- Only fires when (a) invitee has no existing attribution, (b) inviter has an
-- active user_referral code, (c) inviter != invitee. All failure modes
-- swallowed — attribution must never block invite acceptance.
IF NOT v_already_member AND inv.created_by_user_id IS NOT NULL
   AND inv.created_by_user_id <> _user_id THEN
  BEGIN
    PERFORM public.attribute_referral(
      _user_id,
      (SELECT referral_code FROM public.profiles
        WHERE user_id = inv.created_by_user_id),
      'invite_accept'::public.attribution_source
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow: invalid_code, self_referral_not_allowed, already-attributed, etc.
    NULL;
  END;
END IF;
```

Prereq check: confirm `'invite_accept'` is (or add it to) the `attribution_source` enum. If not present, the migration adds it via `ALTER TYPE public.attribution_source ADD VALUE IF NOT EXISTS 'invite_accept'`.

### 2. No edge function changes

`song-invite-accept/index.ts` already returns `{ song_id, role, already_member }` — frontend contract is unchanged. Attribution is a server-side side effect.

### 3. No SDK changes

`src/integrations/cog/songs.ts` already exposes `acceptInvite(token)`. Untouched.

### 4. Verification (post-migration)

- Manual: create two test users, generate invite from user A, accept as user B, verify `referral_attributions` row exists with `referrer_user_id=A`, `source='invite_accept'`.
- Re-accept idempotency: re-running accept for the same user does not create a duplicate attribution (handled by `attribute_referral`'s first-valid-wins guard).
- Self-invite: A accepts their own invite (edge case) → no attribution row, no error.

## Out of scope (explicitly NOT building)

- Minting `reward_events` at accept-time — rewards only fire on paid invoices (existing design)
- Touching the membership/lock/audit logic — already correct
- New tables, new RPCs, frontend changes, or anything in `src/pages/**` / `src/components/**`

## Deliverable

One migration file: `supabase/migrations/<ts>_accept_invite_referral_attribution.sql` containing:
1. Optional `ALTER TYPE attribution_source ADD VALUE IF NOT EXISTS 'invite_accept'`
2. `CREATE OR REPLACE FUNCTION public.accept_song_invite(...)` with the attribution block appended
