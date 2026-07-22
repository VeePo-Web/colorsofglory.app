import type { ActivityEvent } from "@/integrations/cog/activity";
import { humanizeActivity } from "@/lib/canvas/collab/recapDigest";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";

/**
 * Circle — pure aggregation logic for the swipe-right return surface
 * (docs/CIRCLE-CONTRACT.md). The hearth, not a casino:
 *
 *  - Everything here is REAL — grouped cross-song activity by real people,
 *    since your last visit. No manufactured loops, no counts that spike,
 *    no variable reward. If nothing happened, Circle says nothing.
 *  - FINITE by construction: hard caps on every band, no pagination, no
 *    infinite scroll. You read it, you're done.
 *  - The privacy vocabulary is the fenced one: song title + display name +
 *    activity kind. Never content.
 *
 * No React, no network — unit-testable.
 */

export type CircleLine = {
  id: string;
  songId: string;
  songTitle: string;
  /** "Sarah added 2 voice memos" — actor + humanized kind, never content. */
  text: string;
  dotColor: string;
  lastAt: string;
};

export type CirclePerson = {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** The songs you share (titles, capped) — the relationship, not a count. */
  sharedTitles: string[];
};

export type CircleSongEvents = {
  songId: string;
  songTitle: string;
  events: ActivityEvent[];
};

/** Calm caps — Circle is finite by construction. */
export const CIRCLE_MAX_LINES = 6;
export const CIRCLE_MAX_PEOPLE = 12;

/**
 * "While you were away…" — group each song's events per (actor, kind) into
 * warm lines, others' work only, newest first, capped.
 */
export function buildCircleDigest(
  perSong: CircleSongEvents[],
  myUserId: string | null,
): CircleLine[] {
  const lines: CircleLine[] = [];
  for (const s of perSong) {
    const groups = new Map<string, { row: ActivityEvent; count: number; lastAt: string }>();
    for (const e of s.events) {
      if (!e.actor_user_id || e.actor_user_id === myUserId) continue;
      const key = `${e.actor_user_id}|${e.action}`;
      const g = groups.get(key);
      if (g) {
        g.count += 1;
        if (e.created_at > g.lastAt) g.lastAt = e.created_at;
      } else {
        groups.set(key, { row: e, count: 1, lastAt: e.created_at });
      }
    }
    for (const [key, { row, count, lastAt }] of groups) {
      const name = row.actor_name?.trim() || "Someone";
      const { phrase } = humanizeActivity(row.action, count);
      lines.push({
        id: `${s.songId}|${key}`,
        songId: s.songId,
        songTitle: s.songTitle,
        text: `${name} ${phrase}`,
        dotColor: row.actor_color ?? getCreatorColor(row.actor_user_id ?? name).base,
        lastAt,
      });
    }
  }
  return lines
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
    .slice(0, CIRCLE_MAX_LINES);
}

/**
 * "Your people" — every co-writer across your songs, deduped, with the
 * songs you share. Relationships, never a follower count.
 */
export function buildCirclePeople(
  members: Array<{ userId: string; name: string; songId: string; songTitle: string }>,
  myUserId: string | null,
): CirclePerson[] {
  const byId = new Map<string, CirclePerson>();
  for (const m of members) {
    if (!m.userId || m.userId === myUserId) continue;
    const existing = byId.get(m.userId);
    if (existing) {
      if (existing.sharedTitles.length < 3 && !existing.sharedTitles.includes(m.songTitle)) {
        existing.sharedTitles.push(m.songTitle);
      }
      continue;
    }
    const name = m.name.trim() || "Someone";
    byId.set(m.userId, {
      id: m.userId,
      name,
      initials: getCreatorInitials(name),
      color: getCreatorColor(m.userId).base,
      sharedTitles: [m.songTitle],
    });
  }
  return Array.from(byId.values()).slice(0, CIRCLE_MAX_PEOPLE);
}

/** Amens from others across your songs since the anchor — encouragement in. */
export function countRecentAmens(
  perSongAmens: Array<{ songTitle: string; rows: Array<{ user_id: string; created_at: string }> }>,
  myUserId: string | null,
  sinceIso: string,
): { total: number; songTitles: string[] } {
  let total = 0;
  const titles: string[] = [];
  for (const s of perSongAmens) {
    const fresh = s.rows.filter(
      (r) => r.created_at > sinceIso && (!myUserId || r.user_id !== myUserId),
    );
    if (fresh.length > 0) {
      total += fresh.length;
      if (titles.length < 3 && !titles.includes(s.songTitle)) titles.push(s.songTitle);
    }
  }
  return { total, songTitles: titles };
}

// ── The visit anchor (per device, like the canvas recap's) ────────────────

const ANCHOR_KEY = "cog:circle-last-visit";
/** With no anchor (first visit / cleared cache), look back this far. */
export const CIRCLE_DEFAULT_WINDOW_DAYS = 7;

export function readCircleAnchor(): string {
  try {
    const stored = localStorage.getItem(ANCHOR_KEY);
    if (stored) return stored;
  } catch {
    /* storage unavailable */
  }
  return new Date(Date.now() - CIRCLE_DEFAULT_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
}

export function writeCircleAnchor(iso: string): void {
  try {
    localStorage.setItem(ANCHOR_KEY, iso);
  } catch {
    /* storage unavailable — the default window serves next visit */
  }
}
