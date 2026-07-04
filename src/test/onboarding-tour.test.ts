import { describe, it, expect, beforeEach } from "vitest";
import {
  TOUR_STEPS,
  getTourState,
  isStepPending,
  isTourDone,
  markSeen,
  seenCount,
  skipTour,
  resetTour,
  claimActive,
  releaseActive,
  getActiveStep,
  onLockReleased,
  __resetLockForTests,
} from "@/lib/onboarding/tour";

// The tour engine's brain: seen/skip state, completion, persistence safety,
// and the app-wide one-tip-at-a-time lock. See first-run-tour-plan.md Slice 1.

beforeEach(() => {
  localStorage.clear();
  __resetLockForTests();
});

describe("tour state", () => {
  it("starts with every beat pending and the tour not done", () => {
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(true);
    expect(isTourDone()).toBe(false);
    expect(seenCount()).toBe(0);
  });

  it("markSeen retires a beat, persists it, and it never re-arms", () => {
    expect(markSeen("tour_capture_seen")).toBe(false); // not complete yet
    expect(isStepPending("tour_capture_seen")).toBe(false);
    expect(seenCount()).toBe(1);
    // Survives a reload (fresh read from storage)
    expect(getTourState().seen).toContain("tour_capture_seen");
    // Double-marking is a no-op
    expect(markSeen("tour_capture_seen")).toBe(false);
    expect(seenCount()).toBe(1);
  });

  it("completes exactly once, on the last registered beat", () => {
    const completions = TOUR_STEPS.map((s) => markSeen(s));
    expect(completions.filter(Boolean)).toHaveLength(1);
    expect(completions[completions.length - 1]).toBe(true); // the final beat
    expect(isTourDone()).toBe(true);
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(false);
  });

  it("skip ends every beat forever, silently", () => {
    markSeen("tour_catalog_seen");
    skipTour();
    expect(isTourDone()).toBe(true);
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(false);
    // markSeen after skip never reports completion (nothing should fire)
    expect(markSeen("tour_room_seen")).toBe(false);
  });

  it("reset (Show me around) re-arms every beat, even after skip", () => {
    skipTour();
    resetTour();
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(true);
    expect(seenCount()).toBe(0);
    expect(isTourDone()).toBe(false);
  });

  it("survives corrupted or junk storage with safe defaults", () => {
    localStorage.setItem("cog:tour", "{not json");
    expect(isStepPending("tour_catalog_seen")).toBe(true);
    localStorage.setItem("cog:tour", JSON.stringify({ seen: ["bogus_step", 42], skipped: "yes" }));
    const s = getTourState();
    expect(s.seen).toEqual([]); // unknown keys filtered
    expect(s.skipped).toBe(false); // non-boolean rejected
  });
});

describe("one-tip-at-a-time lock", () => {
  it("first claimant wins; a second beat cannot claim while held", () => {
    expect(claimActive("tour_catalog_seen")).toBe(true);
    expect(claimActive("tour_capture_seen")).toBe(false);
    expect(getActiveStep()).toBe("tour_catalog_seen");
    // Re-claiming your own lock is fine (re-render safety)
    expect(claimActive("tour_catalog_seen")).toBe(true);
  });

  it("release frees the lock and notifies waiters", () => {
    claimActive("tour_catalog_seen");
    let notified = false;
    const off = onLockReleased(() => { notified = true; });
    releaseActive("tour_catalog_seen");
    expect(notified).toBe(true);
    expect(getActiveStep()).toBeNull();
    expect(claimActive("tour_capture_seen")).toBe(true);
    off();
  });

  it("a non-owner release is ignored; null force-clears (skip path)", () => {
    claimActive("tour_catalog_seen");
    releaseActive("tour_capture_seen"); // not the owner — ignored
    expect(getActiveStep()).toBe("tour_catalog_seen");
    releaseActive(null); // skipTour force-clear
    expect(getActiveStep()).toBeNull();
  });

  it("unsubscribed waiters are not notified", () => {
    let calls = 0;
    const off = onLockReleased(() => { calls++; });
    off();
    claimActive("tour_room_seen");
    releaseActive("tour_room_seen");
    expect(calls).toBe(0);
  });
});
