# Migration #3 — Invites + Version History

Adds the collaborator invite flow and the snapshot/restore system. Both build on the song-membership helpers from Migration #2.

## New enums

- `invite_status` — `pending | accepted | revoked | expired`
- `version_kind` — `manual | auto | restore_point`

## New tables

### 1. `song_invites`
The shareable invitation a song owner generates.

- `id uuid pk`
- `song_id uuid` → `songs(id)` ON DELETE CASCADE
- `token text unique` — opaque random URL token (server-generated, indexed)
- `invited_email text` (nullable — link can be open)
- `invited_phone text` (nullable)
- `role song_member_role` default `collaborator` (never `owner`)
- `status invite_status` default `pending`
- `created_by_user_id uuid` (must equal song owner)
- `accepted_by_user_id uuid`, `accepted_at timestamptz`
- `expires_at timestamptz` (defaulted from `app_settings.invite_expiry_hours`)
- `max_uses int default 1`, `use_count int default 0`
- `message text` (optional personal note from sender)
- `created_at`, `updated_at`

### 2. `song_versions`
A point-in-time snapshot of a song's full content.

- `id uuid pk`
- `song_id uuid` → `songs(id)` ON DELETE CASCADE
- `version_number int` (monotonically increasing per song, enforced by trigger)
- `kind version_kind` default `manual`
- `label text`, `description text`
- `snapshot jsonb` — full payload: `{ song, sections[], lyrics[], chords[], notes[] }`
- `created_by_user_id uuid`
- `created_at timestamptz`
- `parent_version_id uuid` (nullable, links restore points to their source)
- UNIQUE `(song_id, version_number)`

## Helpers

- `current_invite_expiry()` — reads `app_settings.invite_expiry_hours` and returns `now() + interval`. Used as default for `expires_at`.
- `next_song_version_number(_song_id uuid) returns int` SECURITY DEFINER — `max(version_number)+1` per song. Called from a BEFORE INSERT trigger so callers don't have to compute it. Also serves the future `save-version` edge function.
- `is_invite_valid(_invite_id uuid) returns boolean` SECURITY DEFINER — checks `status=pending AND now()<expires_at AND use_count<max_uses`. Used by `accept-invite` edge fn and invite-preview policy.

All revoked from `public`/`anon`; `is_invite_valid` granted to `anon, authenticated` (for the preview surface); the others to `authenticated` + `service_role`.

## Triggers

- `set_song_version_number` BEFORE INSERT on `song_versions` — assigns `version_number` if NULL.
- `update_updated_at_column` on `song_invites` and `song_versions`.
- `touch_song_activity` AFTER INSERT/UPDATE on both tables.

## GRANTs

- `song_invites`:
  - `GRANT SELECT ON public.song_invites TO anon` — limited via RLS to single-row preview by `token`.
  - `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated`
  - `GRANT ALL TO service_role` (accept-invite runs there)
- `song_versions`:
  - `GRANT SELECT, INSERT, DELETE TO authenticated` (no UPDATE — versions are immutable snapshots)
  - `GRANT ALL TO service_role`
  - no `anon` grant

## RLS policies

### `song_invites`

- **anon SELECT (preview)**: `to anon USING (true)` — but combined with an explicit column-aware app convention: clients must filter by `token = '...'`. To prevent enumeration we additionally require `is_invite_valid(id)` so revoked/expired/used invites stop returning. (The invite token itself is the secret; this matches the "irresistible invite" PDF.)
- **authenticated SELECT**: members of the song can see invites; the invited user can see invites addressed to their email.
  - `USING (is_song_member(song_id, auth.uid()) OR invited_email = (auth.jwt() ->> 'email'))`
- **INSERT**: `is_song_owner(song_id, auth.uid()) AND created_by_user_id = auth.uid() AND role <> 'owner'`
- **UPDATE**: owner only (`is_song_owner(song_id, auth.uid())`) — used for revoke / message edits. `accept-invite` edge fn uses service role to bump `use_count`/`status`/`accepted_*`.
- **DELETE**: owner only.

### `song_versions`

- **SELECT**: `is_song_member(song_id, auth.uid())`
- **INSERT**: `is_song_member(song_id, auth.uid()) AND created_by_user_id = auth.uid()`
- **DELETE**: `is_song_owner(song_id, auth.uid())`
- No UPDATE policy (immutable).

## Indexes

- `song_invites(token)` unique already; add `song_invites(song_id, status)`, `song_invites(invited_email)`, `song_invites(expires_at)`.
- `song_versions(song_id, version_number desc)`, `song_versions(created_by_user_id)`.

## Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE song_invites;` + `REPLICA IDENTITY FULL` so owners see invite status changes live.
- `song_versions` NOT in realtime (snapshots are large; UI polls or refreshes after `save-version` returns).

## What is NOT in this migration

- The `accept-invite`, `send-invite`, `save-version`, `restore-version` edge functions — they come in the edge-function migration once the schema settles.
- Email/SMS sending — depends on the Resend connector decision (still pending).
- Storage usage caps and voice memos — Migration #4.
- Free-plan owned-song cap and Stripe — later migrations.

After approval I'll submit, run the linter, and fix any new warnings (the existing `is_*` SECURITY DEFINER warnings will stay — they're the intentional helper pattern).
