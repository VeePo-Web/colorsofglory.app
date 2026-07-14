import { describe, it, expect } from "vitest";
import { clampBpm, computeCatchUp } from "./metronome";

/**
 * The engine's audible/silent behavior is enforced by the audio-session gate
 * (covered in lib/audio/audioSession.test.ts — the never-bleed invariant) and
 * the class internals need a live AudioContext, so unit coverage here focuses
 * on the pure math every consumer shares.
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

describe("computeCatchUp — the background-throttle burst guard", () => {
  it("does nothing when the scheduler is on time", () => {
    expect(computeCatchUp(10.0, 9.5, 0.5)).toEqual({ skippedBeats: 0, nextNoteTime: 10.0 });
  });

  it("fast-forwards past a backgrounded gap to the next on-grid time", () => {
    // Scheduler slept 10s at 120 BPM (0.5s beats): 20 whole beats missed.
    const { skippedBeats, nextNoteTime } = computeCatchUp(5.0, 15.0, 0.5);
    expect(skippedBeats).toBe(20);
    expect(nextNoteTime).toBeCloseTo(15.0, 9);
    expect(nextNoteTime).toBeGreaterThanOrEqual(15.0);
  });

  it("lands at or after `now`, never in the past (no click burst)", () => {
    const { nextNoteTime } = computeCatchUp(5.0, 15.13, 0.5);
    expect(nextNoteTime).toBeGreaterThanOrEqual(15.13);
    expect(nextNoteTime - 15.13).toBeLessThan(0.5); // and never over-skips a beat
  });

  it("preserves the bar phase via the skipped count", () => {
    // 7 beats skipped in 4/4 ⇒ the bar counter advances 7 (mod 4 = 3).
    const { skippedBeats } = computeCatchUp(0, 3.5, 0.5);
    expect(skippedBeats).toBe(7);
  });

  it("tolerates a degenerate beat length without dividing by zero", () => {
    expect(computeCatchUp(1, 2, 0)).toEqual({ skippedBeats: 0, nextNoteTime: 1 });
  });
});
