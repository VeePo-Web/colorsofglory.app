import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

/**
 * R34 — nothing you remove is gone.
 *
 * Every "remove" in the room is an archive, never a delete. This is the one
 * place that shows the last 30 days of removed things across all four kinds
 * (idea cards, notes, captures, set-aside takes) and puts any of them back.
 */

export type RemovedKind = "card" | "note" | "capture" | "take";

export type RemovedItem = {
  kind: RemovedKind;
  id: string;
  title: string;
  removed_at: string;
  removed_by: { user_id: string; name: string; avatar_color: string | null } | null;
  is_you: boolean;
};

export type RecentlyRemoved = { song_id: string; rows: RemovedItem[] };

export async function fetchRecentlyRemoved(
  songId: string,
  limit = 50,
): Promise<RecentlyRemoved> {
  const { data, error } = await (supabase as any).rpc("song_recently_removed", {
    _song_id: songId,
    _limit: limit,
  });
  if (error) {
    if (String(error.message).includes("forbidden"))
      throw new Error("You're not in this song.");
    throw toCogError(error);
  }
  return data as RecentlyRemoved;
}

export async function restoreItem(
  songId: string,
  kind: RemovedKind,
  id: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc("restore_song_item", {
    _song_id: songId,
    _kind: kind,
    _id: id,
  });
  if (error) {
    const m = String(error.message);
    if (m.includes("item_not_found")) throw new Error("That one is already back.");
    if (m.includes("forbidden") || m.includes("write"))
      throw new Error("You don't have edit access to this song.");
    throw toCogError(error);
  }
}

/** Copy for the row: "Note · removed by Sarah". */
export function removedByLabel(item: RemovedItem): string {
  if (item.is_you) return "you removed this";
  return item.removed_by ? `${item.removed_by.name} removed this` : "removed";
}
