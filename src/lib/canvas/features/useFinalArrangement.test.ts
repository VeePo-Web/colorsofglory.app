import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { useFinalArrangement } from "./useFinalArrangement";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastMock }));

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({
    id: "x", type: "lyric", tree: "ideas", title: "T", body: "b", section: "Chorus",
    contributor: "Me", x: 0, y: 0, ...over,
  } as CanvasBoardCard);

const setup = (opts: { onHearInPlace?: (id: string) => void } = {}) => {
  const mutations = {
    patchCards: vi.fn(),
    promoteToFinal: vi.fn(),
    returnToIdeas: vi.fn(),
  };
  const view = renderHook(() =>
    useFinalArrangement({
      cards: [card({ id: "a" })],
      isViewer: false,
      mutations,
      finalSlot: (i) => ({ x: 1300, y: 272 + i * 208 }),
      ideaSlot: (i) => ({ x: 80, y: 272 + i * 208 }),
      onHearInPlace: opts.onHearInPlace,
    }),
  );
  return { ...view, mutations };
};

describe("useFinalArrangement — the promote toast's momentum hand-off", () => {
  beforeEach(() => toastMock.mockClear());

  it("with a hear hand-off: 'Hear it' is the action, Undo survives as the cancel", () => {
    const onHearInPlace = vi.fn();
    const { result, mutations } = setup({ onHearInPlace });
    act(() => result.current.moveToFinal("a"));
    expect(mutations.promoteToFinal).toHaveBeenCalledWith("a", expect.objectContaining({ id: "a-final" }));

    const [, opts] = toastMock.mock.calls[0];
    expect(opts.action.label).toBe("Hear it");
    expect(opts.cancel.label).toBe("Undo");
    // "Hear it" hands over the freshly landed part…
    opts.action.onClick();
    expect(onHearInPlace).toHaveBeenCalledWith("a-final");
    // …and Undo still reverses the promote completely.
    opts.cancel.onClick();
    expect(mutations.returnToIdeas).toHaveBeenCalledWith("a-final", "a");
  });

  it("without the hand-off, the toast keeps its original Undo-as-action shape", () => {
    const { result, mutations } = setup();
    act(() => result.current.moveToFinal("a"));
    const [, opts] = toastMock.mock.calls[0];
    expect(opts.action.label).toBe("Undo");
    expect(opts.cancel).toBeUndefined();
    opts.action.onClick();
    expect(mutations.returnToIdeas).toHaveBeenCalledWith("a-final", "a");
  });
});
