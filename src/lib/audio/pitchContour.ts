/**
 * pitchContour — the Melody Lens engine (C4).
 *
 * Computes a take's melodic SHAPE once, right after the blob exists (the same
 * moment waveformPeaks.ts runs), so every card can show the tune rising and
 * falling and Hum-to-Find can search it. Two outputs from one pass:
 *
 *   pitch_contour : number[] — ~96 points of RELATIVE pitch in the take's own
 *                   range (0 = its lowest sung pitch, 1 = its highest);
 *                   -1 marks silence / unvoiced frames.
 *   melody_key    : number[] — the search fingerprint: note pitches as
 *                   SEMITONE INTERVALS from the take's first note
 *                   (key-invariant); Parsons up/down/same derives from it.
 *
 * It is a SHAPE, not notation — never presented as accurate notes, so it can
 * never mislead. Detection is a self-contained YIN (difference function +
 * CMNDF + parabolic interpolation) restricted to the vocal band (~80–1000 Hz)
 * — no external DSP library, fully offline, milliseconds of work on PCM the
 * capture pipeline has already decoded.
 *
 * Cleanup is the craft (the order matters): confidence-gate → median filter
 * (kills single-frame spikes) → octave-continuity repair (a frame that jumps
 * ±1 octave from its neighbourhood is the classic tracker artifact — snap it
 * back) → short-gap interpolation → normalize to the take's own min/max.
 *
 * Pure functions over Float32Array so every stage is unit-testable without
 * WebAudio; `computePitchContour(blob)` at the bottom is the browser wrapper
 * (decode + band-pass via OfflineAudioContext). BEST-EFFORT ONLY: it returns
 * null on any failure — capture must save whether or not pitch succeeds.
 */

// ─── Tunables (documented in docs/MELODY-LENS-CONTRACT.md) ───────────────────

/** Vocal-fundamental search band. Also the YIN lag-range limit. */
export const MIN_F0_HZ = 80;
export const MAX_F0_HZ = 1000;

/** Analysis frame: ~46 ms window, ~12 ms hop at 44.1 kHz. */
const WINDOW_SIZE = 2048;
const HOP_SIZE = 512;

/** YIN CMNDF acceptance threshold (lower = stricter voicing). */
const YIN_THRESHOLD = 0.14;

/** Frames quieter than this RMS are silence — never pitch-tracked. */
const SILENCE_RMS = 0.01;

/** Persisted contour resolution (cards downsample from this). */
export const CONTOUR_POINTS = 96;

/** Sentinel for unvoiced/silent contour points. */
export const UNVOICED = -1;

/** Median-filter radius (frames) for spike removal. */
const MEDIAN_RADIUS = 2;

/** Gaps up to this many frames are bridged by interpolation. */
const MAX_GAP_FRAMES = 6;

/** A new note begins when the smoothed pitch moves this far (semitones)
 *  from the current note's running level and holds. */
const NOTE_STEP_SEMITONES = 0.8;
/** ...for at least this many consecutive frames. */
const NOTE_HOLD_FRAMES = 3;

/** A take needs this much melodic range (semitones) to count as "sung" —
 *  below it (spoken word) the melody_key is left empty on purpose. */
const MIN_SUNG_RANGE = 2;

/** Below a semitone of total range the take is effectively monotone — its
 *  contour renders as a calm mid-band line, not pinned to the floor. */
const FLAT_RANGE_SEMITONES = 1;

/** Cap the analyzed span so a very long take never blows memory (the band-pass
 *  buffer) or worker time. A song's melodic identity lives in its opening. */
const MAX_ANALYZE_SECONDS = 60;

export interface PitchContourResult {
  /** Relative contour, CONTOUR_POINTS long; UNVOICED (-1) marks silence. */
  pitchContour: number[];
  /** Semitone intervals of note onsets from the first note. Empty = no melody. */
  melodyKey: number[];
}

// ─── Stage 1: per-frame f0 (YIN) ─────────────────────────────────────────────

export interface PitchFrame {
  /** Fundamental in Hz, or 0 when unvoiced/silent. */
  f0Hz: number;
  /** 0–1; 1 = clean periodic frame. 0 when unvoiced. */
  confidence: number;
}

/**
 * YIN pitch detection for one frame (de Cheveigné & Kawahara 2002):
 * difference function → cumulative-mean-normalized difference → first dip
 * under threshold → parabolic interpolation for sub-sample lag.
 */
function yinFrame(frame: Float32Array, sampleRate: number): PitchFrame {
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_F0_HZ));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_F0_HZ), frame.length - 1);
  if (maxLag <= minLag + 2) return { f0Hz: 0, confidence: 0 };

  // RMS silence gate — don't hallucinate pitch out of noise floors.
  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
  if (Math.sqrt(energy / frame.length) < SILENCE_RMS) return { f0Hz: 0, confidence: 0 };

  // Difference function d(tau), then CMNDF d'(tau).
  const d = new Float64Array(maxLag + 1);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let sum = 0;
    const limit = frame.length - tau;
    for (let i = 0; i < limit; i++) {
      const diff = frame[i] - frame[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmndf = new Float64Array(maxLag + 1).fill(1);
  let running = 0;
  for (let tau = minLag; tau <= maxLag; tau++) {
    running += d[tau];
    cmndf[tau] = running > 0 ? (d[tau] * (tau - minLag + 1)) / running : 1;
  }

  // First local minimum under the threshold; else the global minimum.
  let tauEst = -1;
  for (let tau = minLag + 1; tau < maxLag; tau++) {
    if (cmndf[tau] < YIN_THRESHOLD && cmndf[tau] <= cmndf[tau + 1]) {
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    let best = minLag;
    for (let tau = minLag + 1; tau <= maxLag; tau++) if (cmndf[tau] < cmndf[best]) best = tau;
    // A weak global minimum is an unvoiced frame, not a note.
    if (cmndf[best] > 0.35) return { f0Hz: 0, confidence: 0 };
    tauEst = best;
  }

  // Parabolic interpolation around the chosen lag.
  let tau = tauEst;
  if (tau > minLag && tau < maxLag) {
    const s0 = cmndf[tau - 1];
    const s1 = cmndf[tau];
    const s2 = cmndf[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-12) tau += (s2 - s0) / denom;
  }

  return { f0Hz: sampleRate / tau, confidence: Math.max(0, Math.min(1, 1 - cmndf[tauEst])) };
}

/** Frame the PCM and YIN each frame. Pure — feed it any Float32Array. */
export function extractPitchTrack(pcm: Float32Array, sampleRate: number): PitchFrame[] {
  const frames: PitchFrame[] = [];
  if (pcm.length < WINDOW_SIZE) {
    if (pcm.length > WINDOW_SIZE / 4) frames.push(yinFrame(pcm, sampleRate));
    return frames;
  }
  for (let start = 0; start + WINDOW_SIZE <= pcm.length; start += HOP_SIZE) {
    frames.push(yinFrame(pcm.subarray(start, start + WINDOW_SIZE), sampleRate));
  }
  return frames;
}

// ─── Stage 2: cleanup (the craft) ────────────────────────────────────────────

const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

/**
 * Confidence-gate → median filter → octave repair → gap interpolation.
 * Returns per-frame MIDI-scale pitch (fractional), NaN where unvoiced.
 */
export function cleanPitchTrack(frames: PitchFrame[]): number[] {
  // Gate: keep only confidently-voiced frames inside the band.
  const midi = frames.map((f) =>
    f.f0Hz >= MIN_F0_HZ && f.f0Hz <= MAX_F0_HZ && f.confidence >= 0.45 ? hzToMidi(f.f0Hz) : NaN,
  );

  // Median filter over voiced neighbourhoods (spikes die, steps survive).
  const filtered = midi.map((v, i) => {
    if (Number.isNaN(v)) return NaN;
    const hood: number[] = [];
    for (let j = Math.max(0, i - MEDIAN_RADIUS); j <= Math.min(midi.length - 1, i + MEDIAN_RADIUS); j++) {
      if (!Number.isNaN(midi[j])) hood.push(midi[j]);
    }
    hood.sort((a, b) => a - b);
    return hood[Math.floor(hood.length / 2)];
  });

  // Octave-continuity repair: a frame ~±12 semitones off its local
  // neighbourhood is the classic halving/doubling artifact — snap it back.
  const repaired = filtered.slice();
  for (let i = 0; i < repaired.length; i++) {
    const v = repaired[i];
    if (Number.isNaN(v)) continue;
    const hood: number[] = [];
    for (let j = Math.max(0, i - 4); j <= Math.min(repaired.length - 1, i + 4); j++) {
      if (j !== i && !Number.isNaN(filtered[j])) hood.push(filtered[j]);
    }
    if (hood.length < 2) continue;
    hood.sort((a, b) => a - b);
    const local = hood[Math.floor(hood.length / 2)];
    for (const octaves of [-24, -12, 12, 24]) {
      if (Math.abs(v + octaves - local) < 3 && Math.abs(v - local) > 8) {
        repaired[i] = v + octaves;
        break;
      }
    }
  }

  // Bridge short unvoiced gaps between voiced stretches (consonants, breaths).
  const out = repaired.slice();
  let i = 0;
  while (i < out.length) {
    if (!Number.isNaN(out[i])) {
      i++;
      continue;
    }
    const gapStart = i;
    while (i < out.length && Number.isNaN(out[i])) i++;
    const gapLen = i - gapStart;
    const before = gapStart > 0 ? out[gapStart - 1] : NaN;
    const after = i < out.length ? out[i] : NaN;
    if (gapLen <= MAX_GAP_FRAMES && !Number.isNaN(before) && !Number.isNaN(after)) {
      for (let g = 0; g < gapLen; g++) {
        out[gapStart + g] = before + ((after - before) * (g + 1)) / (gapLen + 1);
      }
    }
  }
  return out;
}

// ─── Stage 3: the two persisted shapes ───────────────────────────────────────

/** Resample the cleaned MIDI track to a fixed-length relative contour. */
export function toRelativeContour(cleanMidi: number[], points = CONTOUR_POINTS): number[] {
  const voiced = cleanMidi.filter((v) => !Number.isNaN(v));
  if (voiced.length === 0) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of voiced) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo;
  // A monotone (or sub-semitone) take has no shape to normalize — render it as
  // a calm mid-band line rather than pinned to the floor.
  const flat = span < FLAT_RANGE_SEMITONES;
  const range = Math.max(span, 1);

  const out = new Array<number>(points);
  for (let p = 0; p < points; p++) {
    const start = Math.floor((p * cleanMidi.length) / points);
    const end = Math.max(start + 1, Math.floor(((p + 1) * cleanMidi.length) / points));
    const bucket: number[] = [];
    for (let i = start; i < end && i < cleanMidi.length; i++) {
      if (!Number.isNaN(cleanMidi[i])) bucket.push(cleanMidi[i]);
    }
    if (bucket.length === 0) {
      out[p] = UNVOICED;
    } else if (flat) {
      out[p] = 0.5;
    } else {
      bucket.sort((a, b) => a - b);
      const mid = bucket[Math.floor(bucket.length / 2)];
      out[p] = Math.round(Math.max(0, Math.min(1, (mid - lo) / range)) * 1000) / 1000;
    }
  }
  return out;
}

/**
 * Segment the cleaned track into notes and emit semitone intervals from the
 * first note — the key-invariant search fingerprint. Empty when the take has
 * no real melodic movement (spoken word ranks itself out honestly).
 */
export function toMelodyKey(cleanMidi: number[]): number[] {
  const notes: number[] = [];
  let current: number[] = [];

  const commit = () => {
    if (current.length >= NOTE_HOLD_FRAMES) {
      const sorted = [...current].sort((a, b) => a - b);
      notes.push(sorted[Math.floor(sorted.length / 2)]);
    }
    current = [];
  };

  for (const v of cleanMidi) {
    if (Number.isNaN(v)) {
      commit();
      continue;
    }
    if (current.length === 0) {
      current.push(v);
      continue;
    }
    const level = current.reduce((a, b) => a + b, 0) / current.length;
    if (Math.abs(v - level) >= NOTE_STEP_SEMITONES) {
      commit();
      current.push(v);
    } else {
      current.push(v);
    }
  }
  commit();

  if (notes.length < 2) return [];
  const lo = Math.min(...notes);
  const hi = Math.max(...notes);
  if (hi - lo < MIN_SUNG_RANGE) return []; // flat delivery — not a melody
  return notes.map((n) => Math.round(n - notes[0]));
}

/** The full pure pipeline over already-decoded mono PCM. */
export function contourFromPcm(pcm: Float32Array, sampleRate: number): PitchContourResult | null {
  const track = extractPitchTrack(pcm, sampleRate);
  if (track.length === 0) return null;
  const clean = cleanPitchTrack(track);
  const pitchContour = toRelativeContour(clean);
  if (pitchContour.length === 0 || pitchContour.every((p) => p === UNVOICED)) return null;
  return { pitchContour, melodyKey: toMelodyKey(clean) };
}

// ─── Render + search helpers (pure) ──────────────────────────────────────────

/**
 * Downsample a persisted contour to a card's bar count. Median-pooling per
 * bucket; a bucket with no voiced points stays UNVOICED.
 */
export function resampleContour(contour: number[], barCount: number): number[] {
  if (contour.length === 0) return [];
  if (contour.length === barCount) return contour;
  const out = new Array<number>(barCount);
  for (let bar = 0; bar < barCount; bar++) {
    const start = Math.floor((bar * contour.length) / barCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * contour.length) / barCount));
    const bucket: number[] = [];
    for (let i = start; i < end && i < contour.length; i++) {
      if (contour[i] !== UNVOICED) bucket.push(contour[i]);
    }
    if (bucket.length === 0) {
      out[bar] = UNVOICED;
    } else {
      bucket.sort((a, b) => a - b);
      out[bar] = bucket[Math.floor(bucket.length / 2)];
    }
  }
  return out;
}

/** Parsons code (U/D/R steps) derived from a melody_key — the crude-but-
 *  robust prefilter representation. */
export function toParsons(melodyKey: number[]): string {
  let out = "";
  for (let i = 1; i < melodyKey.length; i++) {
    const step = melodyKey[i] - melodyKey[i - 1];
    out += step > 0 ? "U" : step < 0 ? "D" : "R";
  }
  return out;
}

// ─── Off-thread YIN (keeps capture instant) ──────────────────────────────────

let worker: Worker | null = null;
let workerBroken = false;

/** Lazily spin up the analysis worker; null if the environment has none or it
 *  ever failed (→ synchronous fallback). */
function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./pitchContour.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("error", () => { workerBroken = true; worker = null; });
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

/** Run the YIN + cleanup off the main thread; fall back to synchronous compute
 *  if the worker is unavailable, errors, or hangs. Never throws. */
function analyze(pcm: Float32Array, sampleRate: number): Promise<PitchContourResult | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(safeSync(pcm, sampleRate));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: PitchContourResult | null, viaError: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      if (viaError) resolve(safeSync(pcm, sampleRate));
      else resolve(r);
    };
    const onMsg = (e: MessageEvent<PitchContourResult | null>) => finish(e.data, false);
    const onErr = () => { workerBroken = true; worker = null; finish(null, true); };
    // A hung worker must never strand a save — fall back after a generous bound.
    const timer = setTimeout(() => finish(null, true), 8000);
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    // Transfer a copy (the AudioBuffer owns the original) so the post is zero-copy.
    const copy = new Float32Array(pcm);
    w.postMessage({ pcm: copy, sampleRate }, [copy.buffer]);
  });
}

function safeSync(pcm: Float32Array, sampleRate: number): PitchContourResult | null {
  try {
    return contourFromPcm(pcm, sampleRate);
  } catch {
    return null;
  }
}

// ─── The browser wrapper (best-effort, never blocks a save) ──────────────────

/**
 * Decode a recorded/imported blob, band-pass toward the vocal fundamental,
 * and run the pure pipeline OFF the main thread. Returns null on ANY failure —
 * the caller saves the take regardless (the outbox promise never depends on
 * pitch), and capture never freezes on the analysis.
 */
export async function computePitchContour(blob: Blob): Promise<PitchContourResult | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decodeCtx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
    if (decoded.length === 0) return null;

    // Cap the analyzed span: a long take's band-pass buffer would otherwise
    // hold minutes of audio (OOM risk on import), and the melodic identity
    // lives in the opening anyway.
    const analyzeLen = Math.min(decoded.length, Math.floor(decoded.sampleRate * MAX_ANALYZE_SECONDS));

    // Band-pass toward the vocal fundamental so a light instrument in the
    // room doesn't own the contour: highpass 80 Hz → lowpass 1 kHz, rendered
    // offline through real biquads (steeper + cheaper than hand-rolled DSP).
    const ctx = new OfflineAudioContext(1, analyzeLen, decoded.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = MIN_F0_HZ;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = MAX_F0_HZ;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(ctx.destination);
    source.start(0);
    const filtered = await ctx.startRendering();

    return await analyze(filtered.getChannelData(0), filtered.sampleRate);
  } catch {
    return null; // best-effort by contract
  }
}
