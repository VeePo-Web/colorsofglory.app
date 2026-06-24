import { describe, it, expect } from "vitest";
import { groupIntoStacks, resolveAudible, stackPlayOrder } from "./stackModel";

interface M {
  id: string;
  parentMemoId?: string | null;
  createdAt?: string;
}

describe("groupIntoStacks", () => {
  it("keeps a lone base as a stack with no layers", () => {
    const groups = groupIntoStacks<M>([{ id: "base" }]);
    expect(groups).toHaveLength(1);
    expect(groups[0].base.id).toBe("base");
    expect(groups[0].layers).toEqual([]);
  });

  it("nests a layer under its base and orders layers oldest-first", () => {
    const groups = groupIntoStacks<M>([
      { id: "base" },
      { id: "harmony", parentMemoId: "base", createdAt: "2026-06-20T10:01:00Z" },
      { id: "hum", parentMemoId: "base", createdAt: "2026-06-20T10:00:00Z" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].layers.map((l) => l.id)).toEqual(["hum", "harmony"]);
  });

  it("never loses an orphan layer — promotes it to its own base", () => {
    const groups = groupIntoStacks<M>([
      { id: "orphan", parentMemoId: "deleted-base" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].base.id).toBe("orphan");
  });

  it("ignores a self-referencing parent rather than dropping the memo", () => {
    const groups = groupIntoStacks<M>([{ id: "loop", parentMemoId: "loop" }]);
    expect(groups.map((g) => g.base.id)).toEqual(["loop"]);
  });

  it("play order is base first, then layers", () => {
    const [group] = groupIntoStacks<M>([
      { id: "base" },
      { id: "l1", parentMemoId: "base", createdAt: "2026-06-20T10:00:00Z" },
    ]);
    expect(stackPlayOrder(group)).toEqual(["base", "l1"]);
  });
});

describe("resolveAudible", () => {
  const ids = ["base", "l1", "l2"];

  it("plays everything when nothing is muted or soloed", () => {
    expect(resolveAudible(ids, new Set(), null)).toEqual(new Set(ids));
  });

  it("drops muted layers", () => {
    expect(resolveAudible(ids, new Set(["l1"]), null)).toEqual(new Set(["base", "l2"]));
  });

  it("solo wins over mute — only the soloed layer sounds", () => {
    expect(resolveAudible(ids, new Set(["base", "l2"]), "l1")).toEqual(new Set(["l1"]));
  });

  it("ignores a solo id that isn't in the stack", () => {
    expect(resolveAudible(ids, new Set(), "ghost")).toEqual(new Set(ids));
  });
});
