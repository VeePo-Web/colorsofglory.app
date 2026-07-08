// ============================================================================
// TYPE CONTRACT — runtime guard rails for the @/types public surface (A2).
// ============================================================================
// This file locks the RUNTIME half of the domain-type contract: the generated
// enum arrays, the label maps, the role round-trip, the contribution vocabulary,
// and the fact that the barrel actually re-exports its full public VALUE set.
//
// The compile-time half (union shapes, SongDetail.counts key shape, the
// CogErrorCode set, each const array ↔ its type) lives in the sibling
// `type-contract.test-d.ts`, enforced by `npm run typecheck` (tsc) and by
// `npm run test:types` (vitest --typecheck).
//
// A breaking change to the public surface fails ONE of these two files, which is
// exactly what CI is meant to catch. Do not "fix" a failure by loosening an
// assertion here — reconcile the type change with docs/TYPE-CONTRACT.md first.
// ============================================================================
import { describe, it, expect } from "vitest";

import * as Barrel from "@/types";
import {
  // enum runtime arrays
  SECTION_KINDS,
  SECTION_KIND_LABELS,
  MEMO_STATUSES,
  MEMO_STATUS_LABELS,
  TRANSCRIPTION_STATUSES,
  TRANSCRIPTION_STATUS_LABELS,
  VERSION_KINDS,
  VERSION_KIND_LABELS,
  SONG_STATUSES,
  SONG_STATUS_LABELS,
  INVITE_STATUSES,
  INVITE_STATUS_LABELS,
  ONBOARDING_STEPS,
  SUB_PLANS,
  ENTITLEMENT_TIERS,
  isPro,
  isPaidPlan,
  // roles
  ROLE_DISPLAY,
  ROLE_CAPABILITY,
  ROLE_PERMISSIONS,
  displayRoleToDb,
  dbRoleToDisplay,
  roleLabel,
  // credits
  CONTRIBUTION_TYPES,
  CONTRIBUTION_TYPE_LABELS,
  // errors
  CogError,
  isCogError,
  toCogError,
} from "@/types";
import { Constants } from "@/integrations/supabase/types";

// The four UI-facing roles, sorted for stable comparison.
const FOUR_DISPLAY_ROLES = ["contributor", "owner", "reviewer", "viewer"];
// The three stored roles, exactly as the DB enum declares them.
const THREE_STORED_ROLES = ["owner", "collaborator", "viewer"];

describe("type-contract: SongMemberRole (stored, 3 values)", () => {
  it("stores exactly owner | collaborator | viewer", () => {
    expect([...Constants.public.Enums.song_member_role]).toEqual(THREE_STORED_ROLES);
  });

  it("never stores 'reviewer' or 'contributor' as a role value", () => {
    const stored = Constants.public.Enums.song_member_role as readonly string[];
    expect(stored).not.toContain("reviewer");
    expect(stored).not.toContain("contributor");
  });
});

describe("type-contract: DisplayRole (UI, exactly 4 roles)", () => {
  it("ROLE_DISPLAY covers exactly the four UI roles", () => {
    expect(Object.keys(ROLE_DISPLAY).sort()).toEqual(FOUR_DISPLAY_ROLES);
  });

  it("ROLE_CAPABILITY and ROLE_PERMISSIONS share the same four keys", () => {
    expect(Object.keys(ROLE_CAPABILITY).sort()).toEqual(FOUR_DISPLAY_ROLES);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(FOUR_DISPLAY_ROLES);
  });

  it("owner label is 'Owner' and every role has a non-empty label", () => {
    expect(ROLE_DISPLAY.owner.label).toBe("Owner");
    for (const role of FOUR_DISPLAY_ROLES) {
      expect(ROLE_DISPLAY[role as keyof typeof ROLE_DISPLAY].label.length).toBeGreaterThan(0);
    }
  });

  it("round-trips display ⇄ stored with the documented lossy collapse", () => {
    // contributor + reviewer both collapse to collaborator (lossy, by design).
    expect(displayRoleToDb("owner")).toBe("owner");
    expect(displayRoleToDb("contributor")).toBe("collaborator");
    expect(displayRoleToDb("reviewer")).toBe("collaborator");
    expect(displayRoleToDb("viewer")).toBe("viewer");
    // stored → display (collaborator defaults to contributor).
    expect(dbRoleToDisplay("owner")).toBe("owner");
    expect(dbRoleToDisplay("collaborator")).toBe("contributor");
    expect(dbRoleToDisplay("viewer")).toBe("viewer");
    // the raw DB enum value never leaks to a human.
    expect(roleLabel("collaborator")).toBe("Contributor");
  });
});

describe("type-contract: each enum const array matches its generated DB array", () => {
  // Every array here is the barrel export; its RHS is the generated source of
  // truth. If a hand-typed value drifts from the schema, this fails.
  const cases: Array<[readonly string[], readonly string[], string]> = [
    [SECTION_KINDS, Constants.public.Enums.section_kind, "section_kind"],
    [MEMO_STATUSES, Constants.public.Enums.memo_status, "memo_status"],
    [TRANSCRIPTION_STATUSES, Constants.public.Enums.transcription_status, "transcription_status"],
    [VERSION_KINDS, Constants.public.Enums.version_kind, "version_kind"],
    [SONG_STATUSES, Constants.public.Enums.song_status, "song_status"],
    [INVITE_STATUSES, Constants.public.Enums.invite_status, "invite_status"],
    [ONBOARDING_STEPS, Constants.public.Enums.onboarding_step, "onboarding_step"],
    [SUB_PLANS, Constants.public.Enums.sub_plan, "sub_plan"],
    [ENTITLEMENT_TIERS, Constants.public.Enums.plan_tier, "plan_tier"],
  ];
  it.each(cases)("%o === generated (%s)", (arr, generated) => {
    expect([...arr]).toEqual([...generated]);
  });
});

describe("type-contract: label maps have exactly one entry per enum member", () => {
  const cases: Array<[readonly string[], Record<string, string>, string]> = [
    [SECTION_KINDS, SECTION_KIND_LABELS, "section_kind"],
    [MEMO_STATUSES, MEMO_STATUS_LABELS, "memo_status"],
    [TRANSCRIPTION_STATUSES, TRANSCRIPTION_STATUS_LABELS, "transcription_status"],
    [VERSION_KINDS, VERSION_KIND_LABELS, "version_kind"],
    [SONG_STATUSES, SONG_STATUS_LABELS, "song_status"],
    [INVITE_STATUSES, INVITE_STATUS_LABELS, "invite_status"],
  ];
  it.each(cases)("label keys cover the array exactly (%s)", (arr, labels) => {
    expect(Object.keys(labels).sort()).toEqual([...arr].sort());
  });
});

describe("type-contract: plan classifiers mirror the DB rule", () => {
  it("isPro is true only for pro | founder_pro", () => {
    expect(isPro("pro")).toBe(true);
    expect(isPro("founder_pro")).toBe(true);
    expect(isPro("starter")).toBe(false);
    expect(isPro("free")).toBe(false);
  });
  it("isPaidPlan is true for any non-free plan", () => {
    expect(isPaidPlan("starter")).toBe(true);
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("free")).toBe(false);
  });
});

describe("type-contract: Credit contribution vocabulary", () => {
  it("CONTRIBUTION_TYPE_LABELS has exactly one label per contribution type", () => {
    expect(Object.keys(CONTRIBUTION_TYPE_LABELS).sort()).toEqual([...CONTRIBUTION_TYPES].sort());
  });
});

describe("type-contract: CogError taxonomy", () => {
  it("carries the code and is detected by the guard", () => {
    const err = new CogError("FORBIDDEN", "nope");
    expect(err.code).toBe("FORBIDDEN");
    expect(isCogError(err)).toBe(true);
    expect(isCogError(new Error("plain"))).toBe(false);
  });
  it("coerces arbitrary throwables into a CogError", () => {
    expect(toCogError(new CogError("OFFLINE")).code).toBe("OFFLINE");
    expect(toCogError({ code: "SONG_NOT_FOUND", message: "x" }).code).toBe("SONG_NOT_FOUND");
    expect(toCogError("boom").code).toBe("INTERNAL");
    expect(toCogError(42).code).toBe("INTERNAL");
  });
});

describe("type-contract: the @/types barrel re-exports the full public VALUE set", () => {
  // Every runtime value the public surface promises. A dropped re-export (e.g.
  // deleting a `export *` line from index.ts, or renaming a value) fails here.
  const REQUIRED_VALUE_EXPORTS = [
    // enums.ts — arrays
    "SECTION_KINDS",
    "MEMO_STATUSES",
    "TRANSCRIPTION_STATUSES",
    "VERSION_KINDS",
    "SONG_STATUSES",
    "INVITE_STATUSES",
    "ONBOARDING_STEPS",
    "SUB_PLANS",
    "ENTITLEMENT_TIERS",
    // enums.ts — label maps
    "SECTION_KIND_LABELS",
    "MEMO_STATUS_LABELS",
    "TRANSCRIPTION_STATUS_LABELS",
    "VERSION_KIND_LABELS",
    "SONG_STATUS_LABELS",
    "INVITE_STATUS_LABELS",
    // enums.ts — plan classifiers
    "isPro",
    "isPaidPlan",
    // role.ts
    "ROLE_DISPLAY",
    "ROLE_CAPABILITY",
    "ROLE_PERMISSIONS",
    "displayRoleToDb",
    "dbRoleToDisplay",
    "roleLabel",
    // credit.ts
    "CONTRIBUTION_TYPES",
    "CONTRIBUTION_TYPE_LABELS",
    // error.ts
    "CogError",
    "isCogError",
    "toCogError",
  ] as const;

  it.each(REQUIRED_VALUE_EXPORTS)("exports %s", (name) => {
    expect(Barrel).toHaveProperty(name);
    expect((Barrel as Record<string, unknown>)[name]).toBeDefined();
  });
});
