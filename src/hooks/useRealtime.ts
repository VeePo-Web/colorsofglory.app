/**
 * Realtime → invalidation hooks (A3 · data access · Step 8).
 *
 * These wrap the seam's realtime primitives (`cog/realtime.ts`, `cog/memos.ts`)
 * as React hooks whose ONLY job is to INVALIDATE the right cached queries when a
 * remote change lands. They never stream content into the UI: the channel
 * carries a table + event kind (IDs only), and the fresh content is re-read by
 * whatever `useAppQueries` hook is observing the invalidated key. A remote edit
 * therefore re-renders the correct screen through React Query's refetch — not by
 * pushing a row straight into component state.
 *
 * The payloads are DELIBERATELY unused. Reading `payload.new`/`payload.old` here
 * would smuggle content down the realtime path and split the source of truth;
 * every handler drops the payload on the floor and only maps the EVENT to a set
 * of `qk` keys. That is the whole contract: realtime says "something under key K
 * changed", the query owns "what it now is".
 *
 * Cleanup: each primitive returns an unsubscribe that calls
 * `supabase.removeChannel`; the `useEffect` returns it directly, so a remount
 * tears the old channel down before opening a new one — no leaked/duplicate
 * channels. Keying the effect on the id means a song/user switch also cycles.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk, type QueryKey } from "@/hooks/queryKeys";
import { subscribeBilling, subscribeSongRoom } from "@/integrations/cog/realtime";
import { subscribeMemos } from "@/integrations/cog/memos";

/**
 * Live the whole Song Room off one channel. Any remote activity / card / take /
 * capture change quietly invalidates the query that owns that slice, plus the
 * song-detail counts that feed the hub badges. No toasts, no badges, no
 * streamed rows — React Query reconciles the affected view in place.
 *
 * change → invalidation mapping:
 *   onActivity      → activity(id)  [+ digest via prefix], songDetail(id)
 *   onCardChange    → canvas(id),   songDetail(id)
 *   onTakeChange    → memos(id),    songDetail(id)
 *   onCaptureChange → captures(id), songDetail(id)
 */
export function useRealtimeSong(songId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!songId) return;

    const invalidate = (keys: QueryKey[]) => {
      for (const queryKey of keys) {
        void qc.invalidateQueries({ queryKey });
      }
    };

    const unsubscribe = subscribeSongRoom(songId, {
      // Content is intentionally ignored — we only learn THAT it changed.
      onActivity: () => invalidate([qk.activity(songId), qk.songDetail(songId)]),
      onCardChange: () => invalidate([qk.canvas(songId), qk.songDetail(songId)]),
      onTakeChange: () => invalidate([qk.memos(songId), qk.songDetail(songId)]),
      onCaptureChange: () => invalidate([qk.captures(songId), qk.songDetail(songId)]),
    });

    return unsubscribe;
  }, [songId, qc]);
}

/**
 * Live a song's voice-memo list. A remote memo insert/update/delete or a
 * transcript arriving invalidates the memo list (and the song-detail counts a
 * new memo bumps); the memo card's real content — waveform, transcript — is
 * re-read by `useMemos`, never carried on the channel.
 *
 * change → invalidation mapping:
 *   memo change       → memos(songId), songDetail(songId)
 *   transcript change → memos(songId)
 */
export function useRealtimeMemos(songId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!songId) return;

    const unsubscribe = subscribeMemos(songId, ({ event }) => {
      // `event` is only used to distinguish a transcript arrival from a memo
      // row change — never to read the memo itself.
      void qc.invalidateQueries({ queryKey: qk.memos(songId) });
      if (!event.startsWith("transcript:")) {
        void qc.invalidateQueries({ queryKey: qk.songDetail(songId) });
      }
    });

    return unsubscribe;
  }, [songId, qc]);
}

/**
 * Live the signed-in user's billing/plan. A subscription or storage-addon row
 * moving (an upgrade or top-up on another device) invalidates the plan +
 * billing + storage queries so the current device re-hydrates its gate state.
 * Replaces the ad-hoc `refetch()` channel that used to live inline in
 * `useSubscription` — same intent, now on the shared invalidate pattern.
 *
 * change → invalidation mapping:
 *   subscription change → subscription(userId), billing()
 *   storage change      → storage(), subscription(userId), billing()
 */
export function useRealtimeBilling(userId: string | null | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = subscribeBilling(userId, (kind) => {
      void qc.invalidateQueries({ queryKey: qk.subscription(userId) });
      void qc.invalidateQueries({ queryKey: qk.billing() });
      if (kind === "storage") {
        void qc.invalidateQueries({ queryKey: qk.storage() });
      }
    });

    return unsubscribe;
  }, [userId, qc]);
}
