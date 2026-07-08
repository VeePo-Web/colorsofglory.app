/**
 * Role display + mapping — COMPAT RE-EXPORT SHIM.
 *
 * The canonical role vocabulary (labels, descriptions, capability sentences,
 * permission summary, and the DB⇄UI round-trip) now lives in ONE place:
 * `@/types/role`. This module used to hold its own copies; it now DELEGATES to
 * the type layer so there is exactly one definition, while keeping every
 * existing `@/lib/invite/roles` import (RolePicker, RoleBadge, PeoplePage,
 * capabilities.ts) working unchanged.
 *
 *   DB enum:   owner | collaborator | viewer      (Lovable's song_member_role)
 *   UI role:   owner | contributor | reviewer | viewer
 *
 * `reviewer → collaborator` is a permission flag deferred until Lovable adds an
 * enum value / can_approve boolean (see docs/TYPE-CONTRACT.md). Do NOT re-scatter
 * role labels back into screens — import from here or from `@/types`.
 */

import type { DisplayRole, SongMemberRole } from "@/types/role";
import {
  ROLE_DISPLAY,
  dbRoleToDisplay,
  displayRoleToDb,
  roleLabel,
} from "@/types/role";

// ── Legacy type aliases (kept so existing importers compile unchanged) ─────────
/** UI role model. Alias of the canonical {@link DisplayRole}. */
export type UiRole = DisplayRole;
/** Storage role model. Alias of the canonical {@link SongMemberRole}. */
export type DbRole = SongMemberRole;

// ── Canonical values, re-exported ──────────────────────────────────────────────
export type { RoleDisplay } from "@/types/role";
export { ROLE_DISPLAY, roleLabel };

// ── Legacy mapping names → canonical functions ─────────────────────────────────
/** DB role → canonical UI role. Alias of {@link dbRoleToDisplay}. */
export const dbRoleToUi = dbRoleToDisplay;
/** Canonical UI role → DB role. Alias of {@link displayRoleToDb}. */
export const uiRoleToDb = displayRoleToDb;
