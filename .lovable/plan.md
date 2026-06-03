# Migration #2 — Songs Core

Adds the central "private room" tables plus the SECURITY DEFINER membership helpers every downstream content table will depend on.

## New enums

- `song_member_role` — `owner | collaborator | viewer`
- `song_status` — `active | archived | deleted`
- `section_kind` — `verse | chorus | bridge | pre_chorus | intro | outro | hook | tag | other`

## New tables (all in `public`)

1. **`songs`** — the room
   - `id`, `owner_user_id`, `title`, `status` (default `active`), `key_signature`, `tempo_bpm`, `time_signature`, `tags text[]`, `cover_color`, `is_locked bool`, `last_activity_at`, `created_at`, `updated_at`
2. **`song_members`** — who's in the room
   - `id`, `song_id`, `user_id`, `role song_member_role`, `invited_by_user_id`, `joined_at`, unique `(song_id, user_id)`
3. **`song_sections`** — ordered section skeleton
   - `id`, `song_id`, `kind section_kind`, `label`, `position int`, `created_by_user_id`, `created_at`, `updated_at`
4. **`song_lyrics`** — current lyric blocks per section (one row per section, rich text as `content jsonb` + `plain_text` for search)
   - `id`, `song_id`, `section_id` unique, `content jsonb`, `plain_text`, `updated_by_user_id`, `updated_at`, `created_at`
5. **`song_notes`** — freeform notes pinned to the room or a section
   - `id`, `song_id`, `section_id` nullable, `author_user_id`, `body text`, `created_at`, `updated_at`
6. **`chord_progressions`** — chord lanes per section
   - `id`, `song_id`, `section_id` nullable, `label`, `chords jsonb` (ordered chord tokens), `created_by_user_id`, `created_at`, `updated_at`

## Helpers (SECURITY DEFINER, search_path=public)

- `is_song_member(_song_id uuid, _user_id uuid) returns boolean`
- `song_role(_song_id uuid, _user_id uuid) returns song_member_role`
- `is_song_owner(_song_id uuid, _user_id uuid) returns boolean`
- `touch_song_activity()` trigger fn — bumps `songs.last_activity_at` on writes to child tables

EXECUTE revoked from `public` / `anon`; granted to `authenticated` only.

## Triggers

- `updated_at` triggers on all 6 tables via existing `update_updated_at_column()`
- `after_song_insert_add_owner_member` — automatically inserts owner row into `song_members` on `songs` insert
- `touch_song_activity` AFTER INSERT/UPDATE/DELETE on `song_sections`, `song_lyrics`, `song_notes`, `chord_progressions`, `song_members`

## GRANTs

- `songs`, `song_members`, `song_sections`, `song_lyrics`, `song_notes`, `chord_progressions`:
  - `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`
  - `GRANT ALL ... TO service_role`
  - no `anon` grant (invite-preview surface comes in Migration #3)

## RLS policies (all `to authenticated`)

- **`songs`**
  - SELECT: `is_song_member(id, auth.uid())`
  - INSERT: `owner_user_id = auth.uid()` (free-plan cap enforced server-side in `create-song` edge fn, not in RLS)
  - UPDATE: `is_song_owner(id, auth.uid())`
  - DELETE: `is_song_owner(id, auth.uid())`
- **`song_members`**
  - SELECT: `is_song_member(song_id, auth.uid())`
  - INSERT/UPDATE/DELETE: `is_song_owner(song_id, auth.uid())` (invitee self-insert handled by `accept-invite` edge fn via service role)
- **`song_sections`, `song_lyrics`, `song_notes`, `chord_progressions`**
  - SELECT: `is_song_member(song_id, auth.uid())`
  - INSERT: `is_song_member(song_id, auth.uid())` and author/updated_by/created_by = `auth.uid()`
  - UPDATE: `is_song_member(song_id, auth.uid())` (notes additionally require `author_user_id = auth.uid()` OR `is_song_owner`)
  - DELETE: `is_song_owner(song_id, auth.uid())` OR (for notes) `author_user_id = auth.uid()`

## Indexes

- `songs(owner_user_id, status)`, `songs(last_activity_at desc)`
- `song_members(user_id)`, `song_members(song_id)`
- `song_sections(song_id, position)`
- `song_lyrics(song_id)`, `song_lyrics(section_id)` unique
- `song_notes(song_id, created_at desc)`
- `chord_progressions(song_id)`

## Realtime

- `ALTER PUBLICATION supabase_realtime ADD TABLE song_lyrics, song_sections, song_members, song_notes, chord_progressions;`
- `ALTER TABLE ... REPLICA IDENTITY FULL` on the same five (needed for UPDATE/DELETE payloads)

## What is NOT in this migration

- Invites, versions, activity feed, voice memos, storage usage, suggestions, payments — all later migrations.
- Free-plan owned-song cap — enforced in the `create-song` edge function (Migration #6+), not at SQL level, so admins can override.
- No frontend code; SDK additions wait until the schema settles.

After approval I'll submit the migration, run the linter, and patch any warnings before reporting back.
