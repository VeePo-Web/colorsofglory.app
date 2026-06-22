# Handoff → Lovable: `restore_song_version` RPC (Version History)

**From:** Collaboration & Song Memory lane (5th Claude)
**Date:** 2026-06-21
**Why:** I shipped the Version History UI at `/songs/:id/versions` (frontend-only). It reads the existing
`song_versions` table fine. **Restore must be server-authoritative + additive** (Product Vision 09) — the
client must never assemble a new current version from raw snapshot state. The UI calls an RPC that does not
exist yet; until it does, the screen degrades calmly ("Restore is coming soon — your version history is safe.").

## The contract the frontend already calls
`src/integrations/cog/versions.ts` → `restoreSongVersion(songId, versionId)` invokes:

```
supabase.rpc("restore_song_version", { _song_id: <uuid>, _version_id: <uuid> })
```

Expected return (single row or array of one):
```
{ new_version_id: uuid, new_version_number: int }
```

## Required server behavior (PV09 non-negotiables)
1. **Additive, never destructive.** Insert a NEW `song_versions` row whose `snapshot` = the selected version's
   snapshot, `kind = 'restore_point'`, `version_number = next_song_version_number(_song_id)`,
   `parent_version_id = _version_id`, `created_by_user_id = auth.uid()`. The prior current draft stays in
   history untouched. Return the new row's id + number.
2. **Owner-gated, server-side.** `SECURITY DEFINER` + verify `auth.uid()` is the song **owner** (the UI already
   hides Restore for non-owners, but the server is the authority). Reject others with a clean error.
3. **Conflict safety.** If the song changed since the user opened history, the restore should still be safe
   (it's additive) — but consider stamping the restore so "Someone edited this song just now" can be surfaced
   later. Not required for v1.
4. **Apply the snapshot to the live song** if the app keeps a separate "current draft" outside `song_versions`
   (lyrics/sections/etc.). If `song_versions` IS the source of truth, step 1 is sufficient.
5. **Audit.** Log restore actor + source version + new version + timestamp (your audit table), per PV09.

## Error codes I handle gracefully
- RPC missing (42883 / PGRST202 / "function … does not exist") → UI shows "coming soon" + history stays safe.
- Any other error → "We could not restore that version. Please try again." (current draft preserved.)

No frontend change needed once the RPC ships — the contract is already wired. Ping this lane if you change the
param names or return shape and I'll update `versions.ts`.
