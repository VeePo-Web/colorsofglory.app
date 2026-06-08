# Cog SDK slice — Songs / Activity / Members helpers for the Catalog + Workspace handoff

The handoff doc tells Claude to import `listMySongs`, `getSong`, `archiveSong`, `getRecentActivity`, `listMembers`, and `myRole`. Some pieces already exist in `src/integrations/cog/songs.ts` (`createSong`, `deleteSong`, `unarchiveSong`, `getSongActivity`, invites, notif prefs). This plan adds the missing pieces and exposes them under the names the handoff doc promised, without duplicating logic.

## Files

### 1. Extend `src/integrations/cog/songs.ts`
Add (do not remove or rename anything existing):

- `SongCard` type — minimal shape for the catalog grid:
  ```
  { id, title, cover_color, status, last_activity_at, my_role,
    voice_memo_count, collaborator_count }
  ```
- `SongDetail` type — full row + counts:
  ```
  { ...Song, my_role, counts: { sections, lyric_lines, voice_memos, notes, collaborators, pending_suggestions } }
  ```
- `listMySongs(): Promise<SongCard[]>` — query `songs` joined to `song_members` filtered to `auth.uid()`, status != 'deleted', ordered by `last_activity_at desc`. Uses a single RPC `list_my_songs()` (SECURITY DEFINER) — see migration below — so we get counts and `my_role` in one round trip instead of N+1.
- `getSong(id): Promise<SongDetail | null>` — calls RPC `get_song_detail(_song_id uuid)` (SECURITY DEFINER, gated by `is_song_member`). Returns null when not a member or not found.
- `archiveSong(song_id)` / `unarchiveSong(song_id)` — `archiveSong` updates `songs.status='archived'` via authenticated update (relies on existing owner-update RLS). `unarchiveSong` already exists; leave it.

### 2. New `src/integrations/cog/activity.ts`
Thin module that re-exports the activity API so Claude's imports match the handoff doc verbatim:
```ts
export type { SongActivityRow as ActivityEvent } from "./songs";
export { getSongActivity as getRecentActivity } from "./songs";
```
Add a helper `getActivitySince(songId, sinceISO)` that filters client-side from the RPC result (cheap; activity feed is small).

### 3. New `src/integrations/cog/members.ts`
```ts
export type SongMember = {
  user_id: string;
  role: "owner" | "collaborator" | "viewer";
  joined_at: string;
  display_name: string | null;
  avatar_color: string | null;
  initials: string;
};
export async function listMembers(songId): Promise<SongMember[]>
export async function myRole(songId): Promise<SongMember["role"] | null>
```
Both call a new RPC `list_song_members(_song_id)` SECURITY DEFINER, gated by `is_song_member`. `myRole` is just `list_song_members().find(m => m.user_id === auth.uid())?.role`, or a separate cheap RPC `my_song_role(_song_id)` returning a single text — I'll add the latter so the workspace header doesn't pull the full member list just to know the caller's role.

## Backend additions (migration + RLS)

Single migration creating four SECURITY DEFINER RPCs in `public`, all `STABLE`, `search_path = public`, executed only by `authenticated`:

1. `list_my_songs()` — returns `SongCard[]` for `auth.uid()`. Pulls counts with `LEFT JOIN LATERAL` subqueries against `voice_memos` and `song_members`.
2. `get_song_detail(_song_id uuid)` — returns one row with `Song.*`, `my_role`, and the 6 counts. Guarded by `is_song_member(_song_id, auth.uid())`; returns null otherwise.
3. `list_song_members(_song_id uuid)` — returns members joined to `profiles`. Guarded by `is_song_member`.
4. `my_song_role(_song_id uuid)` — returns `text` (role) or null. Thin wrapper over `song_role`.

Grants: `GRANT EXECUTE ... TO authenticated` on all four. No `anon` grant. No new tables, so no table-level GRANT/RLS work.

These RPCs return ONLY IDs, counts, names, colors — no lyric text, no memo content, in line with the "activity payloads use IDs + event kinds only" memory rule. Lyric text comes later through the dedicated lyrics SDK slice.

## What I am NOT doing

- Not touching `src/pages/**` or `src/components/**`.
- Not changing existing exports in `songs.ts`.
- Not adding a `pending_suggestions` table — the count comes from a placeholder `(SELECT 0)` until the suggestions feature lands; the field is in the type so Claude can render the slot without a future breaking change.
- Not building the lyrics or notes SDK — those land in their own handoffs.

## Verification after build

- `supabase--read_query` to spot-check each RPC returns expected shape for Parker.
- `supabase--linter` for any new `0028_anon_security_definer_function_executable` warnings (expected: none, because grants are `authenticated` only).
- Update `.lovable/plan.md` execution log.
