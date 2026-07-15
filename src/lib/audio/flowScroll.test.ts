import { describe, it, expect, beforeEach } from "vitest";
import {
  bpmToPixelsPerSecond,
  buildConstantKeyframes,
  buildSectionKeyframes,
  buildTimedKeyframes,
  clampFlowSpeed,
  DEFAULT_PIXELS_PER_SECOND,
  loadFlowSpeed,
  positionAt,
  sanitizeFrames,
  saveFlowSpeed,
  timeAt,
  totalDurationMs,
} from "./flowScroll";

describe("flowScroll — the works-every-time tiers", () => {
  it("Tier 1 always exists: constant velocity over the whole chart", () => {
    const frames = buildConstantKeyframes(3000, 15);
    expect(positionAt(frames, 0)).toBe(0);
    expect(positionAt(frames, 100_000)).toBe(1500); // 15 px/s × 100 s
    expect(positionAt(frames, totalDurationMs(frames))).toBe(3000);
    // Clamped at both ends — the scroll can never run away.
    expect(positionAt(frames, totalDurationMs(frames) + 60_000)).toBe(3000);
    expect(positionAt(frames, -5)).toBe(0);
  });

  it("Tier 1 survives an empty chart and a zero velocity", () => {
    expect(positionAt(buildConstantKeyframes(0, 15), 5000)).toBe(0);
    expect(totalDurationMs(buildConstantKeyframes(1000, 0))).toBeGreaterThan(0);
  });

  it("maps tempo to a readable stand pace, clamped and defaulting gently", () => {
    expect(bpmToPixelsPerSecond(96, 60)).toBeCloseTo(12, 5); // 60·96/480
    expect(bpmToPixelsPerSecond(30, 60)).toBe(6); // floor
    expect(bpmToPixelsPerSecond(400, 60)).toBe(40); // ceiling
    expect(bpmToPixelsPerSecond(null)).toBe(DEFAULT_PIXELS_PER_SECOND);
    expect(bpmToPixelsPerSecond(Number.NaN)).toBe(DEFAULT_PIXELS_PER_SECOND);
  });

  it("Tier 2 paces each section over its own take duration", () => {
    const frames = buildSectionKeyframes(
      [
        { top: 0, height: 1000, durationMs: 10_000 },
        { top: 1000, height: 500, durationMs: 30_000 }, // sparse but long
      ],
      1500,
    );
    expect(frames).not.toBeNull();
    // Halfway through the first take → halfway down the first (wordy) block.
    expect(positionAt(frames!, 5000)).toBeCloseTo(500, 3);
    // The slow sparse section crawls: 15s into its 30s → 250px of its 500px.
    expect(positionAt(frames!, 25_000)).toBeCloseTo(1250, 3);
    expect(positionAt(frames!, 40_000)).toBe(1500);
  });

  it("Tier 2 declines honestly when any section lacks a duration (fall back a tier)", () => {
    expect(
      buildSectionKeyframes(
        [
          { top: 0, height: 100, durationMs: 10_000 },
          { top: 100, height: 100, durationMs: 0 },
        ],
        200,
      ),
    ).toBeNull();
  });

  it("Tier 3 folds timed lines into the section timeline and stays monotonic", () => {
    const sectionFrames = buildSectionKeyframes(
      [{ top: 0, height: 1000, durationMs: 20_000 }],
      1000,
    );
    const frames = buildTimedKeyframes(
      [
        { tMs: 2000, y: 120 },
        { tMs: 6000, y: 90 }, // out-of-order stamp → becomes a hold, never a jump back
        { tMs: 10_000, y: 600 },
      ],
      sectionFrames,
      1000,
    );
    expect(frames).not.toBeNull();
    expect(positionAt(frames!, 2000)).toBeGreaterThanOrEqual(120);
    // Monotonic: position never decreases as time advances.
    let prev = -1;
    for (let t = 0; t <= 22_000; t += 500) {
      const y = positionAt(frames!, t);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(positionAt(frames!, totalDurationMs(frames!))).toBe(1000);
  });

  it("Tier 3 declines without timed lines (Tier 2/1 take over)", () => {
    expect(buildTimedKeyframes([], buildConstantKeyframes(100, 10), 100)).toBeNull();
  });

  it("sanitize tails out to the end so a missing final timestamp never strands the outro", () => {
    const frames = sanitizeFrames(
      [
        { tMs: 0, y: 0 },
        { tMs: 10_000, y: 500 },
      ],
      2000,
    );
    expect(frames).not.toBeNull();
    const total = totalDurationMs(frames!);
    expect(positionAt(frames!, total)).toBe(2000);
    expect(total).toBeGreaterThan(10_000);
  });

  it("timeAt inverts positionAt — a manual drag re-derives the clock exactly", () => {
    const frames = buildSectionKeyframes(
      [
        { top: 0, height: 800, durationMs: 16_000 },
        { top: 800, height: 400, durationMs: 24_000 },
      ],
      1200,
    )!;
    for (const y of [0, 123, 400, 800, 999, 1200]) {
      expect(positionAt(frames, timeAt(frames, y))).toBeCloseTo(y, 3);
    }
    // Beyond the ends clamps sanely.
    expect(timeAt(frames, -10)).toBe(0);
    expect(timeAt(frames, 5000)).toBe(totalDurationMs(frames));
  });
});

describe("flowScroll — the performer's speed, remembered per song", () => {
  beforeEach(() => localStorage.clear());

  it("clamps into the playable range", () => {
    expect(clampFlowSpeed(0.1)).toBe(0.5);
    expect(clampFlowSpeed(9)).toBe(2);
    expect(clampFlowSpeed(Number.NaN)).toBe(1);
  });

  it("remembers per song so the second run is exactly right", () => {
    saveFlowSpeed("song-a", 1.15);
    saveFlowSpeed("song-b", 0.8);
    expect(loadFlowSpeed("song-a")).toBe(1.15);
    expect(loadFlowSpeed("song-b")).toBe(0.8);
    expect(loadFlowSpeed("song-new")).toBe(1);
  });
});
