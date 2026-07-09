import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { sectionFamily, useCompareMode } from "@/lib/canvas/features/useCompareMode";
import { useFinalArrangement } from "@/lib/canvas/features/useFinalArrangement";
import { clampToBoard, finalColumnSlot, ideaColumnSlot, COLUMN_GAP } from "@/lib/canvas/canvasGeometry";
import { CANVAS_WIDTH } from "@/lib/canvas/canvasConstants";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard => ({
  id: "c1", tree: "ideas", type: "lyric", title: "t", body: "", meta: "",
  section: "Chorus", contributor: "Me", status: "raw", accent: "#C0754F",
  x: 80, y: 272, ...over,
});

describe("compare mode — section-family partner matching (rescue blocker #5)", () => {
  it("treats auto-numbered variants as the same family", () => {
    expect(sectionFamily("Chorus 1")).toBe(sectionFamily("Chorus 2"));
    expect(sectionFamily("Verse 1")).not.toBe(sectionFamily("Chorus 1"));
  });

  it("canCompare is true for Chorus 1 vs Chorus 2 — the paved path", () => {
    const a = card({ id: "a", section: "Chorus 1" });
    const b = card({ id: "b", section: "Chorus 2" });
    const { result } = renderHook(() =>
      useCompareMode({ cards: [a, b], isViewer: false, mutations: { patchCards: () => {} } }),
    );
    expect(result.current.canCompare(a)).toBe(true);
    act(() => result.current.open("a"));
    expect(result.current.pair?.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("prefers an exact-section partner when one exists", () => {
    const a = card({ id: "a", section: "Verse 1" });
    const exact = card({ id: "exact", section: "Verse 1" });
    const cousin = card({ id: "cousin", section: "Verse 2" });
    const { result } = renderHook(() =>
      useCompareMode({ cards: [cousin, a, exact], isViewer: false, mutations: { patchCards: () => {} } }),
    );
    act(() => result.current.open("a"));
    expect(result.current.pair?.[1].id).toBe("exact");
  });
});

describe("final arrangement — moveToIdeas never deletes (rescue blocker #6)", () => {
  const harness = (cards: CanvasBoardCard[]) => {
    const patches: Array<{ id: string; patch: Partial<CanvasBoardCard> }> = [];
    let returned: { finalCardId: string; sourceId: string | null } | null = null;
    const { result } = renderHook(() =>
      useFinalArrangement({
        cards,
        isViewer: false,
        mutations: {
          patchCards: (p) => patches.push(...p),
          promoteToFinal: () => {},
          returnToIdeas: (finalCardId, sourceId) => { returned = { finalCardId, sourceId }; },
        },
        finalSlot: finalColumnSlot,
        ideaSlot: ideaColumnSlot,
      }),
    );
    return { result, patches, returned: () => returned };
  };

  it("uses returnToIdeas when the dimmed source exists (sourceCardId provenance)", () => {
    const source = card({ id: "src", isDimmedReference: true, dimReason: "moved_to_final" });
    const final = card({ id: "src-final", tree: "final", sourceCardId: "src", x: 880 });
    const h = harness([source, final]);
    act(() => h.result.current.moveToIdeas("src-final"));
    expect(h.returned()).toEqual({ finalCardId: "src-final", sourceId: "src" });
  });

  it("PATCHES a sourceless final card back to Ideas instead of deleting it", () => {
    const orphan = card({ id: "db-abc", tree: "final", x: 880 });
    const h = harness([orphan]);
    act(() => h.result.current.moveToIdeas("db-abc"));
    expect(h.returned()).toBeNull();
    const patch = h.patches.find((p) => p.id === "db-abc");
    expect(patch?.patch.tree).toBe("ideas");
    expect(patch?.patch.status).toBe("raw");
  });
});

describe("board geometry — cards can't overlap or strand (rescue majors)", () => {
  it("column gap exceeds a card's real rendered height", () => {
    expect(COLUMN_GAP).toBeGreaterThanOrEqual(208);
  });

  it("clampToBoard keeps a flung card inside the pannable board", () => {
    const { x, y } = clampToBoard(99999, -500, "lyric");
    expect(x).toBeLessThan(CANVAS_WIDTH);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  it("idea sub-columns never cross the divider into the Final zone", () => {
    for (let i = 0; i < 60; i++) {
      const { x } = ideaColumnSlot(i);
      expect(x + 208).toBeLessThanOrEqual(CANVAS_WIDTH / 2);
    }
  });
});
