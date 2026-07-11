import { describe, expect, it } from "vitest";
import {
  hasStrongMatch,
  searchMelodies,
  STRONG_MATCH,
  type MelodyIndexEntry,
} from "./melodySearch";

// A short worship-ish phrase and some decoys, as semitone-interval melody_keys.
const AMAZING = [0, 4, 9, 7, 4, 0]; // rise then settle
const DECOY_A = [0, -2, -4, -5, -7]; // steady descent
const DECOY_B = [0, 1, 0, 1, 0, 1]; // trill
const DECOY_C = [0, 7, 0, 7, 0]; // octave leaps

const index: MelodyIndexEntry[] = [
  { memoId: "amazing", melodyKey: AMAZING },
  { memoId: "decoyA", melodyKey: DECOY_A },
  { memoId: "decoyB", melodyKey: DECOY_B },
  { memoId: "decoyC", melodyKey: DECOY_C },
];

describe("searchMelodies", () => {
  it("ranks the true tune first when hummed cleanly", () => {
    const results = searchMelodies(AMAZING, index);
    expect(results[0].memoId).toBe("amazing");
    expect(hasStrongMatch(results)).toBe(true);
  });

  it("is KEY-invariant: the same tune transposed +5 still ranks first", () => {
    const transposed = AMAZING.map((n) => n + 5);
    const results = searchMelodies(transposed, index);
    expect(results[0].memoId).toBe("amazing");
  });

  it("is TEMPO-invariant: a note-doubled hum of the tune still ranks first", () => {
    // Same contour, each note held twice (a slower hum) — deltas gain zeros.
    const slow = [0, 0, 4, 4, 9, 9, 7, 7, 4, 4, 0, 0];
    const results = searchMelodies(slow, index);
    expect(results[0].memoId).toBe("amazing");
  });

  it("SUBSEQUENCE: a hum of the tail matches a memo that opens differently", () => {
    const longMemo = [0, -3, -5, -3, 0, 4, 9, 7, 4, 0]; // AMAZING tail embedded
    const withLong: MelodyIndexEntry[] = [
      { memoId: "long", melodyKey: longMemo },
      ...index.filter((e) => e.memoId !== "amazing"),
    ];
    const results = searchMelodies([0, 4, 9, 7, 4, 0], withLong);
    expect(results[0].memoId).toBe("long");
  });

  it("tolerates an out-of-tune hum (one note off) and still ranks it top-1", () => {
    const wobbly = [0, 5, 9, 7, 3, 0]; // two notes a semitone off
    const results = searchMelodies(wobbly, index);
    expect(results[0].memoId).toBe("amazing");
  });

  it("returns nothing for a too-short query", () => {
    expect(searchMelodies([0, 2], index)).toEqual([]);
  });

  it("honestly reports no strong match for a tune unlike anything indexed", () => {
    const alien = [0, 11, -6, 8, -9, 3];
    const results = searchMelodies(alien, index);
    // It still returns a ranked list, but the top isn't confident.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThan(STRONG_MATCH);
    expect(hasStrongMatch(results)).toBe(false);
  });

  it("caps the shortlist to the requested limit", () => {
    expect(searchMelodies(AMAZING, index, { limit: 2 })).toHaveLength(2);
  });

  it("stays correct (and fast) at large-library / prefilter scale", () => {
    const big: MelodyIndexEntry[] = Array.from({ length: 500 }, (_, i) => ({
      memoId: `noise-${i}`,
      // Deterministic pseudo-random keys — no Math.random in this env.
      melodyKey: Array.from({ length: 6 }, (_, j) => ((i * 7 + j * 13) % 11) - 5),
    }));
    big.push({ memoId: "needle", melodyKey: AMAZING });
    const t0 = performance.now();
    const results = searchMelodies(AMAZING, big, { limit: 5 });
    const ms = performance.now() - t0;
    expect(results[0].memoId).toBe("needle");
    expect(ms).toBeLessThan(200);
  });
});
