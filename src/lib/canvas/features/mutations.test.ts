import { describe, it, expect } from "vitest";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { applyPromoteToFinal } from "./mutations";

// The reducer only reads `id` and spreads the rest, so a minimal shape suffices.
const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({ id: "x", type: "lyric", tree: "ideas", title: "", body: "", section: "", x: 0, y: 0, ...over } as CanvasBoardCard);

const source = card({ id: "idea1", tree: "ideas", isDimmedReference: false });
const finalCopy = card({ id: "idea1-final", tree: "final", sourceCardId: "idea1", status: "approved" });

describe("applyPromoteToFinal — moving an idea to Final is idempotent", () => {
  it("promotes once: dims the source (never deletes it) and appends the Final copy", () => {
    const next = applyPromoteToFinal([source], "idea1", finalCopy);
    expect(next).toHaveLength(2);
    expect(next.find((c) => c.id === "idea1")?.isDimmedReference).toBe(true);
    expect(next.find((c) => c.id === "idea1")?.tree).toBe("ideas"); // original preserved in Ideas
    expect(next.find((c) => c.id === "idea1-final")?.tree).toBe("final");
  });

  it("a double-tap can't append a duplicate Final card (colliding id)", () => {
    const once = applyPromoteToFinal([source], "idea1", finalCopy);
    const twice = applyPromoteToFinal(once, "idea1", finalCopy);
    expect(twice.filter((c) => c.id === "idea1-final")).toHaveLength(1);
    expect(twice).toHaveLength(2); // still 2, never 3
    expect(twice).toBe(once); // unchanged reference → no needless re-render, no re-dim
  });

  it("leaves other cards untouched", () => {
    const other = card({ id: "idea2", tree: "ideas" });
    const next = applyPromoteToFinal([source, other], "idea1", finalCopy);
    expect(next.find((c) => c.id === "idea2")).toBe(other);
  });
});
