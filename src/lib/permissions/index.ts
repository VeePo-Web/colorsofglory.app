// COG frontend permission system (E1) — public surface.
//
// Import from "@/lib/permissions" everywhere. Consuming agents (B3, C2–C5, D2,
// D3, E2–E4) depend on this barrel and the components in @/components/roles.
// See docs/ROLE-CONTRACT.md for the full contract.

export {
  ROLE_CAPABILITIES,
  capabilitiesFor,
  can,
  resolveEffectiveRole,
  type Capability,
  type CapabilitySet,
  type EffectiveRole,
} from "./capabilities";

export { useSongRole, myRoleKey, type SongRoleState, type RoleStatus } from "./useSongRole";
export { useCapabilities, type Capabilities } from "./useCapabilities";
