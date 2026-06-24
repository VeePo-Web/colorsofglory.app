import { describe, it, expect } from "vitest";
import { applyHidden, toggleHidden } from "@/lib/memory/hidden";

const clusters = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("applyHidden", () => {
  it("returns the same list when nothing is hidden", () => {
    expect(applyHidden(clusters, [])).toHaveLength(3);
  });
  it("filters out hidden ids", () => {
    expect(applyHidden(clusters, ["b"]).map((c) => c.id)).toEqual(["a", "c"]);
  });
  it("handles multiple hidden ids", () => {
    expect(applyHidden(clusters, ["a", "c"]).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("toggleHidden", () => {
  it("adds an id when absent", () => {
    expect(toggleHidden(["a"], "b")).toEqual(["a", "b"]);
  });
  it("removes an id when present (restore)", () => {
    expect(toggleHidden(["a", "b"], "a")).toEqual(["b"]);
  });
  it("does not mutate the input", () => {
    const input = ["a"];
    toggleHidden(input, "b");
    expect(input).toEqual(["a"]);
  });
});
