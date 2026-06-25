// "New since you last opened" — the returning-user loop for the Memory surface.
//
// Pure recency split (fully testable) + per-user last-seen storage. No backend:
// the baseline timestamp lives in localStorage on the user's own device, so the
// feature is free and private. ISO-8601 timestamps compare lexicographically.

import type { MemorySong } from "./memoryTypes";

function songTime(song: MemorySong): string {
  return song.lastActivityAt ?? song.createdAt ?? "";
}

/**
 * Songs touched strictly after `sinceISO`, newest first. Returns [] when there
 * is no baseline (a first visit shouldn't flag everything as "new").
 */
export function freshSongs(songs: MemorySong[], sinceISO: string | null): MemorySong[] {
  if (!sinceISO) return [];
  return songs
    .filter((s) => songTime(s) > sinceISO)
    .sort((a, b) => songTime(b).localeCompare(songTime(a)));
}

const lastSeenKey = (userId: string) => `cog:memory:lastseen:${userId}`;

/** Read the prior visit timestamp for this user, or null. */
export function loadLastSeen(userId: string): string | null {
  try {
    return localStorage.getItem(lastSeenKey(userId));
  } catch {
    return null;
  }
}

/** Stamp the current visit timestamp for this user. */
export function saveLastSeen(userId: string, iso: string): void {
  try {
    localStorage.setItem(lastSeenKey(userId), iso);
  } catch {
    /* storage unavailable (private mode) — the feature just stays quiet */
  }
}
