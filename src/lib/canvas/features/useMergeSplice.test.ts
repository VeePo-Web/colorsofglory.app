import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { useMergeSplice } from "./useMergeSplice";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({
    id: "x", type: "lyric", tree: "ideas", title: "T", body: "b", section: "Verse",
    contributor: "Sarah", accent: "#B8953A", x: 0, y: 0, ...over,
  } as CanvasBoardCard);

const cards = [card({ id: "a", title: "A" }), card({ id: "b", title: "B" })];

const setup = (isViewer = false) => {
  const applyMerge = vi.fn();
  const revertMerge = vi.fn();
  const view = renderHook(() =>
    useMergeSplice({ cards, isViewer, mutations: { applyMerge, revertMerge } }),
  );
  return { ...view, applyMerge };
};

describe("useMergeSplice — Create draft is double-tap safe", () => {
  it("a rapid double-tap merges exactly once (no duplicate persisted draft)", () => {
    const { result, applyMerge } = setup();
    act(() => { result.current.toggleSelect("a"); result.current.toggleSelect("b"); });
    // Both presses land before setSelection([]) re-renders the callback.
    act(() => { result.current.executeMerge(); result.current.executeMerge(); });
    expect(applyMerge).toHaveBeenCalledTimes(1);
  });

  it("clears the selection, and the latch releases so a fresh pair can merge again", () => {
    const { result, applyMerge } = setup();
    act(() => { result.current.toggleSelect("a"); result.current.toggleSelect("b"); });
    act(() => { result.current.executeMerge(); });
    expect(result.current.selection).toEqual([]);

    act(() => { result.current.toggleSelect("a"); result.current.toggleSelect("b"); });
    act(() => { result.current.executeMerge(); });
    expect(applyMerge).toHaveBeenCalledTimes(2);
  });

  it("a viewer cannot merge", () => {
    const { result, applyMerge } = setup(true);
    act(() => { result.current.toggleSelect("a"); result.current.toggleSelect("b"); });
    act(() => { result.current.executeMerge(); });
    expect(applyMerge).not.toHaveBeenCalled();
  });
});
