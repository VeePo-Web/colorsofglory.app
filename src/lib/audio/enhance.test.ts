import { describe, it, expect, beforeEach } from "vitest";
import {
  computeLoudnessGain,
  encodeWavBytes,
  isPolishEnabled,
  setPolishEnabled,
  POLISH_CHAIN,
  POLISH_MAX_GAIN,
  POLISH_MIN_GAIN,
  POLISH_TARGET_RMS,
} from "./enhance";

const RATE = 44_100;

/** A steady sine "take" at a given amplitude. */
function sine(amplitude: number, seconds = 2): Float32Array {
  const out = new Float32Array(Math.floor(RATE * seconds));
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE);
  }
  return out;
}

describe("polish — loudness math (the 'sounds pro' core)", () => {
  it("brings a quiet phone take UP toward the target", () => {
    // amplitude 0.1 sine → RMS ≈ 0.0707, well under the 0.158 target.
    const gain = computeLoudnessGain(sine(0.1), RATE);
    expect(gain).toBeGreaterThan(1.8);
    expect(gain).toBeLessThanOrEqual(POLISH_MAX_GAIN);
    // And lands the RMS near the target.
    expect(0.0707 * gain).toBeCloseTo(POLISH_TARGET_RMS, 1);
  });

  it("leaves an already-loud take nearly alone (never slams, floor-clamped)", () => {
    const gain = computeLoudnessGain(sine(0.9), RATE);
    expect(gain).toBeGreaterThanOrEqual(POLISH_MIN_GAIN);
    expect(gain).toBeLessThanOrEqual(1);
  });

  it("silence is untouched — gain exactly 1", () => {
    expect(computeLoudnessGain(new Float32Array(RATE), RATE)).toBe(1);
    expect(computeLoudnessGain(sine(0.005), RATE)).toBe(1);
  });

  it("gates silence blocks: a mostly-quiet take with one real phrase levels by the PHRASE", () => {
    // 8s near-silence + 2s of real singing at 0.1 — the old peak normalizer
    // would see peak 0.1; naive full-RMS would over-boost. Gated RMS levels
    // by the sung part only.
    const quiet = new Float32Array(RATE * 8); // digital silence blocks (gated)
    const phrase = sine(0.1, 2);
    const take = new Float32Array(quiet.length + phrase.length);
    take.set(quiet);
    take.set(phrase, quiet.length);
    const gain = computeLoudnessGain(take, RATE);
    expect(0.0707 * gain).toBeCloseTo(POLISH_TARGET_RMS, 1);
  });

  it("peak allowance caps the boost so peaks never slam the limiter", () => {
    // Very peaky but quiet-RMS content: short spikes at 0.9 over near-silence.
    const take = new Float32Array(RATE * 2);
    for (let i = 0; i < take.length; i += 1000) take[i] = 0.9;
    for (let i = 0; i < take.length; i++) if (take[i] === 0) take[i] = 0.002;
    const gain = computeLoudnessGain(take, RATE);
    expect(gain * 0.9).toBeLessThanOrEqual(1.41); // POLISH_PEAK_ALLOWANCE
  });
});

describe("polish — the music-safe chain contract", () => {
  it("the chain is mastering DSP, not speech surgery — conservative values", () => {
    // These are the audit anchors: if someone cranks them, this fails.
    expect(POLISH_CHAIN.highPassHz).toBeLessThanOrEqual(80); // keeps guitar body
    expect(Math.abs(POLISH_CHAIN.mudDb)).toBeLessThanOrEqual(3);
    expect(POLISH_CHAIN.presenceDb).toBeLessThanOrEqual(2);
    expect(POLISH_CHAIN.airDb).toBeLessThanOrEqual(3);
    expect(POLISH_CHAIN.compRatio).toBeLessThanOrEqual(3); // even, not squashed
    expect(POLISH_CHAIN.masterGain).toBeLessThanOrEqual(0.9); // ≈ −1 dBFS ceiling
  });
});

describe("polish — WAV export encoder", () => {
  it("produces a valid RIFF/WAVE header with correct sizes", () => {
    const frames = 1000;
    const fake = {
      numberOfChannels: 1,
      length: frames,
      sampleRate: RATE,
      getChannelData: () => sine(0.5, frames / RATE).subarray(0, frames),
    } as unknown as AudioBuffer;
    const bytes = encodeWavBytes(fake);
    const buf = new DataView(bytes);
    const str = (off: number, len: number) =>
      Array.from({ length: len }, (_, i) => String.fromCharCode(buf.getUint8(off + i))).join("");
    expect(str(0, 4)).toBe("RIFF");
    expect(str(8, 4)).toBe("WAVE");
    expect(buf.getUint16(22, true)).toBe(1); // mono
    expect(buf.getUint32(24, true)).toBe(RATE);
    expect(buf.getUint32(40, true)).toBe(frames * 2); // 16-bit data size
    expect(bytes.byteLength).toBe(44 + frames * 2);
  });

  it("clamps out-of-range samples instead of wrapping", () => {
    const fake = {
      numberOfChannels: 1,
      length: 4,
      sampleRate: RATE,
      getChannelData: () => new Float32Array([2, -2, 0.5, -0.5]),
    } as unknown as AudioBuffer;
    const view = new DataView(encodeWavBytes(fake));
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });
});

describe("polish — the global preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults ON, persists OFF, and round-trips", () => {
    setPolishEnabled(true); // reset module state deterministically
    localStorage.removeItem("cog-polish-enabled");
    expect(isPolishEnabled()).toBe(true);
    setPolishEnabled(false);
    expect(isPolishEnabled()).toBe(false);
    expect(localStorage.getItem("cog-polish-enabled")).toBe("off");
    setPolishEnabled(true);
    expect(isPolishEnabled()).toBe(true);
  });
});
