import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Every test runs against an ABSENT server — the seam returns null/false, the
 * exact "table not deployed yet / offline" reality the Amens feature is built
 * to survive. The assertion under all of it: an amen ALWAYS lands, instantly
 * and device-local, and nothing ever throws. This is the hook-level proof of
 * the "no fail rate / works every time" contract (the pure model + chip are
 * tested separately).
 */
vi.mock("@/integrations/cog/reactions", () => ({
  probeReactionsTable: async () => false,
  listCardReactions: async () => null,
  addCardReaction: async () => null,
  removeCardReaction: async () => false,
  subscribeCardReactions: () => () => {},
}));

import { useAmens } from "./useAmens";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* jsdom always has it */ }
});

const opts = { userId: "me", isDemo: false } as const;

describe("useAmens — optimistic, offline-first, never fails", () => {
  it("an amen lands instantly and device-local, with no server behind it", () => {
    const { result } = renderHook(() => useAmens("s1", opts));
    act(() => { result.current.toggleAmen("card1", "amen"); });
    const s = result.current.summaries.get("card1");
    expect(s?.count).toBe(1);
    expect(s?.mine.has("amen")).toBe(true);
  });

  it("tapping the same amen again quietly withdraws it (add+remove annihilate)", () => {
    const { result } = renderHook(() => useAmens("s2", opts));
    act(() => { result.current.toggleAmen("card1", "amen"); });
    act(() => { result.current.toggleAmen("card1", "amen"); });
    expect(result.current.summaries.get("card1")).toBeUndefined();
  });

  it("kinds and cards stay independent", () => {
    const { result } = renderHook(() => useAmens("s3", opts));
    act(() => {
      result.current.toggleAmen("card1", "amen");
      result.current.toggleAmen("card1", "heart");
      result.current.toggleAmen("card2", "keeper");
    });
    expect(result.current.summaries.get("card1")?.count).toBe(2);
    expect(result.current.summaries.get("card1")?.mine.has("heart")).toBe(true);
    expect(result.current.summaries.get("card2")?.mine.has("keeper")).toBe(true);
  });

  it("the amen survives a remount — offline reloads keep the warmth", () => {
    const first = renderHook(() => useAmens("s4", opts));
    act(() => { first.result.current.toggleAmen("card1", "amen"); });
    first.unmount();
    const second = renderHook(() => useAmens("s4", opts));
    expect(second.result.current.summaries.get("card1")?.mine.has("amen")).toBe(true);
  });
});
