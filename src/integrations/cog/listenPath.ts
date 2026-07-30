/**
 * LISTEN PATH data seam (R25 · "Press play and hear the whole song").
 *
 * One saved playback order per song: an ordered list of sections and voice
 * takes. Read is a single RPC (`song_listen_path`) that returns the order
 * already resolved with labels, take names and durations. Write is a single
 * whole-list save (`save_listen_path`) — no per-item churn, no drift.
 *
 * Server rules (enforced in Postgres):
 *  - read requires song membership
 *  - write requires owner/collaborator (viewers can play, not reorder)
 *  - stale items (deleted takes/sections) are dropped on save
 *  - every save is activity-logged with counts only, never content
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type ListenPathKind = "take" | "section";

/** What you send when saving. Exactly one of takeId / sectionId per item. */
export interface ListenPathInput {
  kind: ListenPathKind;
  takeId?: string | null;
  sectionId?: string | null;
}

/** What you get back, resolved for the player. */
export interface ListenPathItem {
  position: number;
  kind: ListenPathKind;
  section_id: string | null;
  take_id: string | null;
  section_label: string | null;
  take_name: string | null;
  duration_ms: number | null;
  storage_path: string | null;
  take_archived: boolean | null;
}

export interface ListenPathBoard {
  song_id: string;
  role: "owner" | "collaborator" | "viewer" | null;
  items: ListenPathItem[];
  total_duration_ms: number;
  updated_at: string | null;
}

const EMPTY = (songId: string): ListenPathBoard => ({
  song_id: songId,
  role: null,
  items: [],
  total_duration_ms: 0,
  updated_at: null,
});

/** Load the song's playback order in one request. */
export async function getListenPath(songId: string): Promise<ListenPathBoard> {
  const { data, error } = await supabase.rpc("song_listen_path", { _song_id: songId });
  if (error) throw toCogError(error);
  const board = (data ?? {}) as unknown as ListenPathBoard;
  return { ...EMPTY(songId), ...board, items: board.items ?? [] };
}

/** Save the whole order at once. Returns the re-resolved board. */
export async function saveListenPath(
  songId: string,
  items: ListenPathInput[],
): Promise<ListenPathBoard> {
  const payload = items.map((it) => ({
    kind: it.kind,
    take_id: it.kind === "take" ? it.takeId ?? null : null,
    section_id: it.kind === "section" ? it.sectionId ?? null : null,
  }));
  const { data, error } = await supabase.rpc("save_listen_path", {
    _song_id: songId,
    _items: payload as unknown as never,
  });
  if (error) throw toCogError(error);
  const board = (data ?? {}) as unknown as ListenPathBoard;
  return { ...EMPTY(songId), ...board, items: board.items ?? [] };
}

/** Only playable items (a take that still exists and isn't archived). */
export function playableItems(items: ListenPathItem[]): ListenPathItem[] {
  return items.filter((i) => i.take_id && i.storage_path && !i.take_archived);
}

/** "4:12" from a millisecond total. */
export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}