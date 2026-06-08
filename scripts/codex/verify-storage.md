# Codex — Storage verification checklist

Run this once Claude has wired the avatar upload UI and the voice memo recorder.

## Buckets (all private — workspace blocks public)
- [ ] `avatars` exists, private. Read via signed URL only.
- [ ] `voice-memos` exists, private. Read/write only by song members.
- [ ] `exports` exists, private. Read/write only by song owner.

## RLS on storage.objects
- [ ] `Authenticated can read avatars` (SELECT)
- [ ] `Users can write/update/delete own avatar` (path prefix = `auth.uid()::text/...`)
- [ ] `Members can read/upload/update/delete voice memo files` — all gated by `public.is_song_member(<song_id>, auth.uid())`
- [ ] `Owners can read/write/update/delete own exports` — gated by `public.is_song_owner(<song_id>, auth.uid())`

## Edge functions
- [ ] `voice-memo-upload-url` returns a signed upload URL only when caller is a song member with write role (Owner / Contributor).
- [ ] `voice-memo-signed-url` returns a short-lived (≤ 5 min) signed read URL only for song members.
- [ ] `voice-memo-finalize` writes `voice_memos` row AND calls `apply_storage_delta` so bytes count against the **song owner's** `storage_usage`, not the uploader.
- [ ] `voice-memo-delete` reverses the delta on the owner's usage.

## Quota gates
- [ ] `can_upload_bytes(owner, bytes)` returns false when `storage_usage + bytes > effective_storage_limit(owner)`.
- [ ] Pro / Founder Pro plans bypass the free cap.

## Smoke test (Parker as admin)
1. Sign in as `parker@veepo.ca`.
2. Create a song. Upload a 5-second voice memo.
3. Confirm `voice_memos` row exists, `storage_usage.bytes_used` for Parker increased, and the playback signed URL works for ≤ 5 min and 404s after expiry.
4. Invite a Viewer collaborator → confirm they can fetch the signed URL but cannot upload.