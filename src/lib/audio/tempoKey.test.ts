import { describe, it, expect } from "vitest";
import {
  detectTempoKey,
  detectTempo,
  detectKey,
  decimate,
  formatKeySignature,
  KEY_CONFIDENCE_FLOOR,
  TEMPO_CONFIDENCE_FLOOR,
} from "./tempoKey";

/**
 * Synthetic-audio verification — the F13 acceptance cases that can run in CI:
 * a clearly-played take yields a plausible BPM/key ABOVE the confidence floor,
 * and a rambly/atonal/short take falls BELOW it (the silent fallback). The
 * floors themselves are part of the contract: magic when confident, invisible
 * when not.
 */

const RATE = 44100;

/** A click track: short decaying sine bursts on every beat. */
function clickTrack(bpm: number, seconds: number, rate = RATE): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  const beatSec = 60 / bpm;
  const burstLen = Math.floor(0.02 * rate);
  for (let t = 0; t < seconds - 0.05; t += beatSec) {
    const start = Math.floor(t * rate);
    for (let i = 0; i < burstLen && start + i < out.length; i++) {
      out[start + i] += 0.8 * Math.exp(-i / (burstLen / 4)) * Math.sin((2 * Math.PI * 1000 * i) / rate);
    }
  }
  return out;
}

/** A tonal bed: summed sines (a chord/scale emphasis), lightly pulsed. */
function tonalBed(freqs: Array<[hz: number, amp: number]>, seconds: number, rate = RATE): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (const [hz, amp] of freqs) s += amp * Math.sin((2 * Math.PI * hz * i) / rate);
    // Gentle 2Hz amplitude ripple so frames aren't perfectly identical.
    out[i] = 0.15 * s * (0.8 + 0.2 * Math.sin((2 * Math.PI * 2 * i) / rate));
  }
  return out;
}

/**
 * Deterministic pseudo-noise via mulberry32 (no Math.random — reproducible).
 * NOT a power-of-two LCG: those have lattice structure whose block statistics
 * are secretly periodic — the first draft's "noise" autocorrelated at 0.8 and
 * legitimately detected as 126 BPM. Rambly must actually be rambly.
 */
function noise(seconds: number, rate = RATE): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  let a = 0x9e3779b9;
  for (let i = 0; i < out.length; i++) {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = (((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5) * 0.8;
  }
  return out;
}

describe("detectTempo — reads the pulse off the performance", () => {
  it("finds a 120 BPM click track within a couple of BPM, confidently", () => {
    const { data, rate } = decimate(clickTrack(120, 12), RATE);
    const t = detectTempo(data, rate);
    expect(t).not.toBeNull();
    expect(Math.abs(t!.bpm - 120)).toBeLessThanOrEqual(3);
    expect(t!.confidence).toBeGreaterThanOrEqual(TEMPO_CONFIDENCE_FLOOR);
  });

  it("finds a 92 BPM click track", () => {
    const { data, rate } = decimate(clickTrack(92, 12), RATE);
    const t = detectTempo(data, rate);
    expect(t).not.toBeNull();
    expect(Math.abs(t!.bpm - 92)).toBeLessThanOrEqual(3);
    expect(t!.confidence).toBeGreaterThanOrEqual(TEMPO_CONFIDENCE_FLOOR);
  });

  it("folds a 240 BPM pulse into the musical range (the one-tap-fixable octave)", () => {
    const { data, rate } = decimate(clickTrack(240, 12), RATE);
    const t = detectTempo(data, rate);
    expect(t).not.toBeNull();
    // 240 folds to 120 (or 60 at worst) — inside 60–180, one halve/double away.
    expect(t!.bpm).toBeGreaterThanOrEqual(60);
    expect(t!.bpm).toBeLessThanOrEqual(180);
    expect(t!.bpm % 60).toBeLessThanOrEqual(4);
  });

  it("stays SILENT on noise (rambly take): below the floor or null", () => {
    const { data, rate } = decimate(noise(12), RATE);
    const t = detectTempo(data, rate);
    if (t) expect(t.confidence).toBeLessThan(TEMPO_CONFIDENCE_FLOOR);
  });

  it("returns null for a truly held tone — no onsets, nothing periodic to read", () => {
    // A PURE sine, no amplitude ripple: constant energy → zero novelty. (A
    // rhythmically pulsing pad genuinely HAS a tempo — that's not this case.)
    const held = new Float32Array(RATE * 12);
    for (let i = 0; i < held.length; i++) held[i] = 0.2 * Math.sin((2 * Math.PI * 261.63 * i) / RATE);
    const { data, rate } = decimate(held, RATE);
    const t = detectTempo(data, rate);
    if (t) expect(t.confidence).toBeLessThan(TEMPO_CONFIDENCE_FLOOR);
  });

  it("skips very short clips (<4s) — not enough beats for autocorrelation", () => {
    const { data, rate } = decimate(clickTrack(120, 2.5), RATE);
    expect(detectTempo(data, rate)).toBeNull();
  });
});

describe("detectKey — reads the key off the performance", () => {
  it("hears a C major bed as C major, confidently", () => {
    // A realistic demo touches the scale, not just the bare triad (a lone
    // C–E–G is GENUINELY ambiguous between C, F, and A minor — real takes
    // carry melody notes that disambiguate).
    const bed = tonalBed(
      [
        [261.63, 1.0], // C4 (tonic weight)
        [293.66, 0.3], // D4
        [329.63, 0.7], // E4
        [349.23, 0.25], // F4
        [392.0, 0.8], // G4
        [440.0, 0.3], // A4
        [493.88, 0.35], // B4 (the leading tone that rules out F major)
        [523.25, 0.5], // C5
      ],
      8,
    );
    const { data, rate } = decimate(bed, RATE);
    const k = detectKey(data, rate);
    expect(k).not.toBeNull();
    expect(k!.tonic).toBe("C");
    expect(k!.mode).toBe("major");
    expect(k!.confidence).toBeGreaterThanOrEqual(KEY_CONFIDENCE_FLOOR);
  });

  it("hears an A minor bed as A minor (the relative-minor side of the known ambiguity)", () => {
    const bed = tonalBed(
      [
        [220.0, 1.0], // A3
        [261.63, 0.75], // C4
        [329.63, 0.8], // E4
        [440.0, 0.55], // A4
        [659.26, 0.3], // E5
      ],
      8,
    );
    const { data, rate } = decimate(bed, RATE);
    const k = detectKey(data, rate);
    expect(k).not.toBeNull();
    expect(k!.tonic).toBe("A");
    expect(k!.mode).toBe("minor");
  });

  it("hears a G major bed as G major (sharp-side spelling)", () => {
    const bed = tonalBed(
      [
        [196.0, 1.0], // G3
        [246.94, 0.7], // B3
        [293.66, 0.8], // D4
        [392.0, 0.55], // G4
        [587.33, 0.3], // D5
      ],
      8,
    );
    const { data, rate } = decimate(bed, RATE);
    const k = detectKey(data, rate);
    expect(k).not.toBeNull();
    expect(k!.tonic).toBe("G");
    expect(k!.mode).toBe("major");
    expect(k!.confidence).toBeGreaterThanOrEqual(KEY_CONFIDENCE_FLOOR);
  });

  it("stays SILENT on noise (atonal take): below the floor or null", () => {
    const { data, rate } = decimate(noise(8), RATE);
    const k = detectKey(data, rate);
    if (k) expect(k.confidence).toBeLessThan(KEY_CONFIDENCE_FLOOR);
  });

  it("returns null on true silence", () => {
    const { data, rate } = decimate(new Float32Array(RATE * 6), RATE);
    expect(detectKey(data, rate)).toBeNull();
  });
});

describe("detectTempoKey — the combined pass", () => {
  it("a clearly-played demo (click + chord bed) yields both values above the floors", () => {
    const bed = tonalBed(
      [
        [196.0, 0.9],
        [246.94, 0.6],
        [293.66, 0.7],
        [392.0, 0.5],
      ],
      12,
    );
    const clicks = clickTrack(96, 12);
    const mix = new Float32Array(bed.length);
    for (let i = 0; i < mix.length; i++) mix[i] = bed[i] * 0.8 + clicks[i];
    const result = detectTempoKey(mix, RATE);
    expect(result.tempo).not.toBeNull();
    expect(Math.abs(result.tempo!.bpm - 96)).toBeLessThanOrEqual(3);
    expect(result.tempo!.confidence).toBeGreaterThanOrEqual(TEMPO_CONFIDENCE_FLOOR);
    expect(result.key).not.toBeNull();
    expect(result.key!.tonic).toBe("G");
    expect(result.key!.confidence).toBeGreaterThanOrEqual(KEY_CONFIDENCE_FLOOR);
  });

  it("never throws on garbage input — best-effort by construction", () => {
    expect(() => detectTempoKey(new Float32Array(0), RATE)).not.toThrow();
    expect(() => detectTempoKey(new Float32Array(10), 1)).not.toThrow();
  });
});

describe("formatKeySignature — the app's stored key format", () => {
  it("majors are the bare tonic; minors carry the m suffix", () => {
    expect(formatKeySignature("G", "major")).toBe("G");
    expect(formatKeySignature("E", "minor")).toBe("Em");
    expect(formatKeySignature("F#", "minor")).toBe("F#m");
  });
});
