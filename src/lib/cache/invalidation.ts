/**
 * Cache-invalidation policy (A4 · client state).
 *
 * The ONE place that maps a mutation to the query keys it must invalidate. No
 * feature component should call queryClient.invalidateQueries() ad hoc — it calls
 * the matching helper here so the "what goes stale when X happens" rule lives in
 * a single, reviewable table. A3's mutation hooks call these in onSettled/onSuccess.
 */

import type { QueryClient } from "@tanstack/react-query";
import { qk, type QueryKey } from "./queryKeys";

/** The canonical mutation → keys map. Each entry returns the keys to invalidate. */
export const invalidationMap = {
  /** A recorded take was committed into a song. */
  commitTake: (songId: string): QueryKey[] => [
    qk.songDetail(songId),
    qk.canvas(songId),
    qk.activity(songId),
    qk.memos(songId),
  ],
  /** A quick capture landed in a song. */
  quickCapture: (songId: string): QueryKey[] => [
    qk.captures(songId),
    qk.songDetail(songId),
  ],
  /** Lyrics / chords / notes edited in a room. */
  editRoom: (songId: string): QueryKey[] => [
    qk.songDetail(songId),
    qk.canvas(songId),
    qk.activity(songId),
  ],
  /** A collaborator joined / role changed. */
  membershipChanged: (songId: string): QueryKey[] => [
    qk.members(songId),
    qk.songDetail(songId),
    qk.activity(songId),
  ],
  /** An invite was accepted — the catalog gains a song. */
  acceptInvite: (): QueryKey[] => [qk.songs()],
  /** A song was created — catalog + billing quota both move. */
  createSong: (): QueryKey[] => [qk.songs(), qk.billing()],
  /** A song was deleted / archived / left. */
  removeSong: (songId: string): QueryKey[] => [qk.songs(), qk.billing(), qk.song(songId)],
  /**
   * Canvas node move — TARGETED, never the whole board. Only the canvas view
   * (positions) goes stale, not the song detail counts.
   */
  moveNode: (songId: string): QueryKey[] => [qk.canvas(songId)],
} as const;

export type MutationName = keyof typeof invalidationMap;

/** Invalidate the documented key set for a mutation. */
export function invalidateFor(client: QueryClient, keys: QueryKey[]): Promise<void> {
  return Promise.all(
    keys.map((queryKey) => client.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}
