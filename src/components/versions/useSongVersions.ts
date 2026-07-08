/**
 * Query + mutation hooks for the version timeline (E3).
 *
 * Thin React face over the cog/versions.ts data seam. All reads/writes go
 * through that seam; these hooks add caching + invalidation.
 *
 * CAPABILITY GATE (interim E1 seam): E1's useCapabilities is not consumable
 * from this lane yet, so useVersionCapabilities maps the member role from
 * cog/members.myRole: owner/collaborator → can save + restore; viewer or
 * non-member → read-only. When E1's `useCapabilities` (src/lib/permissions)
 * is complete, collapse this hook to consume it — components only ever see
 * { canSave, canRestore }. The SERVER stays the real gate regardless (RLS:
 * members insert; and the UI offers no delete at all).
 */

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSnapshot,
  ensureOriginalVersion,
  listVersions,
  restoreVersion,
  type RestoreResult,
  type SongVersion,
} from "@/integrations/cog/versions";
import { listMembers, myRole, type SongMember } from "@/integrations/cog/members";

/** Canonical cache key for a song's version timeline. */
export const songVersionsKey = (songId: string) => ["song-versions", songId] as const;

export function useSongVersions(songId: string) {
  return useQuery({
    queryKey: songVersionsKey(songId),
    queryFn: () => listVersions(songId),
    enabled: Boolean(songId),
  });
}

export type VersionCapabilities = {
  role: string | null;
  /** owner/contributor: may save a named version. */
  canSave: boolean;
  /** owner/contributor: may restore (and undo a restore). */
  canRestore: boolean;
  isLoading: boolean;
};

export function useVersionCapabilities(songId: string): VersionCapabilities {
  const { data: role = null, isLoading } = useQuery({
    queryKey: ["song-version-role", songId],
    queryFn: () => myRole(songId),
    enabled: Boolean(songId),
  });
  const canWrite = role === "owner" || role === "collaborator";
  return { role, canSave: canWrite, canRestore: canWrite, isLoading };
}

/** user_id → member, for actor names/initials/colors on version cards. */
export function useMembersById(songId: string): Map<string, SongMember> {
  const { data } = useQuery({
    queryKey: ["song-members", songId],
    queryFn: () => listMembers(songId),
    enabled: Boolean(songId),
  });
  return new Map((data ?? []).map((m) => [m.user_id, m]));
}

export function useSaveVersion(songId: string) {
  const qc = useQueryClient();
  return useMutation<SongVersion, Error, { label?: string; description?: string }>({
    mutationFn: ({ label, description }) =>
      createSnapshot(songId, { kind: "manual", label, description }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: songVersionsKey(songId) });
    },
  });
}

export function useRestoreVersion(songId: string) {
  const qc = useQueryClient();
  return useMutation<RestoreResult, Error, string>({
    mutationFn: (versionId: string) => restoreVersion(songId, versionId),
    onSettled: () => {
      // A restore rewrites section/lyric rows, so every cache scoped to this
      // song (versions, sheet, workspace summaries) must refetch.
      void qc.invalidateQueries({
        predicate: (q) => JSON.stringify(q.queryKey).includes(songId),
      });
    },
  });
}

/**
 * "The Original is always there": on first visit by someone who can write,
 * seed the root version from the current state if the song has none yet.
 * Runs at most once per mount; races resolve in the seam.
 */
export function useEnsureOriginal(
  songId: string,
  versions: SongVersion[] | undefined,
  canSave: boolean,
) {
  const qc = useQueryClient();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !songId || !canSave || !versions || versions.length > 0) return;
    seeded.current = true;
    void ensureOriginalVersion(songId).then(() => {
      void qc.invalidateQueries({ queryKey: songVersionsKey(songId) });
    });
  }, [songId, versions, canSave, qc]);
}
