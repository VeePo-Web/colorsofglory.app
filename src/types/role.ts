// Role domain types — THE canonical role vocabulary for Colors of Glory.
//
// This is the single home for how a collaborator role is TYPED, LABELLED,
// DESCRIBED, and MAPPED between storage and UI. Every role surface derives from
// here: B3's invite flow + E1's shared role components import the runtime maps
// through the thin compat shim in `src/lib/invite/roles.ts` (which now delegates
// to this file), and the permissions layer (`src/lib/permissions/capabilities.ts`)
// resolves stored → effective role through `dbRoleToDisplay`.
//
// TWO ROLE MODELS, ONE ROUND-TRIP:
//
//   STORAGE (DB enum `song_member_role`):  owner | collaborator | viewer   (3)
//   DISPLAY (what the UI shows):            owner | contributor | reviewer | viewer   (4)
//
//   displayRoleToDb:  owner→owner, contributor→collaborator,
//                     reviewer→collaborator (LOSSY), viewer→viewer
//   dbRoleToDisplay:  owner→owner, collaborator→contributor (LOSSY default),
//                     viewer→viewer
//
// The contributor/reviewer → collaborator collapse is DELIBERATELY LOSSY: the DB
// cannot yet distinguish a Reviewer. "Reviewer" is a PERMISSION FLAG surfaced in
// the UI, not a stored role, until Lovable adds an enum value (or a can_approve
// boolean) to `song_member_role`. See docs/TYPE-CONTRACT.md (§Roles) for the
// filed schema request. Enforcement of what a role can DO lives in ONE place —
// `src/lib/permissions/capabilities.ts` (E1's ROLE_CAPABILITIES boolean gate);
// this module owns the vocabulary + the human-readable summary, never a second
// enforcement copy.
import type { Database } from "@/integrations/supabase/types";

/**
 * Storage-canonical role, DERIVED from the generated DB enum — never forked.
 * `owner | collaborator | viewer`.
 */
export type SongMemberRole = Database["public"]["Enums"]["song_member_role"];

/**
 * The UI-facing role model. FOUR roles are shown to people even though only
 * three are stored — `reviewer` is a display/permission flag (see file header).
 */
export type DisplayRole = "owner" | "contributor" | "reviewer" | "viewer";

/** Human-facing text for a single role. One source for every label + blurb. */
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

/**
 * THE role label + description table. The only place role copy is authored;
 * `owner` displays as "Owner". Values are verbatim from the approved role
 * mockups (reference image "download (19)") and drive RolePicker, RoleBadge,
 * the invite RoleToast, and ROLE_CAPABILITY below.
 */
export const ROLE_DISPLAY: Record<DisplayRole, RoleDisplay> = {
  owner: {
    label: "Owner",
    selectDesc: "Full control of this song.",
    toastCopy: "You have full control of this song.",
  },
  contributor: {
    label: "Contributor",
    selectDesc: "Can add lyrics, memos, comments, and ideas.",
    toastCopy: "You can write lyrics, add voice memos, and comment.",
  },
  reviewer: {
    label: "Reviewer",
    selectDesc: "Can comment and approve changes.",
    toastCopy: "You can comment and approve changes.",
    comingSoon: true,
  },
  viewer: {
    label: "Viewer",
    selectDesc: "Can listen and read.",
    toastCopy: "You can listen and read.",
  },
};

/**
 * The one-line capability sentence per role — the verbatim strings from the
 * spec (Viewer "Can listen and read.", Contributor "Can add lyrics, memos,
 * comments, and ideas.", Reviewer "Can comment and approve changes.", Owner =
 * full control). DERIVED from ROLE_DISPLAY so there is exactly one authored copy.
 */
export const ROLE_CAPABILITY: Record<DisplayRole, string> = {
  owner: ROLE_DISPLAY.owner.selectDesc,
  contributor: ROLE_DISPLAY.contributor.selectDesc,
  reviewer: ROLE_DISPLAY.reviewer.selectDesc,
  viewer: ROLE_DISPLAY.viewer.selectDesc,
};

/**
 * Human-readable, CUMULATIVE grant summary per role — used by role-explainer UI
 * ("what can each role do?"). This is a DISPLAY artifact, NOT the runtime gate:
 * code-level enforcement is the single boolean matrix `ROLE_CAPABILITIES` in
 * `src/lib/permissions/capabilities.ts`. Keep the two consistent; do not gate
 * behavior off these strings.
 */
export type RolePermissions = Record<DisplayRole, readonly string[]>;

export const ROLE_PERMISSIONS: RolePermissions = {
  viewer: ["Read lyrics", "Listen to voice memos"],
  contributor: [
    "Read lyrics",
    "Listen to voice memos",
    "Add lyrics, memos, comments, and ideas",
  ],
  reviewer: [
    "Read lyrics",
    "Listen to voice memos",
    "Comment on the song",
    "Approve or reject suggested changes",
  ],
  owner: [
    "Everything contributors and reviewers can do",
    "Manage members and roles",
    "Edit song metadata",
    "Lock, transfer, or delete the song",
  ],
};

/**
 * DISPLAY role → STORAGE role. `contributor` and `reviewer` both collapse to
 * `collaborator` (LOSSY — the DB cannot store Reviewer yet). Accepts a loose
 * string for the many call sites that hold a role as `string`.
 */
export function displayRoleToDb(role: DisplayRole | string): SongMemberRole {
  if (role === "viewer") return "viewer";
  if (role === "owner") return "owner";
  // contributor + reviewer → collaborator
  return "collaborator";
}

/**
 * STORAGE role → DISPLAY role. `collaborator → contributor` is the LOSSY
 * DEFAULT: a stored collaborator that actually holds the Reviewer permission
 * flag cannot be distinguished here, so it surfaces as Contributor. Callers that
 * know a member is a reviewer (invite preview, a future can_approve column)
 * override at the capability layer. Accepts a loose string for compat.
 */
export function dbRoleToDisplay(role: SongMemberRole | string): DisplayRole {
  if (role === "viewer") return "viewer";
  if (role === "owner") return "owner";
  // collaborator (and any unknown) → contributor
  return "contributor";
}

/**
 * Safe label lookup for ANY role string (DB or UI), never throws. Maps the raw
 * `collaborator` enum to "Contributor" so the DB value never leaks to a human.
 */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "";
  const display: DisplayRole = role === "collaborator" ? "contributor" : (role as DisplayRole);
  return ROLE_DISPLAY[display]?.label ?? role;
}
