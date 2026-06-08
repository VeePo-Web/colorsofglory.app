/**
 * Activity feed — re-exported under the names the Catalog/Workspace handoff
 * doc promised Claude. Payloads are IDs + event kinds only (no raw lyric
 * or memo content) — that's a hard product rule.
 */
export type { SongActivityRow as ActivityEvent } from "./songs";
export { getSongActivity as getRecentActivity } from "./songs";

import { getSongActivity, type SongActivityRow } from "./songs";

/** Convenience filter: activity newer than a given ISO timestamp. */
export async function getActivitySince(
  songId: string,
  sinceISO: string | null,
): Promise<SongActivityRow[]> {
  const all = await getSongActivity(songId, 50, 0);
  if (!sinceISO) return all;
  const since = new Date(sinceISO).getTime();
  return all.filter((row) => new Date(row.created_at).getTime() > since);
}