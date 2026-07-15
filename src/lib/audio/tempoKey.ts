/**
 * tempoKey — F13 (safe half): detect the TEMPO and KEY the songwriter actually
 * played in their raw demo, so the two fields they set by hand today
 * (ChordPicker's key + BPM) arrive pre-filled — a suggestion they confirm or
 * change in one tap, never an auto-commit, never a block.
 *
 * Deliberately scoped to two SINGLE values (tempo + key), not chords: a wrong
 * single value is visible and one-tap-correctable (halve/double the BPM,
 * toggle the mode); a wrong chord STREAM rewrites the artist's harmony. Chords
 * are out of scope by design.
 *
 * Lightweight, on-device, offline DSP — the Melody Lens discipline, no ML:
 *
 *   TEMPO: frame log-energy → half-wave-rectified novelty (onsets) →
 *          autocorrelation over the musical lag range → dominant periodicity →
 *          BPM, octave-folded into ~60–180 with a mild mid-tempo preference
 *          (the 60/120/240 ambiguity is the known failure; it's a one-tap fix
 *          via the BPM field / TapTempo).
 *
 *   KEY:   Hann-windowed FFT frames → 12-bin chroma (pitch-class profile,
 *          magnitude-compressed, off-pitch bins skipped) → Krumhansl–Kessler
 *          correlation against the 24 major/minor templates → best
 *          { tonic, mode }. Relative-major/minor is the known ambiguity —
 *          one mode toggle switches it.
 *
 * Both emit a confidence 0–1 and are CONFIDENCE-GATED upstream: below the
 * floor the feature stays silent (today's manual prompt, unchanged). Pure
 * functions over Float32Array so every stage is unit-testable without
 * WebAudio; `detectTempoKeyFromBlob` at the bottom is the browser wrapper
 * (decode via OfflineAudioContext — the volumeNormalizer/pitchContour
 * pattern). BEST-EFFORT ONLY: it returns null on any failure — the save
 * never depends on it.
 *
 * Tunables + the confidence model are documented in
 * docs/F13-TEMPO-KEY-CONTRACT.md.
 */

import { MAJOR_KEYS, MINOR_KEYS, pitchClass, type Mode } from "@/lib/chords/keys";

// ─── Tunables ────────────────────────────────────────────────────────────────

/** Analysis sample rate — everything is decimated near this before analysis. */
const TARGET_RATE = 11025;

/** Tempo novelty framing (at the decimated rate): ~46ms window, ~12ms hop. */
const TEMPO_WIN = 512;
const TEMPO_HOP = 128;

/** The musical BPM range suggestions are folded into. */
export const MIN_BPM = 60;
export const MAX_BPM = 180;

/** Mid-tempo band that earns a small folding bonus (most demos live here). */
const FOLD_PREF_LOW = 84;
const FOLD_PREF_HIGH = 152;
const FOLD_PREF_BONUS = 0.06;

/** A take shorter than this can't support a reliable autocorrelation. */
export const MIN_TEMPO_SECONDS = 4;

/**
 * Minimum log-energy jump for the take to contain REAL onsets. Normalized
 * autocorrelation is scale-invariant, so without this gate periodic DUST
 * (phase-beating on a held pad, window jitter) reads as a confident tempo.
 * A genuine note/strum onset moves log-energy by ≥ ~0.7 (energy doubling);
 * rubato swells and speech hover far below — exactly the takes that should
 * stay silent.
 */
const NOVELTY_MIN_PEAK = 0.25;

/** Key chroma framing (at the decimated rate): ~186ms window, 50% hop. */
const KEY_FFT_SIZE = 2048;
const KEY_HOP = 1024;

/** Pitch fold range: below 55Hz is rumble, above ~2.2kHz is mostly overtones. */
const KEY_MIN_HZ = 55;
const KEY_MAX_HZ = 2200;

/** Bins farther than this many cents from a semitone are smear — skipped. */
const KEY_MAX_CENTS_OFF = 40;

/** Cap the analyzed span — a demo's tempo+key live in its opening minute. */
const MAX_ANALYZE_SECONDS = 60;

/**
 * Confidence floors — the magic-or-silent line. Chosen so the synthetic
 * clear cases (click tracks, triad beds) clear them with margin and the
 * rambly cases (noise, monotone speech-like takes) fall well below.
 */
export const TEMPO_CONFIDENCE_FLOOR = 0.3;
export const KEY_CONFIDENCE_FLOOR = 0.42;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TempoDetection {
  bpm: number;
  /** 0–1; below TEMPO_CONFIDENCE_FLOOR the caller must stay silent. */
  confidence: number;
}

export interface KeyDetection {
  /** Tonic spelling without a mode suffix, e.g. "G", "F#", "Bb". */
  tonic: string;
  mode: Mode;
  /** 0–1; below KEY_CONFIDENCE_FLOOR the caller must stay silent. */
  confidence: number;
}

export interface TempoKeyResult {
  tempo: TempoDetection | null;
  key: KeyDetection | null;
}

/** The app's stored key format: "G" for majors, "Em" for minors. */
export function formatKeySignature(tonic: string, mode: Mode): string {
  return mode === "minor" ? `${tonic}m` : tonic;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/** Boxcar decimation to ~TARGET_RATE — a crude low-pass that is plenty here. */
export function decimate(samples: Float32Array, sampleRate: number): { data: Float32Array; rate: number } {
  const factor = Math.max(1, Math.round(sampleRate / TARGET_RATE));
  if (factor === 1) return { data: samples, rate: sampleRate };
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    const base = i * factor;
    for (let j = 0; j < factor; j++) sum += samples[base + j];
    out[i] = sum / factor;
  }
  return { data: out, rate: sampleRate / factor };
}

/**
 * In-place iterative radix-2 FFT (complex). Small, dependency-free, and only
 * ever run on KEY_FFT_SIZE frames — not a general-purpose library.
 */
export function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const aRe = re[i + j];
        const aIm = im[i + j];
        const bRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const bIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j] = aRe + bRe;
        im[i + j] = aIm + bIm;
        re[i + j + len / 2] = aRe - bRe;
        im[i + j + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// ─── Tempo ───────────────────────────────────────────────────────────────────

/** Half-wave-rectified log-energy novelty — peaks on note/strum/beat onsets. */
export function noveltyEnvelope(data: Float32Array, win = TEMPO_WIN, hop = TEMPO_HOP): Float32Array {
  const frames = Math.max(0, Math.floor((data.length - win) / hop) + 1);
  if (frames < 2) return new Float32Array(0);
  const logE = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * hop;
    for (let i = 0; i < win; i++) sum += data[base + i] * data[base + i];
    logE[f] = Math.log(1e-8 + sum / win);
  }
  const novelty = new Float32Array(frames);
  for (let f = 1; f < frames; f++) novelty[f] = Math.max(0, logE[f] - logE[f - 1]);
  // Subtract a slow moving average so sustained crescendos don't read as beats.
  const avgWin = Math.max(3, Math.round(frames * 0.02));
  let acc = 0;
  const smoothed = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    acc += novelty[f];
    if (f >= avgWin) acc -= novelty[f - avgWin];
    const mean = acc / Math.min(f + 1, avgWin);
    smoothed[f] = Math.max(0, novelty[f] - mean);
  }
  return smoothed;
}

/** Normalized (mean-removed) autocorrelation of the novelty at one lag. */
function autocorrAt(novelty: Float32Array, mean: number, energy: number, lag: number): number {
  if (lag >= novelty.length || energy <= 0) return 0;
  let sum = 0;
  for (let i = lag; i < novelty.length; i++) {
    sum += (novelty[i] - mean) * (novelty[i - lag] - mean);
  }
  return Math.max(0, sum / energy);
}

export function detectTempo(data: Float32Array, rate: number): TempoDetection | null {
  const seconds = data.length / rate;
  if (seconds < MIN_TEMPO_SECONDS) return null; // too short for autocorrelation

  const novelty = noveltyEnvelope(data);
  if (novelty.length < 8) return null;
  const fps = rate / TEMPO_HOP;

  let mean = 0;
  let peak = 0;
  for (let i = 0; i < novelty.length; i++) {
    mean += novelty[i];
    if (novelty[i] > peak) peak = novelty[i];
  }
  mean /= novelty.length;
  let energy = 0;
  for (let i = 0; i < novelty.length; i++) {
    const d = novelty[i] - mean;
    energy += d * d;
  }
  // No REAL onsets (silence, a held tone, a slow swell, steady noise):
  // nothing musically periodic to read — normalized autocorrelation would
  // happily report the periodicity of numerical dust otherwise.
  if (energy < 1e-9 || mean < 1e-6 || peak < NOVELTY_MIN_PEAK) return null;

  const minLag = Math.max(2, Math.floor((fps * 60) / (MAX_BPM + 8)));
  const maxLag = Math.min(novelty.length - 2, Math.ceil((fps * 60) / (MIN_BPM - 8)));
  if (maxLag <= minLag) return null;

  let bestLag = -1;
  let bestR = 0;
  const rByLag = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    const r = autocorrAt(novelty, mean, energy, lag);
    rByLag[lag] = r;
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestR <= 0) return null;

  // Octave-fold: the classic 60/120/240 ambiguity. Score the half/double
  // candidates that land inside the musical range; prefer the mid band a bit.
  const candidates: Array<{ lag: number; score: number }> = [];
  for (const lag of [bestLag, bestLag * 2, Math.round(bestLag / 2)]) {
    if (lag < minLag || lag > maxLag) continue;
    const r = rByLag[lag] || autocorrAt(novelty, mean, energy, lag);
    const bpm = (fps * 60) / lag;
    const bonus = bpm >= FOLD_PREF_LOW && bpm <= FOLD_PREF_HIGH ? FOLD_PREF_BONUS : 0;
    candidates.push({ lag, score: r + bonus });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen = candidates[0].lag;

  // Parabolic interpolation around the chosen lag for sub-frame BPM precision.
  const r0 = rByLag[chosen - 1] ?? autocorrAt(novelty, mean, energy, chosen - 1);
  const r1 = rByLag[chosen] ?? autocorrAt(novelty, mean, energy, chosen);
  const r2 = rByLag[chosen + 1] ?? autocorrAt(novelty, mean, energy, chosen + 1);
  const denom = r0 - 2 * r1 + r2;
  const shift = denom !== 0 ? Math.min(0.5, Math.max(-0.5, (0.5 * (r0 - r2)) / denom)) : 0;
  const refinedLag = chosen + shift;

  let bpm = (fps * 60) / refinedLag;
  while (bpm > MAX_BPM) bpm /= 2;
  while (bpm < MIN_BPM) bpm *= 2;

  // Confidence: normalized autocorrelation strength at the chosen period,
  // tempered by how much material supported it. Flat/rambly novelty → low r.
  const spanFactor = Math.min(1, seconds / 8);
  const confidence = Math.min(1, Math.max(0, r1 * 1.6)) * spanFactor;

  return { bpm: Math.round(bpm), confidence };
}

// ─── Key ─────────────────────────────────────────────────────────────────────

/** Krumhansl–Kessler tonal-hierarchy profiles. */
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** 12-bin pitch-class profile of the take (magnitude-compressed chroma). */
export function chromaProfile(data: Float32Array, rate: number): Float32Array {
  const chroma = new Float32Array(12);
  if (data.length < KEY_FFT_SIZE) return chroma;
  const re = new Float32Array(KEY_FFT_SIZE);
  const im = new Float32Array(KEY_FFT_SIZE);
  const hann = new Float32Array(KEY_FFT_SIZE);
  for (let i = 0; i < KEY_FFT_SIZE; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (KEY_FFT_SIZE - 1)));
  }
  const binHz = rate / KEY_FFT_SIZE;
  const minBin = Math.max(1, Math.ceil(KEY_MIN_HZ / binHz));
  const maxBin = Math.min(KEY_FFT_SIZE / 2 - 1, Math.floor(KEY_MAX_HZ / binHz));

  // Precompute each bin's pitch class (or -1 when it sits between semitones).
  const binPc = new Int8Array(maxBin + 1).fill(-1);
  for (let k = minBin; k <= maxBin; k++) {
    const midi = 69 + 12 * Math.log2((k * binHz) / 440);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) * 100 <= KEY_MAX_CENTS_OFF) {
      binPc[k] = ((nearest % 12) + 12) % 12;
    }
  }

  for (let start = 0; start + KEY_FFT_SIZE <= data.length; start += KEY_HOP) {
    let frameEnergy = 0;
    for (let i = 0; i < KEY_FFT_SIZE; i++) {
      const s = data[start + i] * hann[i];
      re[i] = s;
      im[i] = 0;
      frameEnergy += s * s;
    }
    if (frameEnergy < 1e-6) continue; // silence — nothing tonal to read
    fftRadix2(re, im);
    for (let k = minBin; k <= maxBin; k++) {
      const pc = binPc[k];
      if (pc < 0) continue;
      const mag = Math.hypot(re[k], im[k]);
      chroma[pc] += Math.sqrt(mag); // compress so loud bins don't dominate
    }
  }
  return chroma;
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

/** Tonic pitch-class → the app's preferred spelling, per mode. */
function spellTonic(pc: number, mode: Mode): string {
  const pool = mode === "major" ? MAJOR_KEYS : MINOR_KEYS;
  for (const k of pool) {
    const bare = k.replace(/m$/, "");
    if (pitchClass(bare) === pc) return bare;
  }
  // Every pitch class is covered above; this is an unreachable fallback.
  return "C";
}

export function detectKey(data: Float32Array, rate: number): KeyDetection | null {
  const chroma = chromaProfile(data, rate);
  let total = 0;
  for (let i = 0; i < 12; i++) total += chroma[i];
  if (total <= 0) return null; // no tonal content at all

  // Score all 24 keys.
  const scores: Array<{ pc: number; mode: Mode; r: number }> = [];
  const rotated = new Float32Array(12);
  for (const mode of ["major", "minor"] as const) {
    const profile = mode === "major" ? KK_MAJOR : KK_MINOR;
    for (let tonicPc = 0; tonicPc < 12; tonicPc++) {
      for (let i = 0; i < 12; i++) rotated[i] = chroma[(i + tonicPc) % 12];
      scores.push({ pc: tonicPc, mode, r: pearson(rotated, profile) });
    }
  }
  scores.sort((a, b) => b.r - a.r);
  const best = scores[0];

  // The runner-up for the margin EXCLUDES the best key's relative major/minor:
  // the relative shares its pitch set, so it is always competitive — and it is
  // the spec's accepted one-toggle ambiguity, not a wrong suggestion. Measuring
  // decisiveness against genuinely different keys is what separates "clearly
  // in G" from "could be anything."
  const relativePc = best.mode === "major" ? (best.pc + 9) % 12 : (best.pc + 3) % 12;
  const relativeMode: Mode = best.mode === "major" ? "minor" : "major";
  const runnerUp = scores.find((s) => !(s.pc === relativePc && s.mode === relativeMode) && s !== best);
  const margin = Math.max(0, best.r - (runnerUp?.r ?? -1));

  // Confidence: how decisively the best key beats the (non-relative) runner-up,
  // scaled by the absolute fit. A flat/chromatic profile correlates weakly with
  // everything → small margin, small r → silent.
  const confidence = Math.min(1, margin * 3.5) * Math.min(1, Math.max(0, best.r) * 1.6);

  return { tonic: spellTonic(best.pc, best.mode), mode: best.mode, confidence };
}

// ─── The combined pure detector ─────────────────────────────────────────────

export function detectTempoKey(samples: Float32Array, sampleRate: number): TempoKeyResult {
  const capped =
    samples.length > sampleRate * MAX_ANALYZE_SECONDS
      ? samples.subarray(0, sampleRate * MAX_ANALYZE_SECONDS)
      : samples;
  const { data, rate } = decimate(capped, sampleRate);
  let tempo: TempoDetection | null = null;
  let key: KeyDetection | null = null;
  try {
    tempo = detectTempo(data, rate);
  } catch {
    tempo = null;
  }
  try {
    key = detectKey(data, rate);
  } catch {
    key = null;
  }
  return { tempo, key };
}

// ─── Browser wrapper (decode via OfflineAudioContext) ────────────────────────

/**
 * Decode a captured blob and run detection. BEST-EFFORT: null on ANY failure
 * (no Web Audio, decode error, empty take). Runs after the save — the outbox
 * "sacred promise" never depends on this.
 */
export async function detectTempoKeyFromBlob(blob: Blob): Promise<TempoKeyResult | null> {
  try {
    if (typeof OfflineAudioContext === "undefined") return null;
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (!decoded || decoded.length === 0) return null;
    return detectTempoKey(decoded.getChannelData(0), decoded.sampleRate);
  } catch {
    return null;
  }
}
