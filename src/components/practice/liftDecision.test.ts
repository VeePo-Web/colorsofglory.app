import { describe, it, expect } from "vitest";
import { decideLift, LIFT } from "./liftDecision";

const base = { dx: 0, velocity: 0, hasUp: true, hasDown: true };

describe("liftDecision — one family, one feel (the swipeDecision mirror)", () => {
  it("commits UP on a slow full drag past the trigger", () => {
    expect(decideLift({ ...base, dy: -LIFT.TRIGGER_PX })).toBe("up");
    expect(decideLift({ ...base, dy: -(LIFT.TRIGGER_PX - 1) })).toBeNull();
  });

  it("commits DOWN symmetrically", () => {
    expect(decideLift({ ...base, dy: LIFT.TRIGGER_PX })).toBe("down");
  });

  it("a fast flick commits early — but NEVER on velocity alone (min travel)", () => {
    expect(
      decideLift({ ...base, dy: -LIFT.MIN_FLICK_PX, velocity: -LIFT.FLICK_VELOCITY }),
    ).toBe("up");
    // Jittery tap: huge velocity, tiny travel → no commit.
    expect(decideLift({ ...base, dy: -8, velocity: -2 })).toBeNull();
  });

  it("a flick against the travel direction never commits (sign match)", () => {
    expect(decideLift({ ...base, dy: -LIFT.MIN_FLICK_PX - 4, velocity: +1 })).toBeNull();
  });

  it("horizontal-dominant movement stands down (the pager/pan wins)", () => {
    expect(decideLift({ ...base, dy: -80, dx: 80 })).toBeNull();
  });

  it("directions without a destination never commit", () => {
    expect(decideLift({ ...base, dy: -100, hasUp: false })).toBeNull();
    expect(decideLift({ ...base, dy: 100, hasDown: false })).toBeNull();
  });

  it("the constants stay in the horizontal family — one feel", async () => {
    const { SWIPE } = await import("@/lib/nav/swipeDecision");
    expect(LIFT.INTENT_PX).toBe(SWIPE.INTENT_PX);
    expect(LIFT.TRIGGER_PX).toBe(SWIPE.TRIGGER_PX);
    expect(LIFT.MIN_FLICK_PX).toBe(SWIPE.MIN_FLICK_PX);
    expect(LIFT.FLICK_VELOCITY).toBe(SWIPE.FLICK_VELOCITY);
    expect(LIFT.AXIS_RATIO).toBe(SWIPE.AXIS_RATIO);
    expect(LIFT.RESIST).toBe(SWIPE.RESIST);
  });
});
