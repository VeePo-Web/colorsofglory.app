## Goal
Adapt the Claude/Lovable invite-flow spec onto the existing Colors of Glory backend. Reuse `song_invites`, `song_members`, `audit_logs`, and the `song-invite-*` edge functions. Add only what is genuinely missing. Respect all locked rules (no FK to `auth.users`, `profiles.user_id`, role enum, email+Google auth, storage tool for buckets).

## Spec → existing mapping

| Spec asks for | Existing equivalent | Action |
|---|---|---|
| `invite_tokens` table | `song_invites` (token, role, max_uses, use_count, status, expires_at, message, anon preview policy) | Reuse. Skip. |
| `invite_acceptances` table | `song_invites.accepted_by_user_id` + `song_members` row | Reuse. Skip. |
| `song_members` (text role, `invited_by`) | `song_members` (enum `song_member_role`, `invited_by_user_id`) | Reuse. Skip. |
| `accept_invite()` RPC | `song-invite-accept` edge function (already atomic) | Reuse. Frontend calls edge function. |
| `preview_invite()` RPC (anon) | `song-invite-preview` edge function + anon SELECT policy | Reuse. Extend preview payload (see below). |
| `generate_invite_token()` RPC | `song-invite-create` edge function | Reuse. |
| `activity_feed` table | `audit_logs` (actor, action, entity, before/after jsonb) | Add a thin **`activity_feed` view** over `audit_logs` filtered to song-scoped events, with `is_song_member` RLS. No duplicate table. |
| `check_phone_registered()` | n/a, auth = email+Google | Skip. Confirmed not phone-OTP. |
| `profiles.first_name`/`last_name` | `profiles.display_name` | Add nullable `first_name`/`last_name` columns; keep `display_name` as source of truth (derived if both missing). |
| `profiles.avatar_color` | n/a | Add column + trigger to assign one of 5 aurora colors on profile insert. |
| `songs.lyrics_snippet` for blurred preview | n/a | Add nullable column; populate via trigger on `song_lyrics` insert/update (first ~150 chars, sanitized). Surfaced only through `song-invite-preview` (never raw to analytics). |
| `invite_requests` table (request new invite when expired/revoked) | n/a | Add new table + RLS (owner reads, anon/auth inserts). |
| `song_notification_prefs` table | n/a | Add new table + RLS (own rows only). |
| `avatars` bucket | already exists (public) | Skip. |
| Realtime on `song_members` / activity | `song_members` realtime status TBD; audit log is private | Add `song_members` to `supabase_realtime` publication. Activity stream stays via edge function / view subscription on `audit_logs` filtered server-side. |

## Migration plan (single file)

1. `ALTER TABLE public.profiles ADD COLUMN first_name text, last_name text, avatar_color text;`
2. Trigger `assign_avatar_color` BEFORE INSERT on `profiles` — hashes `user_id` to one of `#8070C4 #4D8FD2 #53AB8B #D4AE5C #C26A95`.
3. `ALTER TABLE public.songs ADD COLUMN lyrics_snippet text;`
4. Trigger `sync_lyrics_snippet` AFTER INSERT/UPDATE on `song_lyrics` — writes `LEFT(content, 150)` to parent song. SECURITY DEFINER, `search_path=public`.
5. New table `public.invite_requests` (id, original_token, song_id nullable, requested_by_user_id nullable, requested_by_phone text, status enum/text, created_at). GRANTs + RLS:
   - `authenticated` INSERT self; `anon` INSERT allowed (no user_id).
   - Song owners SELECT via `song_role(song_id, auth.uid()) = 'owner'`.
6. New table `public.song_notification_prefs` (user_id, song_id, notify_on_join bool, notify_on_contribution bool, push_enabled bool, updated_at). PK (user_id, song_id). GRANTs + RLS: own rows only. Updated_at trigger.
7. New view `public.activity_feed` over `audit_logs` filtered to song entity types (`song`, `song_lyrics`, `song_voice_memo`, `song_invite`, `song_member`, etc.), exposing `song_id` extracted from `after->>'song_id'` / `before->>'song_id'`. Security invoker so existing `audit_logs` policy + `is_song_member` gate apply. Frontend reads `from('activity_feed').select().eq('song_id', …)`.
8. `ALTER PUBLICATION supabase_realtime ADD TABLE public.song_members;` (activity_feed is a view — frontend subscribes to `audit_logs` filtered, or we add a thin trigger that mirrors into a realtime-enabled table later if needed; defer).
9. Extend `song-invite-preview` edge function response to include: `lyrics_snippet`, inviter `first_name`/`avatar_color`, up to 5 collaborators (`first_name`, `avatar_color`, initials), `collaborator_count`, `uses_remaining`. Keep existing error codes.
10. Document the API contract for Claude in `.lovable/plan.md` (preview/accept/create edge function names + payloads; new view name; new tables).

## Explicitly NOT building
- `invite_tokens`, `invite_acceptances`, parallel `accept_invite`/`preview_invite`/`generate_invite_token` RPCs (duplicates).
- `check_phone_registered` — auth is email+Google, no phone lookup needed.
- Direct `INSERT INTO storage.buckets` SQL — `avatars` already exists; storage changes go through the storage tool.
- Splitting `display_name` into required first/last — kept optional, additive only.
- FKs to `auth.users` — all new FKs go to `profiles.user_id` or via `uuid` columns per project rules.
- `WITH CHECK (false)` lockouts on existing tables — current policies already correctly gate writes; not touching `song_members` RLS.

## Verification after migration
- `SELECT preview` via existing `song-invite-preview` edge function with a seeded token → confirm extended payload.
- `pg_publication_tables` confirms `song_members` in `supabase_realtime`.
- `SELECT * FROM activity_feed WHERE song_id = …` as a member → returns rows; as non-member → empty.
- Linter clean on new objects.

## Deliverables
- 1 migration file (steps 1–8).
- 1 edge function edit (`song-invite-preview`).
- `.lovable/plan.md` updated with API contract for Claude.
- Short note back to user listing what was skipped vs the original spec, so Claude can adjust the 5 frontend screens to call existing edge functions instead of inventing RPCs.

---

## Invite Flow API Contract (for Claude)

Backend ships these primitives. Frontend should call these only — do NOT create parallel `invite_tokens`/`invite_acceptances`/RPC names.

**Edge functions** (via `supabase.functions.invoke` or `cog/songs.ts` helpers):
- `song-invite-create` → `createInvite({ song_id, role?, max_uses?, message? })`
- `song-invite-preview` (anon-safe) → `previewInvite(token)` returns `{ song_id, song_title, lyrics_snippet, inviter_name, inviter_first_name, inviter_avatar_color, role, collaborator_count, collaborators[], expires_at, uses_remaining }`
- `song-invite-accept` → `acceptInvite(token)` returns `{ song_id, role, already_member }`

**RPC**:
- `get_song_activity(_song_id, _limit?, _offset?)` → member-only; returns `{id, created_at, action, entity_type, entity_id, actor_user_id, actor_name, actor_color, payload}` rows derived from `audit_logs`. No raw lyric/memo content.

**Tables (direct read/write via RLS)**:
- `invite_requests` — insert from anon or auth when a link is dead (`original_token`, optional `song_id`, optional `requested_by_phone`). Owners can read.
- `song_notification_prefs` — own rows only; helpers `getNotificationPrefs(song_id)` / `upsertNotificationPrefs(song_id, patch)`.

**Profile additions** (optional, additive):
- `profiles.first_name`, `profiles.last_name` — optional split of `display_name`.
- `profiles.avatar_color` — auto-assigned aurora color (`#8070C4 #4D8FD2 #53AB8B #D4AE5C #C26A95`).

**Songs**:
- `songs.lyrics_snippet` — first ~200 chars across sections, auto-synced via trigger. Used only by `song-invite-preview` for the blurred preview.

**Realtime**:
- `song_members` is published — subscribe for live collaborator joins.

**NOT built (vs original Claude spec)**:
- Parallel `invite_tokens` / `invite_acceptances` tables and `accept_invite` / `preview_invite` / `generate_invite_token` RPCs — existing `song-invite-*` edge functions already cover them.
- `check_phone_registered` — auth is email + Google; no phone OTP.
- Manual storage bucket SQL — `avatars` already exists.
