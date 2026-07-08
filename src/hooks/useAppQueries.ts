/**
 * Main-app read layer (A3 · data access).
 *
 * The canonical TanStack Query hooks the primary app screens read through —
 * catalog, workspace hub, and the memo / canvas / capture / activity / account
 * panels. Every hook:
 *   - builds its key from the shared `qk` factory (`@/hooks/queryKeys`), so a
 *     mutation's invalidation and a screen's read can never drift apart;
 *   - runs its fetch through a `cog/*` seam fn, so the error is ALWAYS a
 *     normalized `CogError` (typed here as the query's error) — no raw
 *     PostgREST / RPC / edge string ever reaches a component;
 *   - carries a deliberate `staleTime` sized to how fast that data actually
 *     moves (see `STALE` below).
 *
 * FAIL-SOFT LAW: these are reads. A failed read degrades quietly — the consumer
 * paints the last good (stale) data and offers a gentle retry; it never throws
 * a blocking modal. The client-level `retry: 1` (see `@/lib/queryClient`) gives
 * one quiet re-attempt; `error` is exposed as a `CogError` the screen may switch
 * on (`.code`) but must never render as a raw message.
 *
 * TIMEOUT POLICY: every read runs through `withTimeout` (`@/integrations/cog/
 * errors`). If the device is offline, or the request stalls past `READ_TIMEOUT_MS`,
 * it rejects with `CogError("OFFLINE")` rather than hanging the screen — React
 * Query then keeps the last cached value while the consumer shows a calm offline
 * signal (`error.code === "OFFLINE"`).
 *
 * These hooks READ only. Writes stay in dedicated mutation hooks
 * (`useSongNotes`, capture/outbox, etc.); a realtime subscription INVALIDATES
 * one of these queries, it never streams content into it.
 */

import { useQuery } from "@tanstack/react-query";

import { qk } from "@/hooks/queryKeys";
import { CogError, withTimeout } from "@/integrations/cog/errors";
import {
  listMySongs,
  getSong,
  type SongCard,
  type SongDetail,
} from "@/integrations/cog/songs";
import { listMembers, type SongMember } from "@/integrations/cog/members";
import { listMemosForSong, type VoiceMemo } from "@/integrations/cog/memos";
import { listCanvasCards, type CanvasCard } from "@/integrations/cog/canvas";
import {
  listCaptures,
  listMyUnfiledCaptures,
  type IdeaCapture,
} from "@/integrations/cog/capture";
import { listActivitySince, type ActivityDigestRow } from "@/integrations/cog/activity";
import { getMyBillingStatus, type BillingStatus } from "@/integrations/cog/billing";
import { getStorageUsage, type StorageUsage } from "@/integrations/cog/storage";

/**
 * Deliberate per-volatility staleness. Freshness is bought with network churn,
 * so each read is priced to how fast the underlying data actually changes —
 * NOT left at the client default. Catalog / roster / plan barely move; counts
 * and activity shift with every collaborator action.
 */
const STALE = {
  /** Song catalog — changes only when you create / archive a song. */
  catalog: 60_000,
  /** Collaborator roster — invites / leaves are rare, and realtime invalidates. */
  members: 60_000,
  /** Plan + quota — changes only on checkout / cancel. */
  billing: 60_000,
  /** Memos / captures / canvas / storage — moderate churn, realtime-backed. */
  room: 30_000,
  /** Song-detail counts — every contribution moves a hub badge. */
  counts: 10_000,
  /** Activity digest — the most volatile surface in the room. */
  activity: 10_000,
} as const;

// ── Catalog / song room ────────────────────────────────────────────────────

/** Catalog: every song the signed-in user is a member of (newest activity first). */
export function useSongs() {
  return useQuery<SongCard[], CogError>({
    queryKey: qk.songs(),
    queryFn: () => withTimeout(listMySongs()),
    staleTime: STALE.catalog,
  });
}

/**
 * Workspace hub: the full song + per-room counts that drive the hub badges.
 * Resolves to `null` when the caller isn't a member (a calm "unavailable"
 * state), never a throw for that case.
 */
export function useSongDetail(songId: string) {
  return useQuery<SongDetail | null, CogError>({
    queryKey: qk.songDetail(songId),
    queryFn: () => withTimeout(getSong(songId)),
    enabled: Boolean(songId),
    staleTime: STALE.counts,
  });
}

/** A song's collaborator roster + roles. */
export function useSongMembers(songId: string) {
  return useQuery<SongMember[], CogError>({
    queryKey: qk.songMembers(songId),
    queryFn: () => withTimeout(listMembers(songId)),
    enabled: Boolean(songId),
    staleTime: STALE.members,
  });
}

/** A song's voice-memo list (deleted rows already filtered by the seam). */
export function useMemos(songId: string) {
  return useQuery<VoiceMemo[], CogError>({
    queryKey: qk.memos(songId),
    queryFn: () => withTimeout(listMemosForSong(songId)),
    enabled: Boolean(songId),
    staleTime: STALE.room,
  });
}

/** A song's whiteboard canvas cards (nodes + positions), ordered by position. */
export function useCanvasCards(songId: string) {
  return useQuery<CanvasCard[], CogError>({
    queryKey: qk.canvas(songId),
    queryFn: () => withTimeout(listCanvasCards(songId)),
    enabled: Boolean(songId),
    staleTime: STALE.room,
  });
}

/** Quick-captures filed into a specific song. */
export function useCaptures(songId: string) {
  return useQuery<IdeaCapture[], CogError>({
    queryKey: qk.captures(songId),
    queryFn: () => withTimeout(listCaptures(songId)),
    enabled: Boolean(songId),
    staleTime: STALE.room,
  });
}

/** The signed-in user's captures not yet filed into any song (the global inbox). */
export function useUnfiledCaptures() {
  return useQuery<IdeaCapture[], CogError>({
    queryKey: qk.unfiledCaptures(),
    queryFn: () => withTimeout(listMyUnfiledCaptures()),
    staleTime: STALE.room,
  });
}

/**
 * "What changed since you left" — the grouped activity digest, keyed by the
 * song AND the `last_seen_at` baseline so a new baseline is a distinct cache
 * entry (never a stale delta). Waits for a real `since` before firing.
 */
export function useActivityDigest(songId: string, since: string | null) {
  return useQuery<ActivityDigestRow[], CogError>({
    queryKey: [...qk.activityDigest(songId), since] as const,
    queryFn: () => withTimeout(listActivitySince(songId, since as string)),
    enabled: Boolean(songId) && since !== null,
    staleTime: STALE.activity,
  });
}

// ── Account / billing / storage ────────────────────────────────────────────

/** One-shot billing snapshot: plan, subscription, storage, and song quota. */
export function useBillingStatus() {
  return useQuery<BillingStatus, CogError>({
    queryKey: qk.billing(),
    queryFn: () => withTimeout(getMyBillingStatus()),
    staleTime: STALE.billing,
  });
}

/** Storage bytes used + effective limit for the signed-in user. */
export function useStorageUsage() {
  return useQuery<StorageUsage, CogError>({
    queryKey: qk.storage(),
    queryFn: () => withTimeout(getStorageUsage()),
    staleTime: STALE.room,
  });
}
