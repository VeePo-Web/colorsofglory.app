# Handoff — Share-Sheet Intake (Pattern 4)

_Backend: edge function `intake-voice-memo` shipped. SDK: `src/integrations/cog/intake.ts`._

## Track A — Web Share Target (PWA, ships today)

### 1. Manifest
Add to `public/manifest.webmanifest`:
```json
"share_target": {
  "action": "/share-receive",
  "method": "POST",
  "enctype": "multipart/form-data",
  "params": {
    "title": "title",
    "text": "text",
    "files": [{ "name": "audio", "accept": ["audio/*"] }]
  }
}
```

### 2. Route `/share-receive`
New page `src/pages/ShareReceive.tsx`:
- Reads incoming `FormData` via a service-worker bridge OR reconstructs from the POST in a small `fetch` handler. Simplest path: register a SW that intercepts `POST /share-receive` and forwards the file via `BroadcastChannel` to the page.
- Page UI: "Where should this go?" → picker of user's songs (use `listMySongs()` from `@/integrations/cog/songs`).
- On select → `submitSharedAudio({ file, song_id, title })` from `@/integrations/cog/intake`.
- On success → redirect to `/song/:id/voice?memo=<voice_memo_id>`.

### 3. Validation done server-side
- Auth via Bearer JWT (caller must be signed in).
- mime `audio/*`, size ≤ 50 MB, song membership via `is_song_member` RPC.
- Uploads to `voice-memos/<song_id>/<user_id>/shared/<uuid>.<ext>`, creates `voice_memos` row + primary `takes` row in one shot.

## Track B — Native iOS Share Extension (deferred)

Requires Capacitor + custom Swift extension that hands the file URL + bearer token to JS. Bridge interface (when built):
```ts
window.cog?.shareIntake?.({ filePath: string, mimeType: string, title?: string });
```
The handler should `fetch` the file as a Blob then call the same `submitSharedAudio` SDK function.

## Known limitation
`voice_memos.song_id` is currently NOT NULL, so an "Unfiled Inbox" (no song) is not supported via this intake. The picker MUST require a song. A future migration will add nullable song_id + a per-user Inbox view; `listInboxItems` returns `[]` until then.