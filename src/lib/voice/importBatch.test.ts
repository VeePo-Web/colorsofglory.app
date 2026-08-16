import { describe, it, expect } from "vitest";
import { batchSettled, isLikelyDuplicate, summarizeBatch, type BatchFileState } from "./importBatch";

const s = (...states: BatchFileState[]) => states;

/** Lane D · Moment 3 — one calm line, per-file truth, a failed file retries alone. */
describe("summarizeBatch — the one calm line", () => {
  it("says nothing when there is no batch", () => {
    expect(summarizeBatch([])).toBe(null);
  });
  it("a fresh batch counts itself honestly", () => {
    expect(summarizeBatch(s("saving"))).toBe("Saving…");
    expect(summarizeBatch(s("saving", "saving", "saving"))).toBe("Saving 3…");
  });
  it("progress names what's left, not a percentage", () => {
    expect(summarizeBatch(s("saved", "saving", "saving"))).toBe("Saving 2 of 3…");
    expect(summarizeBatch(s("saved", "failed", "saving"))).toBe("Saving 1 of 3…");
  });
  it("a finished batch lands quietly", () => {
    expect(summarizeBatch(s("saved"))).toBe("Saved");
    expect(summarizeBatch(s("saved", "saved", "saved"))).toBe("3 saved");
  });
  it("partial failure names the count and the fix — never a red wall", () => {
    expect(summarizeBatch(s("saved", "saved", "failed"))).toBe("2 saved. 1 needs a retry.");
    expect(summarizeBatch(s("saved", "failed", "failed"))).toBe("1 saved. 2 need a retry.");
    expect(summarizeBatch(s("failed"))).toBe("That one needs a retry.");
    expect(summarizeBatch(s("failed", "failed"))).toBe("2 need a retry.");
  });
  it("settled means every file has landed, either way", () => {
    expect(batchSettled(s("saved", "failed"))).toBe(true);
    expect(batchSettled(s("saved", "saving"))).toBe(false);
    expect(batchSettled([])).toBe(false);
  });
});

describe("isLikelyDuplicate — question the writer only when BOTH signals agree", () => {
  const existing = [
    { title: "New Recording 3", durationMs: 62_000 },
    { title: "Sunday hum", durationMs: 14_500 },
  ];
  it("same title (case-insensitive) + close duration → likely the same memo", () => {
    expect(isLikelyDuplicate({ title: "new recording 3", durationMs: 61_200 }, existing)).toBe(true);
  });
  it("same title but a different length is a NEW take, never questioned", () => {
    expect(isLikelyDuplicate({ title: "Sunday hum", durationMs: 44_000 }, existing)).toBe(false);
  });
  it("an unknown duration lets the title match stand alone", () => {
    expect(isLikelyDuplicate({ title: "Sunday hum", durationMs: 0 }, existing)).toBe(true);
  });
  it("different titles never collide, however close the length", () => {
    expect(isLikelyDuplicate({ title: "Monday hum", durationMs: 14_500 }, existing)).toBe(false);
  });
  it("a nameless file is never questioned", () => {
    expect(isLikelyDuplicate({ title: null, durationMs: 62_000 }, existing)).toBe(false);
  });
});
