import { describe, expect, it } from "vitest";
import {
  cleanPitchTrack,
  contourFromPcm,
  extractPitchTrack,
  resampleContour,
  toMelodyKey,
  toParsons,
  toRelativeContour,
  UNVOICED,
  type PitchFrame,
} from "./pitchContour";

const SR = 44100;

/** Phase-continuous multi-note sine — a synthetic "sung" take. */
function sing(notes: Array<{ hz: number; ms: number }>, amp = 0.5): Float32Array {
  const total = notes.reduce((sum, n) => sum + Math.round((n.ms / 1000) * SR), 0);
  const out = new Float32Array(total);
  let i = 0;
  let phase = 0;
  for (const note of notes) {
    const len = Math.round((note.ms / 1000) * SR);
    const step = (2 * Math.PI * note.hz) / SR;
    for (let s = 0; s < len; s++) {
      out[i++] = amp * Math.sin(phase);
      phase += step;
    }
  }
  return out;
}

describe("extractPitchTrack (YIN)", () => {
  it("tracks a pure tone within a few cents", () => {
    const track = extractPitchTrack(sing([{ hz: 220, ms: 600 }]), SR);
    const voiced = track.filter((f) => f.f0Hz > 0);
    expect(voiced.length).toBeGreaterThan(10);
    const mean = voiced.reduce((a, f) => a + f.f0Hz, 0) / voiced.length;
    expect(Math.abs(mean - 220)).toBeLessThan(3);
  });

  it("reports silence as unvoiced, never a pitch", () => {
    const track = extractPitchTrack(new Float32Array(SR), SR);
    expect(track.every((f) => f.f0Hz === 0 && f.confidence === 0)).toBe(true);
  });

  it("does not hallucinate a stable pitch from noise", () => {
    const noise = new Float32Array(SR / 2);
    let seed = 42;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (seed / 0x7fffffff - 0.5) * 0.6;
    }
    const track = extractPitchTrack(noise, SR);
    const confident = track.filter((f) => f.confidence >= 0.45);
    expect(confident.length).toBeLessThan(track.length * 0.2);
  });
});

describe("cleanPitchTrack", () => {
  const frame = (hz: number): PitchFrame => ({ f0Hz: hz, confidence: 0.9 });

  it("repairs an octave-jump artifact back to the neighbourhood", () => {
    const frames = [
      ...Array.from({ length: 10 }, () => frame(220)),
      frame(440), frame(440), frame(440), // classic doubling run
      ...Array.from({ length: 10 }, () => frame(220)),
    ];
    const clean = cleanPitchTrack(frames);
    const voiced = clean.filter((v) => !Number.isNaN(v));
    // hzToMidi(220) = 57; every frame should sit near it after repair.
    expect(Math.max(...voiced) - Math.min(...voiced)).toBeLessThan(2);
  });

  it("bridges short unvoiced gaps but leaves long silences silent", () => {
    const frames = [
      ...Array.from({ length: 8 }, () => frame(220)),
      ...Array.from({ length: 3 }, (): PitchFrame => ({ f0Hz: 0, confidence: 0 })),
      ...Array.from({ length: 8 }, () => frame(220)),
      ...Array.from({ length: 30 }, (): PitchFrame => ({ f0Hz: 0, confidence: 0 })),
      ...Array.from({ length: 8 }, () => frame(220)),
    ];
    const clean = cleanPitchTrack(frames);
    expect(clean.slice(8, 11).every((v) => !Number.isNaN(v))).toBe(true); // bridged
    expect(clean.slice(22, 45).some((v) => Number.isNaN(v))).toBe(true); // long silence kept
  });
});

describe("melody extraction", () => {
  // A3 → C4 → E4: a rising minor arpeggio, intervals [0, +3, +7].
  const RISE = [
    { hz: 220, ms: 400 },
    { hz: 261.63, ms: 400 },
    { hz: 329.63, ms: 400 },
  ];

  it("hears the notes as semitone intervals from the first note", () => {
    const result = contourFromPcm(sing(RISE), SR);
    expect(result).not.toBeNull();
    expect(result!.melodyKey).toEqual([0, 3, 7]);
  });

  it("is key-invariant: the same tune 5 semitones up keeps its intervals", () => {
    const transposed = RISE.map((n) => ({ ...n, hz: n.hz * Math.pow(2, 5 / 12) }));
    const result = contourFromPcm(sing(transposed), SR);
    expect(result!.melodyKey).toEqual([0, 3, 7]);
  });

  it("the contour rises with a rising tune", () => {
    const result = contourFromPcm(sing(RISE), SR);
    const voiced = result!.pitchContour.filter((p) => p !== UNVOICED);
    const first = voiced.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
    const last = voiced.slice(-8).reduce((a, b) => a + b, 0) / 8;
    expect(last).toBeGreaterThan(first + 0.5);
  });

  it("a monotone (spoken-style) take gets a contour but NO melody_key", () => {
    const result = contourFromPcm(sing([{ hz: 220, ms: 1200 }]), SR);
    expect(result).not.toBeNull();
    expect(result!.melodyKey).toEqual([]); // flat delivery is not a melody
  });

  it("silence yields null — the amplitude fallback owns the card", () => {
    expect(contourFromPcm(new Float32Array(SR), SR)).toBeNull();
  });
});

describe("helpers", () => {
  it("toParsons spells the up/down/repeat steps", () => {
    expect(toParsons([0, 3, 7, 7, 5])).toBe("UURD");
    expect(toParsons([0])).toBe("");
  });

  it("resampleContour keeps unvoiced buckets unvoiced", () => {
    const contour = [0.1, 0.2, UNVOICED, UNVOICED, 0.8, 0.9];
    const bars = resampleContour(contour, 3);
    expect(bars).toHaveLength(3);
    expect(bars[1]).toBe(UNVOICED);
    expect(bars[0]).toBeLessThan(bars[2]);
  });

  it("toRelativeContour normalizes to the take's own range", () => {
    const clean = [57, 57, 60, 60, 64, 64]; // midi
    const contour = toRelativeContour(clean, 6);
    expect(Math.min(...contour)).toBe(0);
    expect(Math.max(...contour)).toBe(1);
  });

  it("toMelodyKey ignores sub-semitone wobble inside a held note", () => {
    const held = Array.from({ length: 30 }, (_, i) => 57 + Math.sin(i) * 0.3);
    expect(toMelodyKey(held)).toEqual([]); // one wobbly note ≠ a melody
  });
});
