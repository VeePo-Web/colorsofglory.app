import { describe, expect, it } from "vitest";
import { canPlayMemo } from "./memoPlayback";

describe("canPlayMemo — play-before-upload", () => {
  it("plays a server-ready take", () => {
    expect(canPlayMemo({ isReady: true, hasLocalBlob: false })).toBe(true);
  });

  it("plays a still-queued take the instant it is captured, from the local blob", () => {
    // The take has no server record yet (not ready), but the outbox cached its
    // blob locally — the songwriter must be able to hear it immediately, offline.
    expect(canPlayMemo({ isReady: false, hasLocalBlob: true })).toBe(true);
  });

  it("does not offer play for a take that is neither ready nor cached", () => {
    expect(canPlayMemo({ isReady: false, hasLocalBlob: false })).toBe(false);
  });
});
