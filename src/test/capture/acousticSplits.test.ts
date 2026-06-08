import { describe, expect, it } from "vitest";
import { findSilenceBoundaries } from "@/lib/capture/acousticSplits";

/**
 * Minimal AudioBuffer-like shape used by findSilenceBoundaries.
 * We only need sampleRate, length, numberOfChannels, getChannelData.
 */
function stubBuffer(channels: Float32Array[], sampleRate = 16_000) {
  return {
    sampleRate,
    length: channels[0].length,
    numberOfChannels: channels.length,
    getChannelData: (ch: number) => channels[ch],
  };
}

/** Build a mono signal: [loud, silent, loud, silent, loud] sections, each in ms. */
function buildSignal(sections: Array<{ ms: number; rms: number }>, sr = 16_000): Float32Array {
  const total = sections.reduce((acc, s) => acc + Math.round((s.ms / 1000) * sr), 0);
  const out = new Float32Array(total);
  let cursor = 0;
  for (const s of sections) {
    const len = Math.round((s.ms / 1000) * sr);
    for (let i = 0; i < len; i += 1) {
      // Square-ish wave at the requested RMS magnitude.
      out[cursor + i] = i % 2 === 0 ? s.rms : -s.rms;
    }
    cursor += len;
  }
  return out;
}

describe("findSilenceBoundaries", () => {
  it("returns no boundaries when audio is continuously loud", () => {
    const sig = buildSignal([{ ms: 5000, rms: 0.4 }]);
    expect(findSilenceBoundaries(stubBuffer([sig]))).toEqual([]);
  });

  it("returns a boundary at the centre of a ≥1.6s silent gap", () => {
    const sig = buildSignal([
      { ms: 2000, rms: 0.4 },
      { ms: 2000, rms: 0.001 }, // 2s silence
      { ms: 2000, rms: 0.4 },
    ]);
    const splits = findSilenceBoundaries(stubBuffer([sig]));
    expect(splits.length).toBe(1);
    // Middle of the gap is around 3000ms.
    expect(splits[0]).toBeGreaterThan(2700);
    expect(splits[0]).toBeLessThan(3300);
  });

  it("ignores short pauses (< minGapMs)", () => {
    const sig = buildSignal([
      { ms: 2000, rms: 0.4 },
      { ms: 600, rms: 0.001 }, // tiny breath
      { ms: 2000, rms: 0.4 },
    ]);
    expect(findSilenceBoundaries(stubBuffer([sig]))).toEqual([]);
  });

  it("ignores silence at the edges (intro/outro)", () => {
    const sig = buildSignal([
      { ms: 2000, rms: 0.001 }, // leading silence
      { ms: 3000, rms: 0.4 },
      { ms: 2000, rms: 0.001 }, // trailing silence
    ]);
    expect(findSilenceBoundaries(stubBuffer([sig]))).toEqual([]);
  });

  it("emits multiple boundaries between several sections", () => {
    const sig = buildSignal([
      { ms: 2000, rms: 0.4 },
      { ms: 2000, rms: 0.001 },
      { ms: 2000, rms: 0.4 },
      { ms: 2000, rms: 0.001 },
      { ms: 2000, rms: 0.4 },
    ]);
    expect(findSilenceBoundaries(stubBuffer([sig])).length).toBe(2);
  });
});