## Problem
`public.accept_song_invite` now silently absorbs replay clicks (same user, same invite) by returning `OK` without touching `use_count`. But the response shape is identical to a first-time accept, so the UI cannot distinguish "freshly accepted" from "already active" and cannot show a reassuring "already active" message.

The `InvitePreviewPage` is also entirely mock data — it never calls the backend.

## Solution
Expose `already_member` from the accept path, add a preview endpoint for invite metadata, wire the page to real APIs, and surface a distinct "already active" state.

### 1. Backend — SQL: make `already_member` visible in accept response

Update `accept_song_invite(_token, _user_id)` return table:
- Add `already_member boolean` as a 4th column.
- Set `already_member = true` on the idempotent replay path (before the short-circuit RETURN).
- Set `already_member = false` on the first-time accept path.
- Error branches return `already_member = NULL`.

### 2. Backend — Edge function: `song-invite-accept`

Update the envelope builder to pass through `already_member` from the RPC row:
```
{ ok: true, code, data: { song_id, role, already_member } }
```
Error responses remain unchanged.

### 3. Backend — New edge function: `song-invite-preview`

Anon and authenticated users need to see invite metadata before accepting (song title, inviter name, role, collaborator count, expiration). Client-side RLS prevents this because anon cannot read `songs`, `profiles`, or `song_members`.

Create `supabase/functions/song-invite-preview/index.ts`:
- Accepts `POST { token }`.
- Looks up `song_invites` by token, validates `is_invite_valid(id)`.
- Joins `songs` (title), `profiles` (inviter display_name), and counts `song_members` for the song.
- Returns `{ ok: true, data: { song_title, inviter_name, role, collaborator_count, expires_at } }`.
- Returns `{ ok: false, code: 'INVITE_NOT_FOUND' | 'INVITE_EXPIRED' }` for invalid tokens.

### 4. Frontend SDK — `src/integrations/cog/songs.ts`

- Update `acceptInvite` return type:
  ```ts
  { song_id: string; role: string; already_member?: boolean }
  ```
- Add `previewInvite(token: string)` helper calling `song-invite-preview`.

### 5. Frontend UI — `src/pages/InvitePreviewPage.tsx`

Replace the mock page with a real data flow:

**On mount:**
- Call `previewInvite(token)` using the URL param.
- Show loading skeleton while fetching.
- On error (not found / expired), render a dead-end screen with the error and a "Go home" link.
- On success, render the invite card with real title, inviter, role, and collaborator count.

**On "Open song" click:**
- Call `acceptInvite(token)`.
- On success with `already_member === true`:
  - Show an inline "already active" confirmation (e.g., "You're already in this song — opening now.") instead of a generic success flash.
  - Then navigate to `/songs/:song_id`.
- On success with `already_member === false`:
  - Navigate directly to `/songs/:song_id`.
- On error:
  - Map `CogErrorCode` to human copy and show inline (not toast-only) so the user can retry or go home.

### 6. Verification

1. Create an invite via `song-invite-create`.
2. Call `song-invite-preview` with the token → returns metadata.
3. Call `song-invite-accept` as a new user → returns `already_member: false`, `use_count` increments.
4. Call `song-invite-accept` again as the same user → returns `already_member: true`, `use_count` unchanged.
5. In the preview UI, accept once → navigates. Reopen the `/invite/:token` link, click accept → shows "already active" message, then navigates.