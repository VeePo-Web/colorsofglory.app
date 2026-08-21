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

  it("NEVER counts the listen path on the FEED — the dock-vanish regression", () => {
    // "Play the song" on the Final page grows the queue, which auto-expanded
    // the path — but the expanded transport is map-only, so on the feed the
    // dock vanished with nothing in its place, for the rest of the session.
    expect(
      isBottomWorkflowActive({
        ...calm,
        view: "feed",
        listenPathExpanded: true,
        listenPathQueueCount: 3,
      }),
    ).toBe(false);
    // A real map workflow still yields the feed dock's slot when the view
    // flips back — weave/arrange/merge are view-independent workflows.
    expect(isBottomWorkflowActive({ ...calm, view: "feed", arranging: true })).toBe(true);
  });

  it("still counts the expanded listen path on the MAP (its transport renders there)", () => {
    expect(
      isBottomWorkflowActive({
        ...calm,
        view: "map",
        listenPathExpanded: true,
        listenPathQueueCount: 3,
      }),
    ).toBe(true);
  });
});
