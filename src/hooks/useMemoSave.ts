/**
 * The ONE memo-save hook (A3 · data access · Step 7).
 *
 * Every voice take the app saves goes through this hook → `saveMemoDurable` →
 * `enqueueCaptureUpload` (the Capture Outbox) → a single registered uploader →
 * the ONE upload core in `cog/memos.uploadVoiceMemo`. The three formerly-parallel
 * uploaders have collapsed:
 *   - `lib/voice/voiceApi.uploadVoiceMemo` now DELEGATES to `cog/memos`;
 *   - the outbox default ("voiceApi") uploader calls voiceApi → the same core;
 *   - the brainstorm ("memos") uploader calls the same core directly.
 * So there is exactly one place a take is put on the wire, and exactly one
 * durable entry point (this hook) for the UI.
 *
 * THE SACRED PROMISE (why this is a hook, not a bare fn): the moment
 * `mutate`/`mutateAsync` resolves, the take is durable — the blob is in the
 * device cache and a content-free job is queued BEFORE any network call. A
 * dropped connection, a killed tab, or a QUOTA_EXCEEDED_STORAGE does NOT lose or
 * discard it: the outbox RETAINS the take and auto-retries on reconnect, on a
 * heartbeat, and at next app load ("Saved · will sync"). `mutation.data` carries
 * the optimistic card (with real waveform peaks already) to render instantly.
 *
 * Do NOT call `uploadVoiceMemo` / `saveMemoDurable` / `enqueueCaptureUpload`
 * directly from a surface — that bypasses the mutation state and the cache
 * bridge below. Use this hook.
 */

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/hooks/queryKeys";
import { subscribeOutbox } from "@/lib/voice/captureOutbox";
import {
  saveMemoDurable,
  type SaveMemoParams,
  type SaveMemoResult,
} from "@/lib/voice/saveMemo";

export function useMemoSave() {
  const client = useQueryClient();

  // Cache bridge: when a queued take actually LANDS on the server, refresh the
  // cache-backed reads for its song so the optimistic/queued card is replaced by
  // the real memo and the hub counts + catalog ordering catch up. Best-effort —
  // a mounted song room also reconciles via realtime (`subscribeMemos`). A
  // dropped upload or a QUOTA_EXCEEDED_STORAGE never reaches here: the outbox
  // keeps the take and retries, so the read layer is only nudged on real success.
  useEffect(() => {
    return subscribeOutbox((event) => {
      if (event.type !== "success") return;
      const { songId } = event;
      void client.invalidateQueries({ queryKey: qk.memos(songId) });
      void client.invalidateQueries({ queryKey: qk.songDetail(songId) });
      void client.invalidateQueries({ queryKey: qk.songs() });
    });
  }, [client]);

  // The save itself resolves at ENQUEUE time (durable + optimistic), not at
  // sync time — that instant resolution is the whole point.
  return useMutation<SaveMemoResult, Error, SaveMemoParams>({
    mutationFn: (params) => saveMemoDurable(params),
  });
}
