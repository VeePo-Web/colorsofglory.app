import { describe, it, expect } from "vitest";
import { decideSwipe, SWIPE, type SwipeEnd } from "./swipeDecision";

// A surface where both neighbours exist unless a test says otherwise.
const base: SwipeEnd = { dx: 0, dy: 0, velocity: 0, hasLeft: true, hasRight: true };
const end = (o: Partial<SwipeEnd>): SwipeEnd => ({ ...base, ...o });

describe("decideSwipe — distance commit", () => {
  it("commits right on a slow drag past the trigger", () => {
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX + 10 }))).toBe("right");
  });
  it("commits left on a slow drag past the trigger", () => {
    expect(decideSwipe(end({ dx: -(SWIPE.TRIGGER_PX + 10) }))).toBe("left");
  });
  it("does NOT commit a slow drag under the trigger", () => {
    // Half the threshold, no velocity — a deliberate short drag that snaps back.
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX - 10, velocity: 0 }))).toBeNull();
  });
});

describe("decideSwipe — velocity / flick commit (the pass-21 regression guard)", () => {
  it("commits a fast short flick under the distance threshold", () => {
    // 30px travel (< 64px trigger) but a genuine fast flick → should page.
    expect(decideSwipe(end({ dx: 30, velocity: SWIPE.FLICK_VELOCITY + 0.2 }))).toBe("right");
  });
  it("does NOT commit a flick that is too slow", () => {
    expect(decideSwipe(end({ dx: 30, velocity: SWIPE.FLICK_VELOCITY - 0.2 }))).toBeNull();
  });
  it("does NOT commit a flick with too little travel (tap jitter)", () => {
    expect(decideSwipe(end({ dx: SWIPE.MIN_FLICK_PX - 5, velocity: 2 }))).toBeNull();
  });
  it("does NOT commit when the flick direction opposes the drag (reverse flick)", () => {
    // Dragged right, but velocity is negative at release → no misfire.
    expect(decideSwipe(end({ dx: 30, velocity: -(SWIPE.FLICK_VELOCITY + 0.5) }))).toBeNull();
  });
  it("a deliberate hold-and-release (velocity decayed to ~0) falls back to distance", () => {
    // Far enough by distance, zero velocity → still commits (hold then let go).
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX + 5, velocity: 0 }))).toBe("right");
  });
});

describe("decideSwipe — axis dominance", () => {
  it("rejects a vertical-dominant drag (it was a scroll)", () => {
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX + 20, dy: 200 }))).toBeNull();
  });
  it("accepts when horizontal clearly dominates", () => {
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX + 40, dy: 10 }))).toBe("right");
  });
});

describe("decideSwipe — destination must exist (the geography never lies)", () => {
  it("does not commit right when nothing lives to the left", () => {
    expect(decideSwipe(end({ dx: SWIPE.TRIGGER_PX + 20, hasRight: false }))).toBeNull();
  });
  it("does not commit left when nothing lives to the right", () => {
    expect(decideSwipe(end({ dx: -(SWIPE.TRIGGER_PX + 20), hasLeft: false }))).toBeNull();
  });
  it("commits only the direction that has a destination", () => {
    // Room surface: only a left-swipe-back destination exists (onSwipeRight only).
    const roomLike: SwipeEnd = { dx: SWIPE.TRIGGER_PX + 20, dy: 0, velocity: 0, hasLeft: false, hasRight: true };
    expect(decideSwipe(roomLike)).toBe("right");
    expect(decideSwipe({ ...roomLike, dx: -(SWIPE.TRIGGER_PX + 20) })).toBeNull();
  });
});
