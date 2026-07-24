import { describe, it, expect } from "vitest";
import { isSwipeOptOut } from "./useSwipeNav";

/**
 * The reported friction: dragging the Pad's volume slider left/right made the
 * page-swipe (Songs ← Capture → Circle) try to turn the page. A horizontal
 * drag control must be invisible to the swipe gesture.
 */
describe("isSwipeOptOut — the page-swipe never steals a horizontal control", () => {
  const container = () => document.createElement("div");

  it("opts out a range input (Pad volume, audio scrubber)", () => {
    const c = container();
    const input = document.createElement("input");
    input.type = "range";
    c.appendChild(input);
    expect(isSwipeOptOut(input, c)).toBe(true);
  });

  it("opts out a role=slider control", () => {
    const c = container();
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    c.appendChild(slider);
    expect(isSwipeOptOut(slider, c)).toBe(true);
  });

  it("opts out anything inside a data-no-swipe-nav subtree", () => {
    const c = container();
    const guarded = document.createElement("div");
    guarded.setAttribute("data-no-swipe-nav", "");
    const child = document.createElement("button");
    guarded.appendChild(child);
    c.appendChild(guarded);
    expect(isSwipeOptOut(child, c)).toBe(true);
  });

  it("does NOT opt out a plain button — the swipe still works there", () => {
    const c = container();
    const btn = document.createElement("button");
    c.appendChild(btn);
    expect(isSwipeOptOut(btn, c)).toBe(false);
  });

  it("climbs to the range input but leaves a sibling plain node free", () => {
    const c = container();
    const wrap = document.createElement("div");
    const input = document.createElement("input");
    input.type = "range";
    const plain = document.createElement("div");
    wrap.appendChild(input);
    wrap.appendChild(plain);
    c.appendChild(wrap);
    expect(isSwipeOptOut(input, c)).toBe(true);
    expect(isSwipeOptOut(plain, c)).toBe(false);
  });
});
