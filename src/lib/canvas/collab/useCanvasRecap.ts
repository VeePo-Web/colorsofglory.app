import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActivitySince, markSongSeen } from "@/integrations/cog/activity";
import { useCurrentAccount } from "@/hooks/useCurrentAccount";
import { buildRecapDigest, type RecapEntry } from "./recapDigest";

/**
 * D3 collab: "what changed since you left" (Product 12).
 *
 * The visit anchor is a client-side timestamp per song — snapshotted on
 * mount, then advanced so a refresh mid-session stays quiet. The server-side
 * `mark_song_seen` RPC is also called (fire-and-forget) so E2's future
 * activity surfaces share the same last-seen truth.
 *
 * Calm rules: nothing shows on a first visit, nothing shows when only YOU
 * changed things, at most 5 grouped lines, one snapshot per visit.
 */

const LAST_VISIT_KEY = (songId: string) => `cog:canvas-last-visit-${songId}`;

export function useCanvasRecap(songId: string) {
  const { user } = useCurrentAccount();
  const [dismissed, setDismissed] = useState(false);

  // Snapshot the previous visit BEFORE advancing the anchor.
  const [anchor] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_VISIT_KEY(songId));
    } catch {
      return null;
    }
  });

  // This visit becomes the next baseline (client + server, both non-fatal).
  useEffect(() => {
    if (!songId) return;
    try {
      localStorage.setItem(LAST_VISIT_KEY(songId), new Date().toISOString());
    } catch {
      /* storage unavailable — recap simply won't trigger next time */
    }
    markSongSeen(songId).catch(() => {
      /* server last-seen is a nice-to-have until E2 consumes it */
    });
  }, [songId]);

  const query = useQuery({
    queryKey: ["canvas-recap", songId, anchor],
    queryFn: () => getActivitySince(songId, anchor),
    // First visit (no anchor) or unresolved identity → no recap.
    enabled: Boolean(songId && anchor && user?.id),
    staleTime: Infinity, // one snapshot per visit — never refetch mid-recap
    retry: false,
  });

  const items: RecapEntry[] = useMemo(
    () => buildRecapDigest(query.data ?? [], { excludeUserId: user?.id, cap: 5 }),
    [query.data, user?.id],
  );

  return {
    shouldShow: !dismissed && items.length > 0,
    items,
    dismiss: () => setDismissed(true),
  };
}
