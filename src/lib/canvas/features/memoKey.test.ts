import { describe, it, expect } from "vitest";
import { memoKey, memoIdForCard } from "./canvasAudio";

/**
 * THE ID-SPACE SEAM, pinned. Cards live in two id spaces (local raw uuids and
 * hydrated `db-voice-<uuid>` mirrors) while the stacking pipeline speaks raw
 * memo ids. This seam silently broke stacking everywhere it wasn't resolved:
 * layers persisted as bases, hydrated stacks played silence, counts read 0.
 */

const RAW = "11111111-1111-4111-8111-111111111111";

describe("memoKey — one resolver for every stack comparison", () => {
  it("strips the hydrated mirror prefix down to the raw memo id", () => {
    expect(memoKey(`db-voice-${RAW}`)).toBe(RAW);
  });

  it("passes raw memo/pending uuids through untouched", () => {
    expect(memoKey(RAW)).toBe(RAW);
  });

  it("passes non-uuid local ids (demo cards) through untouched", () => {
    expect(memoKey("hum-1")).toBe("hum-1");
  });

  it("a local base card and its hydrated mirror resolve to the SAME key", () => {
    expect(memoKey(RAW)).toBe(memoKey(`db-voice-${RAW}`));
  });

  it("memoIdForCard still refuses garbage behind the prefix", () => {
    expect(memoIdForCard("db-voice-not-a-uuid")).toBeNull();
    // …but memoKey never throws away an id — it falls back to the input.
    expect(memoKey("db-voice-not-a-uuid")).toBe("db-voice-not-a-uuid");
  });
});
