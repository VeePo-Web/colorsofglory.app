import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getActivitySince,
  getSongLastSeen,
  markSongSeen,
  type ActivityEvent,
} from "@/integrations/cog/activity";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { buildRecapDigest, type RecapEntry } from "./recapDigest";

/**
 * D3 collab: "what changed since you left" (Product 12).
 *
 * The visit anchor is a client-side timestamp per song — snapshotted on
 * mount, then advanced so a refresh mid-session stays quiet. When THIS device
 * has no local anchor (new phone, cleared cache) the server-side last_seen_at
 * is the fallback — the recap moment used to be suppressed exactly when it
 * mattered most. The read happens BEFORE mark_song_seen advances the value.
 *
 * Calm rules: nothing shows on a first visit, nothing shows when only YOU
 * changed things, at most 5 grouped lines, one snapshot per visit.
 */

const LAST_VISIT_KEY = (songId: string) => `cog:canvas-last-visit-${songId}`;

export function useCanvasRecap(songId: string, extraEvents?: ActivityEvent[]) {
  const { user } = useCurrentAccount();
  const [dismissed, setDismissed] = useState(false);

  // Snapshot the previous visit BEFORE advancing the anchor.
  // undefined = still resolving (may fall back to the server); null = truly
  // first visit anywhere → no recap.
  const [anchor, setAnchor] = useState<string | null | undefined>(() => {
    try {
      return localStorage.getItem(LAST_VISIT_KEY(songId)) ?? undefined;
    } catch {
      return undefined;
    }
  });

  // This visit becomes the next baseline (client + server, both non-fatal).
  // Order matters: the server anchor is READ first (new-device fallback),
  // only then advanced — otherwise mark_song_seen erases the very timestamp
  // the recap needs.
  useEffect(() => {
    if (!songId) return;
    let live = true;
    const hasLocal = (() => {
      try {
        return localStorage.getItem(LAST_VISIT_KEY(songId)) != null;
      } catch {
        return false;
      }
    })();
    (async () => {
      if (!hasLocal) {
        const serverSeen = await getSongLastSeen(songId).catch(() => null);
        if (live) setAnchor(serverSeen);
      }
      try {
        localStorage.setItem(LAST_VISIT_KEY(songId), new Date().toISOString());
      } catch {
        /* storage unavailable — recap simply won't trigger next time */
      }
      markSongSeen(songId).catch(() => {
        /* server last-seen stays best-effort */
      });
    })();
    return () => {
      live = false;
    };
  }, [songId]);

  const query = useQuery({
    queryKey: ["canvas-recap", songId, anchor],
    queryFn: () => getActivitySince(songId, anchor as string),
    // First visit anywhere (no anchor) or unresolved identity → no recap.
    enabled: Boolean(songId && typeof anchor === "string" && user?.id),
    staleTime: Infinity, // one snapshot per visit — never refetch mid-recap
    retry: false,
  });

  const items: RecapEntry[] = useMemo(() => {
    // Client-synthesized rows (amens) fold into the SAME anchor window and
    // digest, so "Sarah left 3 amens" groups beside her other changes — one
    // calm recap, never a second surface. Same gates as the server query:
    // a real anchor and a known identity (excludeUserId must be meaningful).
    const extras =
      typeof anchor === "string" && user?.id && extraEvents?.length
        ? extraEvents.filter((r) => r.created_at > anchor)
        : [];
    return buildRecapDigest([...(query.data ?? []), ...extras], {
      excludeUserId: user?.id,
      cap: 5,
    });
  }, [query.data, user?.id, anchor, extraEvents]);

  return {
    shouldShow: !dismissed && items.length > 0,
    items,
    dismiss: () => setDismissed(true),
  };
}
