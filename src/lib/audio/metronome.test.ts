import { describe, it, expect } from "vitest";
import { clampBpm } from "./metronome";

/**
 * The engine's audible/silent behavior is enforced by the audio-session gate
 * (covered in lib/audio/audioSession.test.ts — the never-bleed invariant) and
 * the class internals need a live AudioContext, so unit coverage here focuses
 * on the pure tempo math every consumer shares.
 */
describe("clampBpm — the shared tempo range", () => {
  it("clamps into the musical range", () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(500)).toBe(300);
  });

  it("rounds fractional tap-tempo readings", () => {
    expect(clampBpm(92.4)).toBe(92);
    expect(clampBpm(92.6)).toBe(93);
  });

  it("recovers a sane default from garbage input", () => {
    expect(clampBpm(Number.NaN)).toBe(100);
    expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(100);
  });
});
