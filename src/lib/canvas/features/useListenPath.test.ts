import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { useListenPath } from "./useListenPath";

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("./canvasAudio", () => ({
  memoIdForCard: (id: string) =>
    id.startsWith("db-voice-") ? id.slice("db-voice-".length) : null,
  pauseCanvasAudio: vi.fn(),
  playMemoOnCanvas: vi.fn(async () => true),
  preloadMemo: vi.fn(async () => {}),
  stopCanvasAudio: vi.fn(),
}));

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({ id: "x", type: "lyric", tree: "ideas", title: "", body: "b", section: "Verse", x: 0, y: 0, contributor: "Me", ...over } as CanvasBoardCard);

const cards = [card({ id: "a" }), card({ id: "b" }), card({ id: "c" })];

const setup = (opts: { savedQueue?: string[] } = {}) => {
  const saveListenPath = vi.fn();
  const view = renderHook(() =>
    useListenPath({ cards, mutations: { saveListenPath }, savedQueue: opts.savedQueue }),
  );
  return { ...view, saveListenPath };
};

describe("useListenPath — the F20 queue state machine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("toggleCard builds the queue and removes a stop; step follows the playing card", () => {
    const { result } = setup();
    act(() => { result.current.toggleCard("a"); result.current.toggleCard("b"); result.current.toggleCard("c"); });
    expect(result.current.queue).toEqual(["a", "b", "c"]);
    act(() => { result.current.goTo(2); });
    // Removing an EARLIER stop must not shift which card the pointer means.
    act(() => { result.current.removeCard("a"); });
    expect(result.current.queue).toEqual(["b", "c"]);
    expect(result.current.step).toBe(1); // still pointing at "c"
  });

  it("playAll plays from the top and a non-audio card auto-advances after its dwell", () => {
    const { result } = setup();
    act(() => { result.current.playAll(["a", "b"]); });
    expect(result.current.playing).toBe(true);
    expect(result.current.step).toBe(0);
    act(() => { vi.advanceTimersByTime(3600); }); // > DWELL_MS
    expect(result.current.step).toBe(1);
    // The path rests at the top when it finishes.
    act(() => { vi.advanceTimersByTime(3600); });
    expect(result.current.playing).toBe(false);
    expect(result.current.step).toBe(0);
  });

  it("replaceCardId renames the live queue AND silently rewrites a saved path holding the old id", () => {
    const { result, saveListenPath } = setup({ savedQueue: ["temp-1", "b"] });
    act(() => { result.current.playAll(["temp-1", "b"]); result.current.playPause(); });
    act(() => { result.current.replaceCardId("temp-1", "db-voice-123"); });
    expect(result.current.queue).toEqual(["db-voice-123", "b"]);
    expect(saveListenPath).toHaveBeenCalledWith(["db-voice-123", "b"]);
  });

  it("a rename leaves an unrelated saved path alone", () => {
    const { result, saveListenPath } = setup({ savedQueue: ["b", "c"] });
    act(() => { result.current.replaceCardId("temp-1", "db-voice-123"); });
    expect(saveListenPath).not.toHaveBeenCalled();
  });

  it("clear silences and empties", () => {
    const { result } = setup();
    act(() => { result.current.playAll(["a", "b"]); });
    act(() => { result.current.clear(); });
    expect(result.current.queue).toEqual([]);
    expect(result.current.playing).toBe(false);
  });
});
