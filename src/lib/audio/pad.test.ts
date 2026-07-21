import { describe, it, expect } from "vitest";
import {
  clampPadVolume,
  midiToFrequency,
  padVoicing,
  parsePadKey,
  PAD_DEFAULT_VOLUME,
  PAD_MAX_VOLUME,
  PAD_MIN_VOLUME,
} from "./pad";
import { pitchClass } from "@/lib/chords/keys";

describe("pad — pure music math (all 12 keys procedural)", () => {
  it("A4 is 440 and octaves double", () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 6);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
  });

  it("parses the app's key format ('G' / 'Em' / 'F#m'), rejecting garbage", () => {
    expect(parsePadKey("G")).toEqual({ tonic: "G", mode: "major" });
    expect(parsePadKey("Em")).toEqual({ tonic: "E", mode: "minor" });
    expect(parsePadKey("F#m")).toEqual({ tonic: "F#", mode: "minor" });
    expect(parsePadKey("Bb")).toEqual({ tonic: "Bb", mode: "major" });
    expect(parsePadKey(null)).toBeNull();
    expect(parsePadKey("")).toBeNull();
    expect(parsePadKey("H")).toBeNull();
  });

  it("voices every one of the 12 keys — root + fifth stack, correct intervals", () => {
    const tonics = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    for (const tonic of tonics) {
      const voices = padVoicing(tonic, "neutral");
      expect(voices.length).toBeGreaterThanOrEqual(5);
      const root = voices[0];
      const fifth = voices[1];
      const octave = voices[2];
      // A perfect fifth is 7 semitones: ratio 2^(7/12).
      expect(fifth.freq / root.freq).toBeCloseTo(Math.pow(2, 7 / 12), 5);
      expect(octave.freq / root.freq).toBeCloseTo(2, 5);
      // The root fundamental sits in the warm low register (oct 2: ~65–124 Hz).
      expect(root.freq).toBeGreaterThan(60);
      expect(root.freq).toBeLessThan(130);
      // And actually matches the requested tonic's pitch class.
      const midi = Math.round(69 + 12 * Math.log2(root.freq / 440));
      expect(((midi % 12) + 12) % 12).toBe(pitchClass(tonic));
    }
  });

  it("stays NEUTRAL by default — the third is silent, fitting major AND minor", () => {
    const neutral = padVoicing("G", "neutral");
    const third = neutral.find((v) => v.isThird)!;
    expect(third.gain).toBe(0);
  });

  it("flavors the third only when asked: +4 semitones major, +3 minor", () => {
    const major = padVoicing("C", "major");
    const minor = padVoicing("C", "minor");
    const root = major[0].freq;
    const majorThird = major.find((v) => v.isThird)!;
    const minorThird = minor.find((v) => v.isThird)!;
    expect(majorThird.gain).toBeGreaterThan(0);
    // Thirds sit an octave up (oct 3): 12+4 and 12+3 semitones over the root.
    expect(majorThird.freq / root).toBeCloseTo(Math.pow(2, 16 / 12), 5);
    expect(minorThird.freq / root).toBeCloseTo(Math.pow(2, 15 / 12), 5);
  });

  it("spreads the field: mixed pans, lower voices carry more weight", () => {
    const voices = padVoicing("D", "neutral");
    expect(voices.some((v) => v.pan < 0)).toBe(true);
    expect(voices.some((v) => v.pan > 0)).toBe(true);
    expect(voices[0].gain).toBeGreaterThan(voices[4].gain);
    // Breathing rates differ so the voices drift out of phase.
    expect(new Set(voices.map((v) => v.breathRateHz)).size).toBeGreaterThan(3);
  });

  it("clamps the volume into the subtle bed range", () => {
    expect(clampPadVolume(0)).toBe(PAD_MIN_VOLUME);
    expect(clampPadVolume(1)).toBe(PAD_MAX_VOLUME);
    expect(clampPadVolume(Number.NaN)).toBe(PAD_DEFAULT_VOLUME);
    expect(clampPadVolume(0.2)).toBe(0.2);
  });

  it("HEADROOM: the summed bed can never clip — normalized against the full flavored sum", () => {
    for (const flavor of ["neutral", "major", "minor"] as const) {
      const sum = padVoicing("C", flavor).reduce((s, v) => s + v.gain, 0);
      expect(sum).toBeLessThanOrEqual(1.01);
    }
    // The normalization anchor is the FULL sum (third at max), so switching
    // flavor never changes the non-third voices' level — no loudness jump.
    const neutralRoot = padVoicing("G", "neutral")[0].gain;
    const majorRoot = padVoicing("G", "major")[0].gain;
    expect(neutralRoot).toBeCloseTo(majorRoot, 10);
  });
});
