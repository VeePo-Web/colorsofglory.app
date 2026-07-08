// COG frontend permission system — CAPABILITY POLICY (E1)
//
// The single, pure source of truth for "what can a role DO?". Every gated
// surface (canvas, lyrics, voice, notes, capture, People) asks this policy —
// never re-derives its own answer. This module has NO React and NO Supabase
// imports on purpose: it is pure data + pure functions, so it is trivially
// unit-testable and can never accidentally depend on the URL, the store, or a
// network call. The *real* role comes from A3's myRole() (see useSongRole.ts);
// this file only maps a resolved role → its capabilities.
//
// ROLE MODEL (law — from A2 / GROUP-A-OVERVIEW §D2, consumed via @/types/role):
//   DB storage enum (SongMemberRole):  owner | collaborator | viewer   (3 values)
//   UI-facing role model:              owner | contributor | reviewer | viewer
//   Mapping: collaborator ⇄ contributor. "Reviewer" is a PERMISSION FLAG, not a
//   stored role, until Lovable adds the enum value / a can_approve boolean. We
//   model it here as an effective role that a member can hold via that flag, so
//   the rest of the app can gate `review` cleanly the day it ships — without any
//   consumer having to change.

import type { SongMemberRole } from "@/types/role";
import { dbRoleToUi, type UiRole } from "@/lib/invite/roles";

/**
 * The role a capability decision is made against. This is the *effective* role
 * (UI model), including "reviewer" as a first-class value even though it is not
 * yet a stored DB enum value. Resolve a stored role → EffectiveRole with
 * {@link resolveEffectiveRole}.
 */
export type EffectiveRole = UiRole; // "owner" | "contributor" | "reviewer" | "viewer"

/**
 * Every gate-able thing in the app. Add here (and to every role row in
 * ROLE_CAPABILITIES) when a new gated action is introduced — TypeScript will
 * force the policy to stay exhaustive.
 */
export type Capability =
  | "view" // read lyrics, listen to memos, see the room — everyone with access
  | "edit" // add/change lyrics, chords, notes, canvas cards; final arrangement
  | "record" // add/record voice memos + hums
  | "suggest" // propose a line-level suggestion or comment
  | "review" // approve/reject a pending suggestion (Reviewer + Owner)
  | "invite" // invite new collaborators into the song
  | "manageRoles" // promote / demote a collaborator's role
  | "removeMember" // remove a collaborator from the song
  | "editMeta" // song title / key / BPM / dedication (song-level metadata)
  | "deleteSong"; // archive / delete the whole song

export type CapabilitySet = Record<Capability, boolean>;

/** Fully-denied baseline — spread over, so new capabilities default to `false`. */
const NONE: CapabilitySet = {
  view: false,
  edit: false,
  record: false,
  suggest: false,
  review: false,
  invite: false,
  manageRoles: false,
  removeMember: false,
  editMeta: false,
  deleteSong: false,
};

/**
 * THE POLICY MAP. One row per effective role. This is the whole permission
 * model in one glance — reviewers can comment/approve but never edit; viewers
 * are strictly read-only; contributors add content but never manage people;
 * only owners touch membership, metadata, or delete the song.
 */
export const ROLE_CAPABILITIES: Record<EffectiveRole, CapabilitySet> = {
  owner: {
    view: true,
    edit: true,
    record: true,
    suggest: true,
    review: true,
    invite: true,
    manageRoles: true,
    removeMember: true,
    editMeta: true,
    deleteSong: true,
  },
  contributor: {
    ...NONE,
    view: true,
    edit: true,
    record: true,
    suggest: true,
  },
  reviewer: {
    ...NONE,
    view: true,
    suggest: true,
    review: true,
  },
  viewer: {
    ...NONE,
    view: true,
  },
};

/** The capability set for an effective role. */
export function capabilitiesFor(role: EffectiveRole): CapabilitySet {
  return ROLE_CAPABILITIES[role];
}

/**
 * The one pure predicate the whole app is built on: can this role do this?
 * Pure, synchronous, unit-testable. `null` role (unknown / not-a-member) can do
 * nothing — the safe default.
 */
export function can(role: EffectiveRole | null | undefined, action: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.[action] ?? false;
}

/**
 * Resolve a stored DB role → effective role, honoring the deferred "reviewer"
 * flag. Until Lovable stores reviewer, `reviewer` can only arise when a caller
 * passes `{ reviewer: true }` (e.g. an invite preview, or a future can_approve
 * column surfaced by A3). collaborator → contributor; owner/viewer unchanged.
 */
export function resolveEffectiveRole(
  dbRole: SongMemberRole | null | undefined,
  opts?: { reviewer?: boolean },
): EffectiveRole | null {
  if (!dbRole) return null;
  const ui = dbRoleToUi(dbRole); // owner | contributor | viewer
  // A collaborator carrying the reviewer flag reviews-but-can't-edit.
  if (opts?.reviewer && ui === "contributor") return "reviewer";
  return ui;
}
