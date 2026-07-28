import { describe, it, expect, beforeEach } from "vitest";
import { activePointerCount, __resetPointerTallyForTests } from "./pointerTally";

/** jsdom has no PointerEvent constructor — a plain Event carrying pointerId
 *  exercises the exact property the capture listeners read. */
const fire = (type: string, pointerId: number) => {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { pointerId });
  window.dispatchEvent(e);
};

describe("pointerTally — the reverse-order-pinch census", () => {
  beforeEach(() => __resetPointerTallyForTests());

  it("counts fingers down and releases them", () => {
    fire("pointerdown", 1);
    expect(activePointerCount()).toBe(1);
    fire("pointerdown", 2);
    expect(activePointerCount()).toBe(2); // ← the card must refuse to arm here
    fire("pointerup", 1);
    fire("pointercancel", 2);
    expect(activePointerCount()).toBe(0);
  });

  it("the same pointer never double-counts", () => {
    fire("pointerdown", 7);
    fire("pointerdown", 7);
    expect(activePointerCount()).toBe(1);
  });

  it("window blur clears everything (fingers can vanish without pointerup)", () => {
    fire("pointerdown", 1);
    fire("pointerdown", 2);
    window.dispatchEvent(new Event("blur"));
    expect(activePointerCount()).toBe(0);
  });
});
