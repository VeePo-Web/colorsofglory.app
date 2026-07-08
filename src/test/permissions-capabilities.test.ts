import { describe, expect, it } from "vitest";
import {
  can,
  capabilitiesFor,
  resolveEffectiveRole,
  ROLE_CAPABILITIES,
  type Capability,
  type EffectiveRole,
} from "@/lib/permissions/capabilities";

// The whole permission model is a pure function — prove the policy holds without
// React, Supabase, or the URL anywhere in sight.

describe("capability policy (E1)", () => {
  it("owner can do everything", () => {
    const every: Capability[] = [
      "view", "edit", "record", "suggest", "review",
      "invite", "manageRoles", "removeMember", "editMeta", "deleteSong",
    ];
    for (const action of every) expect(can("owner", action)).toBe(true);
  });

  it("viewer is strictly read-only", () => {
    expect(can("viewer", "view")).toBe(true);
    const denied: Capability[] = [
      "edit", "record", "suggest", "review",
      "invite", "manageRoles", "removeMember", "editMeta", "deleteSong",
    ];
    for (const action of denied) expect(can("viewer", action)).toBe(false);
  });

  it("contributor adds content but never manages people or metadata", () => {
    expect(can("contributor", "edit")).toBe(true);
    expect(can("contributor", "record")).toBe(true);
    expect(can("contributor", "suggest")).toBe(true);
    expect(can("contributor", "review")).toBe(false);
    expect(can("contributor", "invite")).toBe(false);
    expect(can("contributor", "manageRoles")).toBe(false);
    expect(can("contributor", "deleteSong")).toBe(false);
  });

  it("reviewer comments + approves but cannot edit or record", () => {
    expect(can("reviewer", "view")).toBe(true);
    expect(can("reviewer", "suggest")).toBe(true);
    expect(can("reviewer", "review")).toBe(true);
    expect(can("reviewer", "edit")).toBe(false);
    expect(can("reviewer", "record")).toBe(false);
  });

  it("null / unknown role can do nothing (safe default)", () => {
    expect(can(null, "view")).toBe(false);
    expect(can(undefined, "edit")).toBe(false);
  });

  it("maps stored DB roles → effective UI roles", () => {
    expect(resolveEffectiveRole("owner")).toBe("owner");
    expect(resolveEffectiveRole("collaborator")).toBe("contributor");
    expect(resolveEffectiveRole("viewer")).toBe("viewer");
    expect(resolveEffectiveRole(null)).toBeNull();
  });

  it("reviewer is a permission flag, not a stored role", () => {
    // Only a collaborator carrying the flag becomes a reviewer.
    expect(resolveEffectiveRole("collaborator", { reviewer: true })).toBe("reviewer");
    // The flag never escalates a viewer or overrides an owner.
    expect(resolveEffectiveRole("viewer", { reviewer: true })).toBe("viewer");
    expect(resolveEffectiveRole("owner", { reviewer: true })).toBe("owner");
  });

  it("every role row is exhaustive over the capability set", () => {
    const roles: EffectiveRole[] = ["owner", "contributor", "reviewer", "viewer"];
    for (const role of roles) {
      expect(Object.keys(capabilitiesFor(role)).sort()).toEqual(
        Object.keys(ROLE_CAPABILITIES.owner).sort(),
      );
    }
  });
});
