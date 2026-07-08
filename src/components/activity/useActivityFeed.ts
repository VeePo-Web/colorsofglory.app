/**
 * E2 · useActivityFeed — the calm-activity-intelligence hook behind
 * /songs/:id/activity. Thin React face over A3's activity seam
 * (cog/activity.ts + cog/realtime.ts); no raw Supabase queries here.
 *
 * The "since you left" crux: the prior last_seen_at is READ before
 * mark_song_seen runs — never the other way round — or every visit's delta
 * would collapse to zero. The divider then stays pinned for the whole visit
 * (staleTime: Infinity) so realtime arrivals fold under "Since you left"
 * without the groups reshuffling. On unmount we mark seen once more, so
 * changes you watched arrive live don't greet you again next visit.
 *
 * Grouping: the since-section comes from the server digest RPC
 * (list_song_activity_since — one row per actor+kind with event_count), so
 * counts can't drift from the client. "Earlier" is grouped client-side from
 * the plain rows with the same actor+kind rule inside a 60-minute window.
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRecentActivity,
  getRecapDigest,
  listActivitySince,
  markSongSeen,
  type ActivityEvent,
  type ActivityDigestRow,
} from "@/integrations/cog/activity";
import { getNotificationPrefs, getSong, type SongDetail } from "@/integrations/cog/songs";
import { listMembers, type SongMember } from "@/integrations/cog/members";
import { subscribeSongRoom } from "@/integrations/cog/realtime";
import { UNKNOWN_ACTOR } from "./activityCopy";

/** One calm card: an actor+kind group with a count — never raw content. */
export type ActivityGroup = {
  key: string;
  kind: string;
  count: number;
  lastAt: string;
  actorUserId: string | null;
  actorName: string | null;
  initials: string;
  color: string;
};

const GROUP_WINDOW_MS = 60 * 60 * 1000; // fold same actor+kind within an hour
const NEUTRAL_ACTOR_COLOR = "var(--cog-muted)"; // color is never the only signal

export const activityKeys = {
  lastSeen: (songId: string) => ["activity-last-seen", songId] as const,
  rows: (songId: string) => ["activity-rows", songId] as const,
  digest: (songId: string, since: string | null) => ["activity-digest", songId, since] as const,
  recap: (songId: string, since: string | null) => ["activity-recap", songId, since] as const,
};

function initialsFrom(name: string | null): string {
  const source = (name ?? "").trim();
  if (!source) return "•";
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "•"
  );
}

type ActorLook = { name: string | null; initials: string; color: string };

function buildActorLookup(
  members: SongMember[] | undefined,
  rows: ActivityEvent[] | undefined,
): Map<string, ActorLook> {
  const map = new Map<string, ActorLook>();
  // Rows first (they carry the name as it was at event time)…
  for (const row of rows ?? []) {
    if (row.actor_user_id && !map.has(row.actor_user_id)) {
      map.set(row.actor_user_id, {
        name: row.actor_name,
        initials: initialsFrom(row.actor_name),
        color: row.actor_color ?? NEUTRAL_ACTOR_COLOR,
      });
    }
  }
  // …then members override with the freshest identity.
  for (const m of members ?? []) {
    map.set(m.user_id, {
      name: m.display_name ?? m.first_name,
      initials: m.initials,
      color: m.avatar_color ?? NEUTRAL_ACTOR_COLOR,
    });
  }
  return map;
}

function lookActor(lookup: Map<string, ActorLook>, userId: string | null): ActorLook {
  return (
    (userId ? lookup.get(userId) : undefined) ?? {
      name: null,
      initials: initialsFrom(UNKNOWN_ACTOR),
      color: NEUTRAL_ACTOR_COLOR,
    }
  );
}

/** Digest rows (already actor+kind grouped server-side) → calm cards. */
function groupsFromDigest(
  digest: ActivityDigestRow[],
  lookup: Map<string, ActorLook>,
): ActivityGroup[] {
  return digest
    .map((d) => {
      const actor = lookActor(lookup, d.actor_user_id);
      return {
        key: `digest:${d.kind}:${d.actor_user_id ?? "system"}`,
        kind: d.kind,
        count: Math.max(1, d.event_count),
        lastAt: d.last_at,
        actorUserId: d.actor_user_id,
        actorName: actor.name,
        initials: actor.initials,
        color: actor.color,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

/** Plain rows → calm cards: fold same actor+kind within a 60-minute window. */
export function groupRows(
  rows: ActivityEvent[],
  lookup: Map<string, ActorLook>,
): ActivityGroup[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const groups: Array<ActivityGroup & { oldestAt: number }> = [];
  for (const row of sorted) {
    const at = new Date(row.created_at).getTime();
    const open = groups.find(
      (g) =>
        g.kind === row.action &&
        g.actorUserId === row.actor_user_id &&
        g.oldestAt - at <= GROUP_WINDOW_MS,
    );
    if (open) {
      open.count += 1;
      open.oldestAt = Math.min(open.oldestAt, at);
      continue;
    }
    const actor = lookActor(lookup, row.actor_user_id);
    groups.push({
      key: `row:${row.id}`,
      kind: row.action,
      count: 1,
      lastAt: row.created_at,
      oldestAt: at,
      actorUserId: row.actor_user_id,
      actorName: actor.name ?? row.actor_name,
      initials: actor.name ? actor.initials : initialsFrom(row.actor_name),
      color: actor.color,
    });
  }
  return groups.map(({ oldestAt: _oldest, ...g }) => g);
}

export function useActivityFeed(songId: string) {
  const qc = useQueryClient();

  // Song detail: real title, my_role (owner gating), pending-review count.
  const detailQuery = useQuery<SongDetail | null>({
    queryKey: ["song-detail", songId],
    queryFn: () => getSong(songId),
    enabled: Boolean(songId),
  });

  // THE CRUX (read-then-mark): read the prior last_seen_at, only then mark
  // seen. Pinned for the visit so the divider never jumps underfoot.
  const lastSeenQuery = useQuery<string | null>({
    queryKey: activityKeys.lastSeen(songId),
    queryFn: async () => {
      let prior: string | null = null;
      try {
        const prefs = await getNotificationPrefs(songId);
        prior =
          (prefs as unknown as { last_seen_at?: string | null } | null)?.last_seen_at ?? null;
      } catch {
        // Reading the baseline failed — treat as a first visit, but still
        // mark seen below so the NEXT visit gets a real delta.
      }
      // Fire-and-forget: a failed mark must not take the feed down.
      markSongSeen(songId).catch(() => {});
      return prior;
    },
    enabled: Boolean(songId),
    staleTime: Infinity,
    gcTime: 0, // a fresh visit re-reads a fresh baseline
    retry: false,
  });
  const lastSeen = lastSeenQuery.data ?? null;
  const lastSeenReady = lastSeenQuery.isSuccess || lastSeenQuery.isError;

  // Mark seen once more on the way out, so events that arrived live while
  // you watched don't show up as "since you left" next visit.
  useEffect(() => {
    if (!songId) return;
    return () => {
      markSongSeen(songId).catch(() => {});
    };
  }, [songId]);

  const rowsQuery = useQuery<ActivityEvent[]>({
    queryKey: activityKeys.rows(songId),
    queryFn: () => getRecentActivity(songId, 100, 0),
    enabled: Boolean(songId),
  });

  const digestQuery = useQuery<ActivityDigestRow[]>({
    queryKey: activityKeys.digest(songId, lastSeen),
    queryFn: () => listActivitySince(songId, lastSeen as string),
    enabled: Boolean(songId) && lastSeenReady && lastSeen !== null,
    retry: false,
  });

  const membersQuery = useQuery<SongMember[]>({
    queryKey: ["song-members", songId],
    queryFn: () => listMembers(songId),
    enabled: Boolean(songId),
  });

  // Calm realtime: when activity lands elsewhere, quietly refresh the rows
  // and the digest. React Query reconciles in place — no toasts, no badges.
  useEffect(() => {
    if (!songId) return;
    const unsubscribe = subscribeSongRoom(songId, {
      onActivity: () => {
        void qc.invalidateQueries({ queryKey: activityKeys.rows(songId) });
        void qc.invalidateQueries({ queryKey: ["activity-digest", songId] });
      },
    });
    return unsubscribe;
  }, [songId, qc]);

  const rows = rowsQuery.data;
  const members = membersQuery.data;
  const lookup = useMemo(() => buildActorLookup(members, rows), [members, rows]);

  const sinceGroups = useMemo<ActivityGroup[]>(() => {
    if (!lastSeen) return [];
    if (digestQuery.data) return groupsFromDigest(digestQuery.data, lookup);
    // Digest unavailable (RPC error) → same grouping from the plain rows.
    if (digestQuery.isError && rows) {
      const cutoff = new Date(lastSeen).getTime();
      return groupRows(
        rows.filter((r) => new Date(r.created_at).getTime() > cutoff),
        lookup,
      );
    }
    return [];
  }, [lastSeen, digestQuery.data, digestQuery.isError, rows, lookup]);

  const earlierGroups = useMemo<ActivityGroup[]>(() => {
    if (!rows) return [];
    if (!lastSeen) return groupRows(rows, lookup); // first visit: one calm list
    const cutoff = new Date(lastSeen).getTime();
    return groupRows(
      rows.filter((r) => new Date(r.created_at).getTime() <= cutoff),
      lookup,
    );
  }, [rows, lastSeen, lookup]);

  const sinceCount = useMemo(
    () => sinceGroups.reduce((sum, g) => sum + g.count, 0),
    [sinceGroups],
  );

  // The AI recap: optional and graceful. Errors resolve to null — the cards
  // never wait on it and no error UI ever shows.
  const recapQuery = useQuery<string | null>({
    queryKey: activityKeys.recap(songId, lastSeen),
    queryFn: async () => {
      try {
        const recap = await getRecapDigest(songId, lastSeen ?? undefined);
        return recap.digest?.trim() || null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(songId) && lastSeen !== null && sinceCount >= 3,
    staleTime: Infinity,
    retry: false,
  });

  return {
    detail: detailQuery.data ?? null,
    /** null until the baseline read settles; then the prior last-seen ISO. */
    lastSeen,
    /** True once a real prior baseline exists (i.e. not the first visit). */
    hasBaseline: lastSeen !== null,
    sinceGroups,
    earlierGroups,
    sinceCount,
    recap: recapQuery.data ?? null,
    isLoading:
      rowsQuery.isLoading || !lastSeenReady || (lastSeen !== null && digestQuery.isLoading),
    isError: rowsQuery.isError,
    isEmpty:
      rowsQuery.isSuccess && (rows?.length ?? 0) === 0 && sinceGroups.length === 0,
  };
}
