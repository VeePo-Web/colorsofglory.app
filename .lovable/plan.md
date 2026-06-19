
# Step 3 — Realtime + Activity Layer for the Song Room

Backend + thin SDK. Gives every song room a typed event stream so collaborators see changes live and returning users get a "what changed since you left" recap.

## Schema discoveries that shape the plan
- No `activity` table exists yet. `audit_logs` exists but is admin/billing scoped — not safe to overload.
- `song_notification_prefs` exists; we'll add `last_seen_at` there rather than creating a new table.
- Writers we'll instrument: `commit-take`, `promote-capture` (new), `intake-voice-memo`, `voice-memo-finalize`, `song-invite-accept`, `song-leave`, `song-transfer-owner`, plus the 7 canvas RPCs from Step 1. All happen through edge functions or SECURITY DEFINER RPCs, so a single shared helper covers them.
- `touch_song_activity()` already bumps `songs.last_activity_at` on memo writes — we'll extend the pattern.

## Deliverables

### 1. Migration — `song_activity` table + helpers
- `CREATE TABLE public.song_activity` with columns: `id uuid pk default gen_random_uuid()`, `song_id uuid not null references songs(id) on delete cascade`, `actor_user_id uuid not null references auth.users(id) on delete set null`, `kind text not null`, `entity_type text not null`, `entity_id uuid null`, `payload jsonb not null default '{}'::jsonb` (IDs + event metadata only — never lyric/memo content per Core rule), `created_at timestamptz not null default now()`.
- Indexes: `(song_id, created_at desc)`, `(song_id, actor_user_id, created_at desc)`.
- GRANTs: `SELECT` to `authenticated`, `ALL` to `service_role`. No INSERT for authenticated — only SECURITY DEFINER writes.
- RLS: `ENABLE`; one SELECT policy `using (is_song_member(song_id, auth.uid()))`. No INSERT/UPDATE/DELETE policies (locked from clients).
- Allowed `kind` values defined via CHECK: `take_committed | capture_created | capture_promoted | memo_uploaded | memo_finalized | memo_transcribed | invite_accepted | member_left | owner_transferred | card_moved | card_linked | card_unlinked | card_grouped | card_section_set | card_promoted_final | card_deleted`.
- Helper `public.log_song_activity(_song_id, _kind, _entity_type, _entity_id, _payload)` SECURITY DEFINER; no-op if `_song_id` null; uses `auth.uid()` as actor (falls back to NULL).
- Helper `public.list_song_activity_since(_song_id uuid, _since timestamptz, _limit int default 200)` returns grouped digest: `(kind text, actor_user_id uuid, count int, last_at timestamptz, sample_entity_ids uuid[])`. Membership-gated; raises `not_a_member` if caller isn't on the song.
- Helper `public.mark_song_seen(_song_id uuid)` UPSERTs `(_song_id, auth.uid(), last_seen_at=now())` into `song_notification_prefs`.
- `ALTER TABLE song_notification_prefs ADD COLUMN IF NOT EXISTS last_seen_at timestamptz` (if not present).

### 2. Migration — Realtime publication
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.song_activity, public.canvas_cards, public.takes, public.idea_captures` (skip duplicates with DO blocks).
- `ALTER TABLE … REPLICA IDENTITY FULL` on each so DELETE payloads carry song_id for client-side filtering.
- Confirm RLS exists on each so Realtime respects per-song access.

### 3. Retro-fit writers — single shared helper
- All seven Step 1 canvas RPCs get a `PERFORM public.log_song_activity(...)` line at the end of their bodies. Done in this same migration (re-issue `CREATE OR REPLACE` for each).
- Edge functions that already use `_shared/auth.ts` get a tiny `_shared/activity.ts` helper:
  ```ts
  export async function logActivity(admin, args: {song_id, kind, entity_type, entity_id?, payload?})
  ```
  Wired into:
  - `promote-capture` → `capture_promoted`
  - `commit-take` → `take_committed`
  - `intake-voice-memo` → `memo_uploaded`
  - `voice-memo-finalize` → `memo_finalized`
  - `voice-memo-transcribe-worker` (or sibling) → `memo_transcribed`
  - `song-invite-accept` → `invite_accepted`
  - `song-leave` → `member_left`
  - `song-transfer-owner` → `owner_transferred`
- Each writer passes IDs only — never lyric body, memo title, or transcript text.

### 4. SDK additions
- `src/integrations/cog/activity.ts` (new or extend existing):
  - `type SongActivityKind` union.
  - `listActivitySince(song_id, since): Promise<DigestRow[]>` → calls the new RPC.
  - `markSongSeen(song_id): Promise<void>` → calls the new RPC.
- `src/integrations/cog/realtime.ts` (new):
  - `subscribeSongRoom(song_id, handlers): () => void` — wraps `supabase.channel('song:'+id)` and routes postgres_changes events from `song_activity`, `canvas_cards`, `takes`, `idea_captures` (all filtered `song_id=eq.${id}`) to typed handlers `{ onActivity, onCardChange, onTakeChange, onCaptureChange }`. Returns an unsubscribe fn that calls `supabase.removeChannel`.
- No UI files touched.

### 5. Edge function `digest-recap`
- Input: `{ song_id, since }`. Auth-gated, member-checked.
- Loads `list_song_activity_since` rows; resolves actor display names from `profiles`.
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with a strictly-IDs+counts prompt — no lyric, memo, or scripture text included. Output: one short paragraph.
- Returns `{ digest: string, rows: DigestRow[] }`.
- Logs the exact prompt at debug level (with a `NEVER_INCLUDE_CONTENT=true` assertion fence) so we can audit.
- SDK: `getRecapDigest(song_id, since)` in `activity.ts`.

### 6. Acceptance
- After Step 1 RPC call, a row appears in `song_activity` with the right `kind` and `actor_user_id`.
- `list_song_activity_since` returns grouped counts for a burst of mixed kinds.
- Realtime test: subscribe in one shell via `curl_edge_functions`-driven WS isn't feasible — instead, verify publication membership with `select * from pg_publication_tables where pubname='supabase_realtime'`.
- `digest-recap` returns a sentence; manual prompt log inspection shows zero lyric/memo content.
- Linter clean; no new "Public Can Execute SECURITY DEFINER" warnings (new fns explicitly `REVOKE EXECUTE … FROM PUBLIC, anon`).

## Out of scope
- Presence avatars + UI toasts (Claude).
- Per-user notification preferences screen.
- Email/push notification fan-out (a future Step would add `pg_net` + a notify-worker).

## Risk notes
- Writer retro-fit touches several edge functions. To keep each change small, I'll patch one function per edit pass and validate the function still compiles before moving to the next.
- `digest-recap` prompt: hard-coded allow-list of fields passed to the model; a unit-style assertion in code throws if anything outside the allow-list slips into the prompt object.

Reply "go" to build Step 3.
