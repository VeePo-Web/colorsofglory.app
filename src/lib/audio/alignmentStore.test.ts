import { describe, it, expect, beforeEach } from "vitest";
import {
  __clearAlignmentOffsetsForTests,
  getAlignmentOffsetMs,
  rekeyAlignmentOffset,
  setAlignmentOffset,
} from "./alignmentStore";

describe("alignmentStore — layer latency offsets", () => {
  beforeEach(() => {
    __clearAlignmentOffsetsForTests();
  });

  it("returns 0 for unknown memos — the uniform no-shift path", () => {
    expect(getAlignmentOffsetMs("nope")).toBe(0);
  });

  it("stores and reads a measured offset", () => {
    setAlignmentOffset("layer-1", 184);
    expect(getAlignmentOffsetMs("layer-1")).toBe(184);
  });

  it("ignores zero/negative/absurd values instead of corrupting playback", () => {
    setAlignmentOffset("a", 0);
    setAlignmentOffset("b", -50);
    setAlignmentOffset("c", Number.NaN);
    expect(getAlignmentOffsetMs("a")).toBe(0);
    expect(getAlignmentOffsetMs("b")).toBe(0);
    expect(getAlignmentOffsetMs("c")).toBe(0);
    setAlignmentOffset("d", 10_000); // a measurement error, not latency
    expect(getAlignmentOffsetMs("d")).toBe(2000);
  });

  it("follows a queued take from its temp id to the real memo id", () => {
    setAlignmentOffset("pending-123", 220);
    rekeyAlignmentOffset("pending-123", "memo-real");
    expect(getAlignmentOffsetMs("pending-123")).toBe(0);
    expect(getAlignmentOffsetMs("memo-real")).toBe(220);
  });

  it("rekey without a stored offset is a harmless no-op", () => {
    rekeyAlignmentOffset("ghost", "memo-x");
    expect(getAlignmentOffsetMs("memo-x")).toBe(0);
  });
});
