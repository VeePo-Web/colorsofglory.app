# Handoff → Canvas lane: route the "record over this" layer save through the Capture Outbox

**From:** Capture lane (`feat/capture-outbox-reliability`)
**Date:** 2026-06-23
**Why:** The recorded **layer** save in `src/components/canvas/SongCanvasExperience.tsx` is the **last unprotected recorded-take path** in the app. It calls `uploadVoiceMemo(...)` directly, so a dropped/offline upload **permanently loses the layer take** the songwriter just sang. Every other recorded path (in-song record, file import, brainstorm) now goes through the Capture Outbox and is cache-first + auto-retrying. This file is owned by the canvas lane and is actively modified there — so this is a handoff, not an edit.

## The change (one call swap)

In `SongCanvasExperience.tsx`, find the layer/voice save that currently does:

```ts
const memoId = await uploadVoiceMemo({
  songId,
  blob,
  mimeType,
  durationMs,
  title,
  sectionLabel,
  parentMemoId,   // the base memo this layers over ("record over this")
  // ...
});
```

Replace the direct upload with an outbox enqueue:

```ts
import { enqueueCaptureUpload, subscribeOutbox } from "@/lib/voice/captureOutbox";

const { outboxId } = await enqueueCaptureUpload({
  blob,
  songId,
  title,
  mimeType,
  durationMs,
  sectionLabel,        // keep whatever you pass today; required by the signature
  parentMemoId,        // the outbox carries this straight through to voiceApi.uploadVoiceMemo
});
// Show your optimistic layer card keyed by `outboxId` and DO NOT remove it on failure.
```

The outbox uses the **same** `voiceApi.uploadVoiceMemo` pipeline you call today (the default uploader), so nothing changes on the happy path — `parentMemoId` is passed straight through. The only difference: the blob is cached to IndexedDB **before** the network call, and the upload **auto-retries** on reconnect instead of throwing the take away.

## Reconcile the optimistic card (same pattern the voice page uses)

```ts
useEffect(() => {
  const unsub = subscribeOutbox((e) => {
    if (e.type === "change") return;
    if (e.songId !== songId) return;
    if (e.type === "success") {
      // remove the optimistic card (id === e.outboxId) and refetch the real memo;
      // the blob is already cached under e.memoId for instant playback.
    } else if (e.type === "failed") {
      // keep the card; mark it calmly as "Saved · will sync" (gold, not red).
    }
  });
  return unsub;
}, [songId]);
```

## Notes
- No backend change. No new dependency.
- Optional: mount `@/components/voice/OutboxSyncPill` somewhere in the canvas chrome for the cross-app "Syncing N ideas…" reassurance (already used on the Voice Memos + Brainstorm pages).
- After this, **every** recorded-take path in the app is lossless. That's the north star reached.

Ping the capture lane if the layer save passes any field `enqueueCaptureUpload` doesn't cover yet — the outbox is the shared primitive and can grow a field (or use `uploaderKey` + `extra` for a fully custom pipeline, as the brainstorm page does).
