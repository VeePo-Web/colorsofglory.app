// COG frontend permission system — THE HOOK EVERYONE IMPORTS (E1)
//
// One trustworthy answer to "can I do this in THIS song?", derived from real
// membership (useSongRole → myRole RPC), resolved through the pure policy map
// (capabilities.ts), honored on every surface. No consumer needs to know how
// the role was fetched or how the edge cases resolve — they call
// `caps.can("edit")` (or read `caps.isViewer`) and trust it.
//
// THE THREE NON-OBVIOUS RESOLUTIONS (documented in docs/ROLE-CONTRACT.md):
//
//  1. AUTHENTICATED + concrete role  → the security boundary. A real `viewer`
//     is read-only; a real owner/contributor gets their caps. Editing the URL
//     changes NOTHING — role comes from the server, not `?role=`.
//
//  2. AUTHENTICATED + null role (not a member) → view-only. You're looking at a
//     song you don't belong to; you can read but not mutate.
//
//  3. LOADING → optimistic *contributor* caps (creative surface stays open, so
//     a legit editor is never flash-locked), but owner-admin actions
//     (manageRoles/removeMember/invite/editMeta/deleteSong) stay closed until
//     the real role confirms — so admin UI never flashes in then disappears.
//     UNAUTHENTICATED (onboarding / local-demo, e.g. songId "1" on localStorage)
//     → local owner caps: there is no server identity to gate, and RLS is the
//     real wall for any actual write. This keeps onboarding + the demo canvas
//     fully usable while the spoofable URL gate is gone.
//
// In every case the *harsh* "View only" lockout is shown ONLY for a CONFIRMED
// viewer / non-member (isViewer) — never during loading, never in demo mode.
// View-only is a calm state, not an anxious error.

import { useMemo } from "react";
import {
  can as canDo,
  capabilitiesFor,
  resolveEffectiveRole,
  type Capability,
  type CapabilitySet,
  type EffectiveRole,
} from "./capabilities";
import { useSongRole } from "./useSongRole";
import type { SongMemberRole } from "@/types/role";

export interface Capabilities {
  /** Effective role used for gating (includes local/loading fallbacks). */
  role: EffectiveRole;
  /** The concrete stored role, or null when unknown / not-a-member. */
  dbRole: SongMemberRole | null;
  /** Pure capability predicate for this song + this user. */
  can: (action: Capability) => boolean;
  caps: CapabilitySet;
  isOwner: boolean;
  isContributor: boolean;
  isReviewer: boolean;
  /** True ONLY for a confirmed viewer or confirmed non-member. Drives the
   *  calm "View only" affordance. False while loading and in demo mode. */
  isViewer: boolean;
  /** The role hasn't resolved yet — surfaces may show a neutral pending state. */
  isLoading: boolean;
  /** No session: onboarding / local-demo. Full local caps; RLS is the wall. */
  isLocalMode: boolean;
}

/**
 * Resolve the current user's capabilities for `songId`.
 *
 * @param opts.reviewer  Treat a resolved contributor as a Reviewer (comment +
 *   approve, no edit). Reserved for when A3/Lovable surface a can_approve flag
 *   or an invite preview needs to demonstrate the Reviewer role; today no stored
 *   role produces it, so callers opt in explicitly.
 */
export function useCapabilities(
  songId: string | undefined,
  opts?: { reviewer?: boolean },
): Capabilities {
  const { role: dbRole, isLoading, isUnauthenticated } = useSongRole(songId);
  const reviewer = opts?.reviewer ?? false;

  return useMemo<Capabilities>(() => {
    // (3a) Unauthenticated → local/demo owner. No server identity to gate.
    if (isUnauthenticated) {
      return build("owner", null, { isLoading: false, isLocalMode: true, isViewer: false });
    }

    // (3b) Loading → optimistic contributor (creative surface open, admin closed).
    if (isLoading) {
      return build("contributor", null, { isLoading: true, isLocalMode: false, isViewer: false });
    }

    // (2) Authenticated but not a member → view-only.
    const effective = resolveEffectiveRole(dbRole, { reviewer });
    if (!effective) {
      return build("viewer", null, { isLoading: false, isLocalMode: false, isViewer: true });
    }

    // (1) Authenticated + concrete role → the real security boundary.
    return build(effective, dbRole, {
      isLoading: false,
      isLocalMode: false,
      isViewer: effective === "viewer",
    });
  }, [dbRole, isLoading, isUnauthenticated, reviewer]);
}

function build(
  role: EffectiveRole,
  dbRole: SongMemberRole | null,
  flags: { isLoading: boolean; isLocalMode: boolean; isViewer: boolean },
): Capabilities {
  const caps = capabilitiesFor(role);
  return {
    role,
    dbRole,
    caps,
    can: (action: Capability) => canDo(role, action),
    isOwner: role === "owner",
    isContributor: role === "contributor",
    isReviewer: role === "reviewer",
    isViewer: flags.isViewer,
    isLoading: flags.isLoading,
    isLocalMode: flags.isLocalMode,
  };
}
