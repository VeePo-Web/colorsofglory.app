// COG frontend permission system — REAL ROLE RESOLUTION (E1)
//
// The signed-in user's REAL role in a song, from real membership — never the
// URL, never a guess. Source of truth is A3's myRole(songId) RPC
// (`my_song_role`, RLS-backed). We wrap it in React Query so the answer is
// cached, shared across every surface, and refetched on the same calm cadence
// as the rest of the app (see @/lib/queryClient).
//
// This hook draws a hard line between three situations, because the UX for each
// is different (see useCapabilities.ts):
//   - "loading"          — auth or the role query is still resolving
//   - "unauthenticated"  — no session at all (onboarding / local-demo mode)
//   - "authenticated"    — we have a user; `role` is their concrete role, or
//                          null when they are genuinely NOT a member

import { useQuery } from "@tanstack/react-query";
import { myRole } from "@/integrations/cog/members";
import type { SongMemberRole } from "@/types/role";
import { useAuth } from "@/lib/auth/AuthContext";

export type RoleStatus = "loading" | "unauthenticated" | "authenticated";

export interface SongRoleState {
  /** Concrete stored role, or null when not-a-member / not-yet-known. */
  role: SongMemberRole | null;
  status: RoleStatus;
  isLoading: boolean;
  /** No session — the app is in local/demo mode (onboarding, unsaved song). */
  isUnauthenticated: boolean;
}

/** Query key for a song's own-role lookup. Shared with cache invalidation. */
export const myRoleKey = (songId: string | undefined) =>
  ["song", songId ?? "none", "my-role"] as const;

/**
 * Resolve the signed-in user's real role in `songId`.
 *
 * The role query only runs when we have BOTH a signed-in user and a songId —
 * so an unauthenticated onboarding session never fires a doomed RPC, and a
 * transient error resolves to `role: null` (a safe, restrictive default that
 * useCapabilities interprets per the auth status).
 */
export function useSongRole(songId: string | undefined): SongRoleState {
  // Session comes from A4's single auth subscription (useAuth) — never a second
  // onAuthStateChange, never the URL. status is loading | authed | anon.
  const { status: authStatus, user } = useAuth();

  const enabled = authStatus === "authed" && Boolean(user) && Boolean(songId);
  const query = useQuery({
    queryKey: myRoleKey(songId),
    queryFn: () => myRole(songId as string),
    enabled,
  });

  if (authStatus === "loading") {
    return { role: null, status: "loading", isLoading: true, isUnauthenticated: false };
  }

  if (authStatus === "anon" || !user) {
    return {
      role: null,
      status: "unauthenticated",
      isLoading: false,
      isUnauthenticated: true,
    };
  }

  // Authenticated: role is loading until the query settles.
  if (enabled && query.isPending) {
    return { role: null, status: "loading", isLoading: true, isUnauthenticated: false };
  }

  return {
    role: (query.data ?? null) as SongMemberRole | null,
    status: "authenticated",
    isLoading: false,
    isUnauthenticated: false,
  };
}
