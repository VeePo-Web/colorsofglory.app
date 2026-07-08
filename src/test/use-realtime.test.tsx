import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";

// ── Capture the handlers the hooks register, and hand back an unsubscribe spy
//    so we can assert channel cleanup survives remount with no leaks. ─────────
let songHandlers: Record<string, () => void> = {};
let memoHandler: ((p: { event: string; memo?: unknown }) => void) | null = null;
let billingHandler: ((k: "subscription" | "storage") => void) | null = null;
const songUnsub = vi.fn();
const memoUnsub = vi.fn();
const billingUnsub = vi.fn();
const subscribeSongRoom = vi.fn((_id: string, handlers: Record<string, () => void>) => {
  songHandlers = handlers;
  return songUnsub;
});
const subscribeMemos = vi.fn((_id: string, cb: (p: { event: string }) => void) => {
  memoHandler = cb;
  return memoUnsub;
});
const subscribeBilling = vi.fn((_id: string, cb: (k: "subscription" | "storage") => void) => {
  billingHandler = cb;
  return billingUnsub;
});

vi.mock("@/integrations/cog/realtime", () => ({
  subscribeSongRoom: (...a: [string, Record<string, () => void>]) => subscribeSongRoom(...a),
  subscribeBilling: (...a: [string, (k: "subscription" | "storage") => void]) => subscribeBilling(...a),
}));
vi.mock("@/integrations/cog/memos", () => ({
  subscribeMemos: (...a: [string, (p: { event: string }) => void]) => subscribeMemos(...a),
}));

import { useRealtimeSong, useRealtimeMemos, useRealtimeBilling } from "@/hooks/useRealtime";

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function keys(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
}

describe("useRealtimeSong", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps each song-room event to the right invalidation keys (content ignored)", () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    renderHook(() => useRealtimeSong("s1"), { wrapper: wrapper(qc) });

    songHandlers.onActivity!();
    songHandlers.onCardChange!();
    songHandlers.onTakeChange!();
    songHandlers.onCaptureChange!();

    const k = keys(inv);
    expect(k).toContain(JSON.stringify(["song", "s1", "activity"]));
    expect(k).toContain(JSON.stringify(["song", "s1", "canvas"]));
    expect(k).toContain(JSON.stringify(["song", "s1", "memos"]));
    expect(k).toContain(JSON.stringify(["song", "s1", "captures"]));
    expect(k).toContain(JSON.stringify(["song", "s1", "detail"]));
  });

  it("does not subscribe with no songId, and tears the channel down on unmount", () => {
    const qc = new QueryClient();
    const { unmount, rerender } = renderHook(() => useRealtimeSong("s1"), {
      wrapper: wrapper(qc),
    });
    expect(subscribeSongRoom).toHaveBeenCalledTimes(1);
    rerender(); // stable id → no re-subscribe
    expect(subscribeSongRoom).toHaveBeenCalledTimes(1);
    unmount();
    expect(songUnsub).toHaveBeenCalledTimes(1);
  });

  it("survives remount with exactly one live channel — no leak/duplicate", () => {
    const qc = new QueryClient();
    const first = renderHook(() => useRealtimeSong("s1"), { wrapper: wrapper(qc) });
    first.unmount();
    renderHook(() => useRealtimeSong("s1"), { wrapper: wrapper(qc) });
    // 2 subscribes total, 1 unsubscribe so far → net one open channel.
    expect(subscribeSongRoom).toHaveBeenCalledTimes(2);
    expect(songUnsub).toHaveBeenCalledTimes(1);
  });
});

describe("useRealtimeMemos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates memos + detail on a memo change, memos-only on a transcript", () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    renderHook(() => useRealtimeMemos("s1"), { wrapper: wrapper(qc) });

    memoHandler!({ event: "INSERT" });
    expect(keys(inv)).toEqual([
      JSON.stringify(["song", "s1", "memos"]),
      JSON.stringify(["song", "s1", "detail"]),
    ]);

    inv.mockClear();
    memoHandler!({ event: "transcript:UPDATE" });
    expect(keys(inv)).toEqual([JSON.stringify(["song", "s1", "memos"])]);
  });
});

describe("useRealtimeBilling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates subscription+billing always, storage only on a storage change", () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    renderHook(() => useRealtimeBilling("u1"), { wrapper: wrapper(qc) });

    billingHandler!("subscription");
    expect(keys(inv)).toEqual([
      JSON.stringify(["subscription", "u1"]),
      JSON.stringify(["billing"]),
    ]);

    inv.mockClear();
    billingHandler!("storage");
    expect(keys(inv)).toEqual([
      JSON.stringify(["subscription", "u1"]),
      JSON.stringify(["billing"]),
      JSON.stringify(["storage"]),
    ]);
  });
});
