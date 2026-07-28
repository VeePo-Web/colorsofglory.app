import { describe, it, expect, beforeEach } from "vitest";
import { readReviewedIds, markReviewedId } from "./reviewedStore";

describe("reviewedStore — Keep-in-Ideas decisions survive reload", () => {
  beforeEach(() => localStorage.clear());

  it("a decision persists across a 'reload' (fresh read)", () => {
    markReviewedId("song1", "cardA");
    expect(readReviewedIds("song1").has("cardA")).toBe(true);
  });

  it("returns a fresh Set identity so React state updates", () => {
    const first = markReviewedId("song1", "cardA");
    const second = markReviewedId("song1", "cardB");
    expect(second).not.toBe(first);
    expect([...second].sort()).toEqual(["cardA", "cardB"]);
  });

  it("songs are isolated", () => {
    markReviewedId("song1", "cardA");
    expect(readReviewedIds("song2").size).toBe(0);
  });

  it("corrupt storage degrades to an empty set, never a throw", () => {
    localStorage.setItem("cog:reviewed-song1", "{not json");
    expect(readReviewedIds("song1").size).toBe(0);
  });
});
