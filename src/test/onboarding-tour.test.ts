import { describe, it, expect, beforeEach } from "vitest";
import {
  TOUR_STEPS,
  getTourState,
  isStepPending,
  isLastPending,
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
    expect(markSeen("tour_ideas_seen")).toBe(false); // not complete yet
    expect(isStepPending("tour_ideas_seen")).toBe(false);
    expect(seenCount()).toBe(1);
    // Survives a reload (fresh read from storage)
    expect(getTourState().seen).toContain("tour_ideas_seen");
    // Double-marking is a no-op
    expect(markSeen("tour_ideas_seen")).toBe(false);
    expect(seenCount()).toBe(1);
  });

  it("completes exactly once, on the last registered beat", () => {
    const completions = TOUR_STEPS.map((s) => markSeen(s));
    expect(completions.filter(Boolean)).toHaveLength(1);
    expect(completions[completions.length - 1]).toBe(true); // the final beat
    expect(isTourDone()).toBe(true);
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(false);
  });

  it("isLastPending marks only the final UNSEEN beat, in any order", () => {
    const [first, ...rest] = TOUR_STEPS;
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    // Nothing seen yet: no single beat completes the tour (unless it's a 1-beat
    // tour). Cast avoids TS2367 — the tuple's length is a literal type.
    expect(isLastPending(first)).toBe((TOUR_STEPS.length as number) === 1);
    // See everything except the FIRST beat (out of registry order): now the
    // first beat is the one that will finish the tour — position-independent.
    for (const s of rest) markSeen(s);
    expect(isLastPending(first)).toBe(true);
    // An already-seen beat never "completes" the tour.
    expect(isLastPending(last)).toBe(false);
  });

  it("isLastPending is false once skipped", () => {
    const last = TOUR_STEPS[TOUR_STEPS.length - 1];
    for (const s of TOUR_STEPS.slice(0, -1)) markSeen(s);
    expect(isLastPending(last)).toBe(true);
    skipTour();
    expect(isLastPending(last)).toBe(false);
  });

  it("skip ends every beat forever, silently", () => {
    markSeen("tour_catalog_seen");
    skipTour();
    expect(isTourDone()).toBe(true);
    for (const step of TOUR_STEPS) expect(isStepPending(step)).toBe(false);
    // markSeen after skip never reports completion (nothing should fire)
    expect(markSeen("tour_invite_seen")).toBe(false);
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
    expect(claimActive("tour_ideas_seen")).toBe(false);
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
    expect(claimActive("tour_ideas_seen")).toBe(true);
    off();
  });

  it("a non-owner release is ignored; null force-clears (skip path)", () => {
    claimActive("tour_catalog_seen");
    releaseActive("tour_ideas_seen"); // not the owner — ignored
    expect(getActiveStep()).toBe("tour_catalog_seen");
    releaseActive(null); // skipTour force-clear
    expect(getActiveStep()).toBeNull();
  });

  it("unsubscribed waiters are not notified", () => {
    let calls = 0;
    const off = onLockReleased(() => { calls++; });
    off();
    claimActive("tour_invite_seen");
    releaseActive("tour_invite_seen");
    expect(calls).toBe(0);
  });
});
