/**
 * ROLE_DISPLAY — the single source of truth for how a collaborator role is
 * LABELLED and DESCRIBED across every role surface: B3's invite flow (compose
 * cards, invite-preview chip, team-intro line, RoleToast) AND E1's shared role
 * components (RolePicker, RoleBadge — which import from here).
 *
 * B3 owns role SELECTION + DISPLAY here. E1 owns the permission TRUTH (what a
 * role can actually mutate). They meet at the DB `song_member_role` enum:
 *
 *   DB enum:   owner | collaborator | viewer      (Lovable's song_member_role)
 *   UI role:   owner | contributor | reviewer | viewer
 *
 * Mapping:  collaborator ⇄ contributor,  reviewer → collaborator (a permission
 * flag deferred until Lovable adds an enum value / can_approve boolean — see
 * D2). Until then "Reviewer" is display-only + coming-soon.
 *
 * HANDOFF (A2): the charter assigns ROLE_DISPLAY to A2's `@/types`. A2 has not
 * published it. This module is the interim canonical home in B3's lane; when
 * A2 ships `@/types` ROLE_DISPLAY, collapse this to a re-export so there is
 * still exactly one source. Do NOT re-scatter role labels back into screens.
 */

export type UiRole = 'owner' | 'contributor' | 'reviewer' | 'viewer';
export type DbRole = 'owner' | 'collaborator' | 'viewer';

export interface RoleDisplay {
  /** Chip / label text, e.g. "Contributor". */
  label: string;
  /** Compose role-card one-liner: what the OWNER is granting. */
  selectDesc: string;
  /** RoleToast copy after joining: what YOU (the invitee) can do. */
  toastCopy: string;
  /** True → shown but not yet selectable (backend enum not ready). */
  comingSoon?: boolean;
}

export const ROLE_DISPLAY: Record<UiRole, RoleDisplay> = {
  owner: {
    label: 'Owner',
    selectDesc: 'Full control of this song.',
    toastCopy: 'You have full control of this song.',
  },
  contributor: {
    label: 'Contributor',
    selectDesc: 'Can add lyrics, memos, comments, and ideas.',
    toastCopy: 'You can write lyrics, add voice memos, and comment.',
  },
  reviewer: {
    label: 'Reviewer',
    selectDesc: 'Can comment and approve changes.',
    toastCopy: 'You can comment and approve changes.',
    comingSoon: true,
  },
  viewer: {
    label: 'Viewer',
    selectDesc: 'Can listen and read.',
    toastCopy: 'You can listen and read.',
  },
};

/** DB role → canonical UI role. (owner→owner, collaborator→contributor, viewer→viewer) */
export function dbRoleToUi(dbRole: string): UiRole {
  if (dbRole === 'viewer') return 'viewer';
  if (dbRole === 'owner') return 'owner';
  return 'contributor';
}

/** Canonical UI role → DB role. reviewer + contributor both collapse to collaborator. */
export function uiRoleToDb(uiRole: string): DbRole {
  if (uiRole === 'viewer') return 'viewer';
  if (uiRole === 'owner') return 'owner';
  return 'collaborator';
}

/** Safe label lookup for any role string (UI or DB), never throws. */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return '';
  const ui = role === 'collaborator' ? 'contributor' : (role as UiRole);
  return ROLE_DISPLAY[ui]?.label ?? role;
}
