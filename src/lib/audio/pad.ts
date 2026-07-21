/**
 * pad — the AmbientPad engine (C4): a one-tap, genuinely beautiful ambient
 * tonal bed in the song's key. The sibling of metronome.ts — Click keeps a
 * hum in time, Pad keeps it in key. Pure Web Audio: ZERO assets, ZERO
 * network, all 12 keys procedural. It creates NOTHING about the song — it is
 * accompaniment to hum over, like a metronome or a tuner; worst case you tap
 * it off and nothing is lost.
 *
 * WHY IT SOUNDS LUSH (and not like a cheap video-game tone) — the chain:
 *
 *   VOICING   tonic + perfect fifth stacked across three octaves, NO third by
 *             default — a fifths drone consonant under BOTH major and minor
 *             melodies (it commits to the KEY, not the mode). An optional
 *             major/minor third voice crossfades in only when asked. Voice
 *             gains are HEADROOM-NORMALIZED (the summed bed peaks ≈ 1.0) so
 *             the mix can never clip into harshness.
 *   UNISON    every voice is 3 oscillators detuned ±7 cents (saw · triangle ·
 *             saw) summed — the #1 lushness factor: shimmer and width instead
 *             of a flat tone.
 *   BREATH    each voice's gain rides a slow LFO (0.09–0.19 Hz, a different
 *             rate per voice so they drift out of phase) — the pad breathes.
 *   WIDTH     voices panned across the stereo field (StereoPannerNode).
 *   MOTION    the summed bus passes a gentle lowpass whose cutoff is swept by
 *             a very slow LFO — the timbre evolves instead of sitting still.
 *   WASH      a ConvolverNode fed a PROCEDURAL impulse response (decaying
 *             filtered noise, ~3.5 s, stereo, built in memory — no bundled
 *             file) at a high wet mix: the worship-pad hall.
 *   GLUE      a gentle DynamicsCompressor rides the summed wash — the reverb
 *             build-up breathes against it instead of stacking into peaks.
 *   AIR       a whisper of high-passed looped noise.
 *   SMOOTH    master gain ramps in ~1.5 s and out ~2.5 s (never a click);
 *             key changes GLIDE (~0.3 s portamento); volume moves smoothly.
 *
 * LIFECYCLE (the no-failure part): every start() builds a FRESH graph; stop()
 * and dispose() RETIRE the current graph — it fades on its own timer and
 * tears itself down when the fade completes. Retiring graphs are tracked, so
 * tapping the pad back ON mid-fade simply swells a new bed over the old one's
 * tail — never an abrupt cut, never a pop, never a timer tearing down the
 * wrong graph. start() never throws (a failed node build tears down silently
 * — worst case is silence, recoverable with a tap). resumeIfNeeded() heals
 * the iOS suspended-after-interruption state (phone call, screen lock).
 *
 * Mirrors the Metronome class shape: no React, no DOM — construct, start()
 * (creates + resumes the AudioContext INSIDE the user gesture, autoplay
 * policy), stop(), dispose(). Never a runaway drone: dispose fades every
 * live graph fast and closes the context.
 *
 * NOTE vs the click's never-bleed rule: the pad DELIBERATELY keeps sounding
 * while recording — humming over it is the point (and its harmonics are in
 * key, so it reinforces F13's detection rather than fighting it). The
 * headphones hint in Pad.tsx is the honest guidance. This is the one audio
 * surface where speaker bleed is an accepted, guided choice — not a bug.
 * Tuned values are documented in docs/PAD-CONTRACT.md.
 */

import { pitchClass, type Mode } from "@/lib/chords/keys";

export type PadFlavor = "neutral" | Mode;

// ── Tuning (documented in docs/PAD-CONTRACT.md) ──────────────────────────────

export const PAD_DEFAULT_VOLUME = 0.25;
export const PAD_MIN_VOLUME = 0.05;
export const PAD_MAX_VOLUME = 0.5;

const ATTACK_S = 1.5;
const RELEASE_S = 2.5;
const DISPOSE_FADE_S = 0.25;
const GLIDE_S = 0.3;

const DETUNE_CENTS = 7;
const FILTER_BASE_HZ = 1800;
const FILTER_LFO_HZ = 0.07;
const FILTER_LFO_DEPTH_HZ = 450;
const REVERB_SECONDS = 3.5;
const REVERB_WET = 0.85;
const REVERB_DRY = 0.5;
const AIR_GAIN = 0.012;

/**
 * The summed voice bed is normalized to peak ≈ this, so even with the reverb
 * wash and max volume the output cannot clip into digital harshness.
 */
const VOICING_HEADROOM = 1.0;

/** Per-voice breathing rates — mutually detuned so phases drift apart. */
const BREATH_RATES_HZ = [0.09, 0.11, 0.13, 0.15, 0.17, 0.19];
const BREATH_DEPTH = 0.16;

// ── Pure music math (unit-tested) ────────────────────────────────────────────

/** MIDI note → frequency (A4 = 440). */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Parse the app's key format ("G" / "Em") into tonic + flavor-as-mode. */
export function parsePadKey(keySignature: string | null | undefined): {
  tonic: string;
  mode: Mode;
} | null {
  if (!keySignature) return null;
  const minor = /m$/.test(keySignature);
  const tonic = keySignature.replace(/m$/, "");
  if (pitchClass(tonic) < 0) return null;
  return { tonic, mode: minor ? "minor" : "major" };
}

export interface PadVoiceSpec {
  freq: number;
  gain: number;
  pan: number;
  breathRateHz: number;
  /** The optional third — crossfaded in/out with the flavor, never popped. */
  isThird: boolean;
}

/**
 * The voicing: root+fifth over octaves 2–4 (65–330 Hz fundamentals), lower
 * voices carrying more weight, the whole bed normalized to VOICING_HEADROOM
 * (including the flavored third's maximum, so choosing a flavor can never
 * push the mix into clipping). The third sits mid-stack at a modest level —
 * color, not a chord lead.
 */
export function padVoicing(tonic: string, flavor: PadFlavor): PadVoiceSpec[] {
  const pc = Math.max(0, pitchClass(tonic));
  const base = 36 + pc; // tonic at octave 2
  const thirdMax = 0.42;
  const spec: Array<[semis: number, gain: number, pan: number, isThird: boolean]> = [
    [0, 1.0, 0, false], // root  · oct 2 · center anchor
    [7, 0.75, -0.55, false], // fifth · oct 2 · left
    [12, 0.7, 0.55, false], // root  · oct 3 · right
    [19, 0.5, -0.3, false], // fifth · oct 3
    [24, 0.34, 0.3, false], // root  · oct 4 · shimmer
    [flavor === "minor" ? 15 : 16, flavor === "neutral" ? 0 : thirdMax, 0.12, true],
  ];
  // Normalize against the FULL possible sum (third at max) so the level is
  // stable whether or not a flavor is chosen.
  const fullSum = spec.reduce((s, [, g, , isThird]) => s + (isThird ? thirdMax : g), 0);
  const scale = VOICING_HEADROOM / fullSum;
  return spec.map(([semis, gain, pan, isThird], i) => ({
    freq: midiToFrequency(base + semis),
    gain: gain * scale,
    pan,
    breathRateHz: BREATH_RATES_HZ[i % BREATH_RATES_HZ.length],
    isThird,
  }));
}

/**
 * Procedural reverb impulse: exponentially-decaying noise, softened by a
 * one-pole lowpass in the generation loop, independently per channel for
 * stereo width. Built directly as an AudioBuffer — no file, no network, no
 * offline render needed. (ConvolverNode.normalize is true by default, which
 * keeps the wash level-stable regardless of this buffer's raw energy.)
 */
export function buildImpulseResponse(ctx: BaseAudioContext, seconds = REVERB_SECONDS): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.2); // exponential-ish tail
      const noise = Math.random() * 2 - 1;
      smoothed = smoothed * 0.82 + noise * 0.18; // gentle lowpass = warm tail
      data[i] = smoothed * decay;
    }
  }
  return buffer;
}

// ── The engine ───────────────────────────────────────────────────────────────

interface VoiceNodes {
  oscillators: OscillatorNode[];
  gain: GainNode;
  breathOsc: OscillatorNode;
  breathGain: GainNode;
  panner: StereoPannerNode;
  isThird: boolean;
}

/** One complete signal graph — retired and torn down as a unit. */
interface PadGraph {
  master: GainNode;
  voices: VoiceNodes[];
  nodes: AudioNode[];
  sources: Array<OscillatorNode | AudioBufferSourceNode>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
}

export interface AmbientPadOptions {
  tonic?: string;
  flavor?: PadFlavor;
  volume?: number;
}

/** True when this browser can synthesize the pad at all. */
export function isPadSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) !=
      null
  );
}

export class AmbientPad {
  private ctx: AudioContext | null = null;
  private graph: PadGraph | null = null;
  private retiring: PadGraph[] = [];
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  private tonic: string;
  private flavor: PadFlavor;
  private volume: number;
  private running = false;

  constructor(opts?: AmbientPadOptions) {
    this.tonic = opts?.tonic ?? "C";
    this.flavor = opts?.flavor ?? "neutral";
    this.volume = clampPadVolume(opts?.volume ?? PAD_DEFAULT_VOLUME);
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentKey(): { tonic: string; flavor: PadFlavor } {
    return { tonic: this.tonic, flavor: this.flavor };
  }

  /**
   * Call from the user's tap — resumes the context inside the gesture.
   * NEVER throws: a failed node build tears itself down and resolves silent
   * (worst case: no sound; a tap-off/on retries). Restart during a fade-out
   * simply swells a fresh bed while the old one finishes its tail.
   */
  async start(): Promise<void> {
    if (this.running) return;
    if (!isPadSupported()) return;
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      if (!this.ctx) this.ctx = new Ctor();
      if (this.ctx.state !== "running") await this.ctx.resume().catch(() => {});
      this.graph = this.buildGraph(this.ctx);
      this.running = true;
    } catch {
      // A partially-built graph must not linger half-connected.
      if (this.graph) {
        this.teardownGraphNodes(this.graph);
        this.graph = null;
      }
      this.running = false;
    }
  }

  /** Fade out over the long release; the graph retires and frees itself. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.retireGraph(RELEASE_S);
  }

  /** Glide every oscillator to the new key — a swell, never a jump. */
  setKey(tonic: string, flavor?: PadFlavor): void {
    this.tonic = tonic;
    if (flavor !== undefined) this.flavor = flavor;
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    const specs = padVoicing(this.tonic, this.flavor);
    graph.voices.forEach((voice, i) => {
      const spec = specs[i];
      if (!spec) return;
      for (const osc of voice.oscillators) {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setTargetAtTime(spec.freq, now, GLIDE_S / 3);
      }
      // The flavor third breathes in/out with the choice — no pops.
      if (voice.isThird) {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(spec.gain, now, 0.2);
        voice.breathGain.gain.setTargetAtTime(spec.gain * BREATH_DEPTH, now, 0.2);
      }
    });
  }

  setVolume(volume: number): void {
    this.volume = clampPadVolume(volume);
    const ctx = this.ctx;
    if (ctx && this.graph && this.running) {
      this.graph.master.gain.cancelScheduledValues(ctx.currentTime);
      this.graph.master.gain.setTargetAtTime(Math.max(0.001, this.volume), ctx.currentTime, 0.15);
    }
  }

  /**
   * Heal the suspended-after-interruption state (phone call, screen lock,
   * iOS backgrounding): if the pad should be sounding, nudge the context
   * back to life. Best-effort, never throws.
   */
  async resumeIfNeeded(): Promise<void> {
    if (!this.running || !this.ctx) return;
    if (this.ctx.state !== "running") {
      await this.ctx.resume().catch(() => {});
    }
  }

  /** Fast fade of EVERY live graph + close the context. Never a runaway. */
  dispose(): void {
    this.running = false;
    // Fast-fade the current graph and any still-fading retirees together.
    if (this.graph) this.retireGraph(DISPOSE_FADE_S);
    const ctx = this.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      for (const g of this.retiring) {
        try {
          g.master.gain.cancelScheduledValues(now);
          g.master.gain.setValueAtTime(Math.max(0.0001, g.master.gain.value), now);
          g.master.gain.exponentialRampToValueAtTime(0.0001, now + DISPOSE_FADE_S);
        } catch {
          /* node already released */
        }
      }
    }
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      for (const g of this.retiring) this.teardownGraphNodes(g);
      this.retiring = [];
      const toClose = this.ctx;
      this.ctx = null;
      if (toClose) {
        try {
          const r = toClose.close() as unknown;
          if (r && typeof (r as Promise<void>).catch === "function") {
            (r as Promise<void>).catch(() => {});
          }
        } catch {
          /* already closed */
        }
      }
    }, DISPOSE_FADE_S * 1000 + 80);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Move the current graph to the retiring list with its own fade + free. */
  private retireGraph(fadeS: number): void {
    const ctx = this.ctx;
    const graph = this.graph;
    this.graph = null;
    if (!graph) return;
    if (ctx) {
      const now = ctx.currentTime;
      try {
        graph.master.gain.cancelScheduledValues(now);
        graph.master.gain.setValueAtTime(Math.max(0.0001, graph.master.gain.value), now);
        graph.master.gain.exponentialRampToValueAtTime(0.0001, now + fadeS);
      } catch {
        /* context already gone — just free below */
      }
    }
    this.retiring.push(graph);
    // The graph frees ITSELF when its fade completes — a later start() can
    // never collide with this timer, because it owns a different graph.
    graph.teardownTimer = setTimeout(() => {
      this.teardownGraphNodes(graph);
      this.retiring = this.retiring.filter((g) => g !== graph);
    }, fadeS * 1000 + 100);
  }

  private buildGraph(ctx: AudioContext): PadGraph {
    const now = ctx.currentTime;
    const graph: PadGraph = { master: ctx.createGain(), voices: [], nodes: [], sources: [], teardownTimer: null };

    // Master — the soft swell in.
    graph.master.gain.setValueAtTime(0.0001, now);
    graph.master.gain.exponentialRampToValueAtTime(Math.max(0.001, this.volume), now + ATTACK_S);
    graph.master.connect(ctx.destination);

    // Glue: a gentle compressor so the reverb build-up breathes, never stacks.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 20;
    compressor.ratio.value = 2.5;
    compressor.attack.value = 0.15;
    compressor.release.value = 0.4;
    compressor.connect(graph.master);
    graph.nodes.push(compressor);

    // Reverb wash: bus → (dry + convolver-wet) → compressor.
    const bus = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = REVERB_WET;
    const dry = ctx.createGain();
    dry.gain.value = REVERB_DRY;
    bus.connect(dry).connect(compressor);
    bus.connect(convolver);
    convolver.connect(wet).connect(compressor);
    graph.nodes.push(bus, convolver, wet, dry);

    // Evolving lowpass in front of the bus.
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = FILTER_BASE_HZ;
    filter.Q.value = 0.5;
    filter.connect(bus);
    graph.nodes.push(filter);

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = FILTER_LFO_HZ;
    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.value = FILTER_LFO_DEPTH_HZ;
    filterLfo.connect(filterLfoGain).connect(filter.frequency);
    filterLfo.start(now);
    graph.sources.push(filterLfo);
    graph.nodes.push(filterLfoGain);

    // The voices.
    for (const spec of padVoicing(this.tonic, this.flavor)) {
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = spec.gain;
      const panner = ctx.createStereoPanner();
      panner.pan.value = spec.pan;
      voiceGain.connect(panner).connect(filter);

      // Breathing: slow LFO into the voice gain, rate unique per voice.
      const breathOsc = ctx.createOscillator();
      breathOsc.frequency.value = spec.breathRateHz;
      const breathGain = ctx.createGain();
      breathGain.gain.value = spec.gain * BREATH_DEPTH;
      breathOsc.connect(breathGain).connect(voiceGain.gain);
      breathOsc.start(now);

      // Unison: saw · triangle · saw, detuned around the target pitch.
      const oscillators = ([-DETUNE_CENTS, 0, DETUNE_CENTS] as const).map((cents, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 1 ? "triangle" : "sawtooth";
        osc.frequency.value = spec.freq;
        osc.detune.value = cents;
        const trim = ctx.createGain();
        trim.gain.value = 1 / 3;
        osc.connect(trim).connect(voiceGain);
        graph.nodes.push(trim);
        osc.start(now);
        return osc;
      });

      graph.voices.push({ oscillators, gain: voiceGain, breathOsc, breathGain, panner, isThird: spec.isThird });
    }

    // Air: a whisper of high-passed looped noise under the wash.
    const airBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const airData = airBuffer.getChannelData(0);
    for (let i = 0; i < airData.length; i++) airData[i] = Math.random() * 2 - 1;
    const air = ctx.createBufferSource();
    air.buffer = airBuffer;
    air.loop = true;
    const airHp = ctx.createBiquadFilter();
    airHp.type = "highpass";
    airHp.frequency.value = 4000;
    const airGain = ctx.createGain();
    airGain.gain.value = AIR_GAIN;
    air.connect(airHp).connect(airGain).connect(bus);
    air.start(now);
    graph.sources.push(air);
    graph.nodes.push(airHp, airGain);

    return graph;
  }

  private teardownGraphNodes(graph: PadGraph): void {
    if (graph.teardownTimer) {
      clearTimeout(graph.teardownTimer);
      graph.teardownTimer = null;
    }
    for (const voice of graph.voices) {
      for (const osc of voice.oscillators) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
        osc.disconnect();
      }
      try {
        voice.breathOsc.stop();
      } catch {
        /* already stopped */
      }
      voice.breathOsc.disconnect();
      voice.breathGain.disconnect();
      voice.gain.disconnect();
      voice.panner.disconnect();
    }
    graph.voices = [];
    for (const src of graph.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    }
    graph.sources = [];
    for (const node of graph.nodes) node.disconnect();
    graph.nodes = [];
    graph.master.disconnect();
  }
}

export function clampPadVolume(volume: number): number {
  if (!Number.isFinite(volume)) return PAD_DEFAULT_VOLUME;
  return Math.min(PAD_MAX_VOLUME, Math.max(PAD_MIN_VOLUME, volume));
}
