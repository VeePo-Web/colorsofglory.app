import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./audioCache", () => ({
  audioCache: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), prefetch: vi.fn() },
}));

import { audioCache } from "./audioCache";
import {
  clearAllFailedCaptures,
  clearFailedCapture,
  getFailedCaptureFile,
  listFailedCaptures,
  saveFailedCapture,
} from "./failedCaptureStore";

const mockCache = vi.mocked(audioCache);
const KEY = "cog-failed-captures";
const readRaw = (): Array<{ id: string }> => {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
};
const blob = (c = "audio") => new Blob([c], { type: "audio/mp4" });

describe("failedCaptureStore — durable failed-take recovery", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockCache.set.mockResolvedValue(undefined);
    mockCache.delete.mockResolvedValue(undefined);
    mockCache.get.mockResolvedValue(null);
  });

  it("caches the blob BEFORE the index row — the take survives a reload", async () => {
    const order: string[] = [];
    mockCache.set.mockImplementation(async () => { order.push("cache"); });
    const rec = await saveFailedCapture(blob(), { songId: "s1", title: "Bridge", durationMs: 4200 });
    expect(mockCache.set).toHaveBeenCalledWith(rec.id, expect.any(Blob));
    order.push("index");
    expect(order).toEqual(["cache", "index"]);
    expect(readRaw()).toHaveLength(1);
    expect(rec).toMatchObject({ songId: "s1", title: "Bridge", durationMs: 4200, mimeType: "audio/mp4" });
  });

  it("rebuilds the original File from the cache for retry", async () => {
    const b = blob("the take");
    const rec = await saveFailedCapture(b, { songId: null, title: "Idea", durationMs: 1000 });
    mockCache.get.mockResolvedValue(b);
    const file = await getFailedCaptureFile(rec.id);
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe("audio/mp4");
  });

  it("sweeps an orphan row when the cached blob is gone", async () => {
    const rec = await saveFailedCapture(blob(), { songId: null, title: "x", durationMs: 1 });
    mockCache.get.mockResolvedValue(null);
    const file = await getFailedCaptureFile(rec.id);
    expect(file).toBeNull();
    expect(readRaw()).toHaveLength(0);
  });

  it("keeps a layer's parentage + origin through the salvage — an interrupted layer must come back AS A LAYER", async () => {
    // The hallway covenant (ledger F1): a "record over this" interrupted by
    // a call, then lost with a killed tab, is reclaimed by the canvas WITH
    // its base — parentMemoId and the canvas origin ride the durable record.
    const rec = await saveFailedCapture(blob(), {
      songId: "s1",
      title: "Interrupted layer",
      durationMs: 900,
      parentMemoId: "base-memo-uuid",
      origin: "canvas",
    });
    expect(rec).toMatchObject({ parentMemoId: "base-memo-uuid", origin: "canvas" });
    const listed = listFailedCaptures().find((r) => r.id === rec.id);
    expect(listed).toMatchObject({ parentMemoId: "base-memo-uuid", origin: "canvas" });
    // Legacy rows (no origin) still read as capture's — never auto-claimed.
    const legacy = await saveFailedCapture(blob(), { songId: "s1", title: "old", durationMs: 1 });
    expect(listFailedCaptures().find((r) => r.id === legacy.id)?.origin).toBeUndefined();
  });

  it("lists newest first and clears individually + wholesale", async () => {
    const a = await saveFailedCapture(blob("a"), { songId: null, title: "a", durationMs: 1 });
    await new Promise((r) => setTimeout(r, 2));
    const b2 = await saveFailedCapture(blob("b"), { songId: null, title: "b", durationMs: 1 });
    expect(listFailedCaptures().map((r) => r.id)).toEqual([b2.id, a.id]);

    await clearFailedCapture(a.id);
    expect(mockCache.delete).toHaveBeenCalledWith(a.id);
    expect(listFailedCaptures().map((r) => r.id)).toEqual([b2.id]);

    await clearAllFailedCaptures();
    expect(readRaw()).toHaveLength(0);
  });
});
