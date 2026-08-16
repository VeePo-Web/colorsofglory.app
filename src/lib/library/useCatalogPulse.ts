import { useQuery } from "@tanstack/react-query";
import { getCatalogBoard } from "@/integrations/cog/catalog";
import { activitySentence } from "@/components/activity/activityCopy";
import { relativeDate } from "@/lib/library/format";

export interface SongPulse {
  /** Activity by OTHERS since you last opened the song — the Drive dot. */
  unseen: number;
  /** "Sarah · 2h ago" — who touched the song last, when it wasn't you. */
  line: string | null;
  /** The full sentence ("Sarah added a voice memo") — tooltip/aria. */
  sentence: string | null;
}

/**
 * The shelf's activity truth (the Google-Drive standard: a shared folder
 * tells you WHO touched what, and what you haven't seen yet).
 *
 * Reads the deployed-but-dormant `song_catalog_board` RPC — one request for
 * every song's last event (with the actor's name) + your per-song unseen
 * count, computed server-side against `last_seen_at` (which the room's
 * recap flow already maintains, so dots clear themselves when you walk in).
 * Best-effort: on any failure the shelf simply shows its plain dates.
 */
export function useCatalogPulse(enabled: boolean) {
  const query = useQuery({
    queryKey: ["catalog-pulse"],
    enabled,
    // Always refetch on mount: walking into a room clears last_seen_at server-
    // side, so returning to the shelf must re-ask or a cleared dot lingers.
    // One cheap RPC per catalog visit.
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: () => getCatalogBoard(200),
    retry: 1,
  });

  const bySong = new Map<string, SongPulse>();
  for (const row of query.data?.songs ?? []) {
    const actor = row.last_event?.actor_name?.trim() || null;
    bySong.set(row.id, {
      unseen: row.unseen_count ?? 0,
      line:
        actor && row.last_event
          ? `${actor.split(/\s+/)[0]} · ${relativeDate(row.last_event.created_at)}`
          : null,
      sentence: row.last_event ? activitySentence(row.last_event.kind, actor) : null,
    });
  }

  return { bySong, totalUnseen: query.data?.total_unseen ?? 0 };
}
