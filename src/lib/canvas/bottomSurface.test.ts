import { describe, it, expect } from "vitest";
import { isBottomWorkflowActive, type BottomSurfaceState } from "./bottomSurface";

const calm: BottomSurfaceState = {
  weaveActive: false,
  arranging: false,
  mergeSelectionCount: 0,
  listenPathExpanded: false,
  listenPathQueueCount: 0,
};

describe("isBottomWorkflowActive — one bottom action surface at a time", () => {
  it("is false in the calm default (the creation dock owns the bottom)", () => {
    expect(isBottomWorkflowActive(calm)).toBe(false);
  });

  it("is true while a weave owns the bottom", () => {
    expect(isBottomWorkflowActive({ ...calm, weaveActive: true })).toBe(true);
  });

  it("is true while arranging Final", () => {
    expect(isBottomWorkflowActive({ ...calm, arranging: true })).toBe(true);
  });

  it("is true the moment a merge selection exists", () => {
    expect(isBottomWorkflowActive({ ...calm, mergeSelectionCount: 1 })).toBe(true);
  });

  it("is true when the listen path is EXPANDED with a queue", () => {
    expect(
      isBottomWorkflowActive({ ...calm, listenPathExpanded: true, listenPathQueueCount: 3 }),
    ).toBe(true);
  });

  it("stays FALSE for a collapsed listen path — the quiet pill coexists with the dock", () => {
    expect(
      isBottomWorkflowActive({ ...calm, listenPathExpanded: false, listenPathQueueCount: 3 }),
    ).toBe(false);
  });

  it("stays FALSE for an expanded-but-empty listen path (nothing to play yet)", () => {
    expect(
      isBottomWorkflowActive({ ...calm, listenPathExpanded: true, listenPathQueueCount: 0 }),
    ).toBe(false);
  });
});
