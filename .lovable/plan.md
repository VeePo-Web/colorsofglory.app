# Migration #4 — Voice Memos + Storage Usage + Transcription

Adds per-section voice memos with upload, playback via signed URLs, and async transcription through the Lovable AI Gateway (no user-provided API key).

## New enums

- `memo_status` — `uploading | ready | failed | deleted`
- `transcription_status` — `pending | processing | ready | failed | skipped`

## New tables

### 1. `voice_memos`
- `id uuid pk`
- `song_id uuid` → `songs(id)` ON DELETE CASCADE
- `section_id uuid` nullable → `song_sections(id)` ON DELETE SET NULL (memo can be pinned to the room or to a section)
- `author_user_id uuid`
- `storage_path text` (bucket-relative, `{owner_user_id}/{song_id}/{memo_id}.{ext}`)
- `mime_type text`, `duration_ms int`, `byte_size bigint`
- `title text` (optional user label, e.g. "Bridge hum take 2")
- `status memo_status` default `uploading`
- `waveform_peaks jsonb` (downsampled peaks for UI; client-supplied)
- `created_at`, `updated_at`

### 2. `voice_memo_transcripts`
Separate table so transcripts can be re-generated and so we can RLS them identically to memos without bloating memo rows.
- `id uuid pk`
- `memo_id uuid` UNIQUE → `voice_memos(id)` ON DELETE CASCADE
- `song_id uuid` (denormalized for RLS)
- `status transcription_status` default `pending`
- `language text`
- `text text` (full transcript, may be empty until ready)
- `segments jsonb` (`[{start_ms, end_ms, text}]` — model-provided)
- `model text` (e.g. `google/gemini-2.5-flash`)
- `error text`
- `created_at`, `updated_at`

### 3. `storage_usage`
Per-user (song owner) rolling counter. Free-plan cap enforced server-side.
- `user_id uuid pk`
- `bytes_used bigint default 0`
- `bytes_limit bigint` (snapshot of plan cap at last refresh; null = use `app_settings.free_storage_mb`)
- `updated_at`

## Helpers (SECURITY DEFINER, search_path=public)

- `voice_memo_signed_path(_memo_id uuid)` returns text — returns the storage path if `is_song_member(memo.song_id, auth.uid())`, else null. Used by the edge function that mints signed URLs.
- `apply_storage_delta(_owner_user_id uuid, _delta bigint)` — atomically updates `storage_usage.bytes_used`. Service-role only.
- `effective_storage_limit(_user_id uuid) returns bigint` — pro plan cap if user is on pro (when plans table arrives in Migration #6), else `app_settings.free_storage_mb * 1024 * 1024`. For now reads free cap only — will be amended.

## Triggers

- `voice_memos` INSERT/UPDATE/DELETE → `touch_song_activity`
- `voice_memos` AFTER INSERT (status=`ready`) and AFTER UPDATE OF status/byte_size → `apply_storage_delta` based on diff (positive on become-ready, negative on delete/become-failed)
- `voice_memos` AFTER DELETE → `apply_storage_delta(owner, -byte_size)` if previously ready
- `updated_at` triggers on all three new tables

Storage charge is counted against the **song owner**, not the uploading member (per memory). Trigger fetches owner via `songs.owner_user_id`.

## GRANTs

All three tables:
- `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated`
- `GRANT ALL TO service_role`
- No `anon`.

`storage_usage` SELECT is owner-only (RLS); INSERT/UPDATE go through service role.

## RLS policies

### `voice_memos`
- SELECT: `is_song_member(song_id, auth.uid())`
- INSERT: `is_song_member(song_id, auth.uid()) AND author_user_id = auth.uid()`
- UPDATE: author or song owner; cannot change `song_id` / `author_user_id` / `byte_size` (enforced by trigger guard)
- DELETE: author or song owner

### `voice_memo_transcripts`
- SELECT: `is_song_member(song_id, auth.uid())`
- INSERT/UPDATE: service role only (edge function writes transcripts); no authenticated policy → effectively read-only for users
- DELETE: cascades from memo

### `storage_usage`
- SELECT: `user_id = auth.uid()`
- All writes: service role only

## Indexes

- `voice_memos(song_id, created_at desc)`
- `voice_memos(section_id)` partial where `section_id is not null`
- `voice_memos(author_user_id)`
- `voice_memo_transcripts(song_id)`
- `voice_memo_transcripts(status)` partial where `status in ('pending','processing')` (for the worker)

## Realtime

- `voice_memos`, `voice_memo_transcripts` → `REPLICA IDENTITY FULL` + add to `supabase_realtime` so the section UI updates when a memo finishes uploading or its transcript becomes ready.

## Storage

- Create private bucket `voice-memos` via `supabase--storage_create_bucket(name="voice-memos", public=false)`.
- RLS on `storage.objects`:
  - SELECT/INSERT/UPDATE/DELETE for `authenticated` only when `bucket_id = 'voice-memos'` AND `is_song_member((storage.foldername(name))[2]::uuid, auth.uid())` (path layout: `{owner}/{song_id}/{memo}.{ext}`)
  - Full access for `service_role`
- All client playback goes through signed URLs minted by the `voice-memo-signed-url` edge function (5-minute TTL). No public reads.

## Edge functions

Three Deno functions, all with CORS and JWT validation:

### `voice-memo-upload-url`
- Auth: requires logged-in user
- Input: `{ song_id, section_id?, mime_type, byte_size, duration_ms?, title? }`
- Validates: caller is `is_song_member(song_id)`, `mime_type` in allowlist (`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg`), `byte_size <= 50 MB`, and `(owner.bytes_used + byte_size) <= effective_storage_limit(owner)` → returns 413 if over cap
- Creates a `voice_memos` row (`status=uploading`) and returns a Supabase Storage signed upload URL for `{owner}/{song_id}/{memo_id}.{ext}` plus the memo id

### `voice-memo-finalize`
- Auth: required; caller must be the memo author or song owner
- Input: `{ memo_id, actual_byte_size, duration_ms?, waveform_peaks? }`
- Verifies object exists in bucket and matches size, flips memo to `status=ready`, enqueues transcription by inserting a `voice_memo_transcripts` row with `status='pending'`, then invokes `voice-memo-transcribe` asynchronously
- Storage delta trigger fires automatically when status becomes `ready`

### `voice-memo-transcribe`
- Service-role only (called server-to-server)
- Input: `{ memo_id }`
- Flow: download object via service-role client → POST audio to Lovable AI Gateway with `google/gemini-2.5-flash` (multimodal audio input) → write `text` + `segments` back to `voice_memo_transcripts` with `status='ready'`, or `status='failed'` + `error` on exception
- No user content sent to third parties — only the Lovable AI Gateway (per memory)
- Retry: on failure, leave row as `failed`; manual retry exposed via a separate `voice-memo-retranscribe` later

### `voice-memo-signed-url`
- Auth: required; caller must be `is_song_member`
- Input: `{ memo_id }`
- Returns a 5-minute signed download URL for playback

## SDK additions (`src/integrations/cog/`)

Tiny typed wrappers (no UI):
- `memos.ts` — `createUploadUrl`, `finalizeUpload`, `getPlaybackUrl`, `listForSong`, `listForSection`, `deleteMemo`, `subscribeMemos(songId, cb)`
- `storage.ts` — `getStorageUsage()`, `getEffectiveLimit()`

Hooks return React Query results and zod-validated payloads. Claude consumes these — never reaches into Supabase directly.

## What is NOT in this migration

- Layered/overdub memos — open question, leave for later
- Per-memo "smart summary" / mood tagging — Phase 4 canvas PDF read still pending
- Storage add-on purchases — Stripe migration
- Pro plan storage cap — pending plans table in Migration #6 (`effective_storage_limit` returns free cap until then)
- Section vs room scoping UI semantics — Claude's call

## Sequence

1. Migration creating enums, tables, helpers, RLS, indexes, realtime, storage-usage triggers
2. `supabase--storage_create_bucket` for `voice-memos` (private)
3. Second migration: RLS policies on `storage.objects` for the new bucket
4. Deploy four edge functions
5. Add SDK files under `src/integrations/cog/`
6. Run linter; expected new SECURITY DEFINER warnings (4–5) for the storage/transcript helpers — same intentional pattern as previous migrations

After approval I'll work through these steps in order, pausing only if a step needs your input (e.g. if a non-default behavior shows up).
