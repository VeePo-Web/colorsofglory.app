import { describe, it, expect } from "vitest";
import { finalRunningOrder, finalColumnSlot, FINAL_COLUMN_X } from "./canvasGeometry";

const at = (id: string, x: number, y: number) => ({ id, x, y });

describe("finalRunningOrder — the arrangement stays true past 10 parts", () => {
  it("keeps insertion order for auto-slotted cards across the sub-column wrap", () => {
    // 14 cards: indexes 0-9 fill column 0, 10-13 wrap into column 1 — where a
    // y-only sort used to TIE index 0 with index 10 and scramble the song.
    const cards = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, ...finalColumnSlot(i) }));
    const shuffled = [...cards].reverse();
    const ordered = shuffled.sort(finalRunningOrder).map((c) => c.id);
    expect(ordered).toEqual(cards.map((c) => c.id));
  });

  it("a single-column board keeps the old pure top-to-bottom order", () => {
    const ordered = [
      at("b", FINAL_COLUMN_X + 30, 500), // free-dragged wiggle stays in col 0
      at("a", FINAL_COLUMN_X, 100),
      at("c", FINAL_COLUMN_X - 40, 900),
    ].sort(finalRunningOrder);
    expect(ordered.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("identical slots tie-break deterministically by id (moveBy stays stable)", () => {
    const ordered = [at("z", FINAL_COLUMN_X, 272), at("a", FINAL_COLUMN_X, 272)].sort(finalRunningOrder);
    expect(ordered.map((c) => c.id)).toEqual(["a", "z"]);
  });
});
