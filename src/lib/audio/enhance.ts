/**
 * Polish — the subtle, always-on, MUSIC-SAFE enhancement bus (C4).
 *
 * Every voice memo played through COG can sound clearer, warmer, and more
 * even — like a real demo — via a transparent mastering-style chain. It is
 * NOT speech enhancement: Adobe-Podcast-class models re-synthesize talking
 * voice and are, per Adobe's own FAQ, "not compatible with singing" — on a
 * hum or voice+guitar they strip the instrument and artifact the vocal.
 * Polish is the opposite philosophy: gentle EQ + compression + loudness,
 * the performance untouched (docs/POLISH-CONTRACT.md).
 *
 * THE STRICTLY-ADDITIVE SAFETY LADDER — the app is never worse:
 *   full chain → (chain build failed) loudness-gain-only → (anything else)
 *   dry playback exactly as today. Every Web Audio step is wrapped; a
 *   failure drops a rung, never throws to a player. Two hard rules make
 *   silence impossible:
 *   1) Only `blob:` sources are ever attached — a cross-origin URL through
 *      createMediaElementSource plays SILENCE, so remote/signed-URL
 *      playback always stays on today's plain-element path.
 *   2) Attach only while the context is RUNNING (resumed inside the tap) —
 *      an element wired into a suspended context is silent.
 *   Once a source exists, any later failure hard-wires it straight to the
 *   destination (dry through the graph) — never dangling.
 *
 * Tuning (research: Adobe Podcast leveling standard + vocal-chain practice;
 * see docs/POLISH-CONTRACT.md): loudness toward ≈ −16 LUFS integrated with
 * a −1 dBFS ceiling; EQ/compression conservative enough to be transparent.
 */

// ── The music-safe chain values (the knobs — see the contract) ───────────
export const POLISH_CHAIN = {
  highPassHz: 70, // rumble/handling; low enough to keep guitar body
  highPassQ: 0.707,
  mudHz: 300,
  mudDb: -2.5,
  mudQ: 1.0,
  presenceHz: 3500,
  presenceDb: 1.5,
  presenceQ: 1.0,
  airHz: 10_000,
  airDb: 2.5,
  compThresholdDb: -24,
  compRatio: 2.5,
  compKneeDb: 30,
  compAttackS: 0.015,
  compReleaseS: 0.2,
  limiterThresholdDb: -2,
  limiterRatio: 20,
  limiterAttackS: 0.003,
  limiterReleaseS: 0.1,
  /** ≈ −1 dBFS output ceiling. */
  masterGain: 0.89,
} as const;

// ── Loudness profile (the biggest "sounds pro" win) ──────────────────────
/** ≈ −16 LUFS-ish via gated active-RMS (K-weighting approximated). */
export const POLISH_TARGET_RMS = 0.158;
export const POLISH_MIN_GAIN = 0.5;
export const POLISH_MAX_GAIN = 8;
/** Pre-limiter peak allowance (~+3 dB over full scale, limiter guards). */
export const POLISH_PEAK_ALLOWANCE = 1.4;
/** Below this peak the take is silence — leave it untouched. */
export const POLISH_SILENCE_PEAK = 0.01;

/**
 * Pure loudness math: gated active-RMS → gain toward the target, clamped
 * so quiet phone takes come up and nothing gets slammed. Exported for tests.
 */
export function computeLoudnessGain(samples: Float32Array, sampleRate: number): number {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > maxAbs) maxAbs = a;
  }
  if (maxAbs < POLISH_SILENCE_PEAK) return 1;

  // 400 ms blocks; blocks under the gate (−60 dBFS) are silence, not signal.
  const block = Math.max(1, Math.floor(sampleRate * 0.4));
  const gate = 0.001;
  let sum = 0;
  let active = 0;
  for (let start = 0; start < samples.length; start += block) {
    const end = Math.min(start + block, samples.length);
    let sq = 0;
    for (let i = start; i < end; i++) sq += samples[i] * samples[i];
    const rms = Math.sqrt(sq / (end - start));
    if (rms > gate) {
      sum += rms;
      active += 1;
    }
  }
  if (active === 0) return 1;
  const activeRms = sum / active;
  const gain = POLISH_TARGET_RMS / activeRms;
  const peakCap = POLISH_PEAK_ALLOWANCE / maxAbs;
  return Math.min(Math.max(gain, POLISH_MIN_GAIN), POLISH_MAX_GAIN, peakCap);
}

const profileCache = new Map<string, number>();

/** Decode a take and compute its loudness gain (cached; 1 on any failure). */
export async function computeLoudnessProfile(memoId: string, blob: Blob): Promise<number> {
  const cached = profileCache.get(memoId);
  if (cached !== undefined) return cached;
  try {
    const buf = await blob.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44_100);
    const decoded = await ctx.decodeAudioData(buf);
    const limit = Math.min(decoded.length, decoded.sampleRate * 30);
    const data = decoded.getChannelData(0).subarray(0, limit);
    const gain = computeLoudnessGain(data, decoded.sampleRate);
    profileCache.set(memoId, gain);
    return gain;
  } catch {
    profileCache.set(memoId, 1);
    return 1;
  }
}

/** Test hook / session cleanup. */
export function clearPolishProfileCache(): void {
  profileCache.clear();
}

/**
 * Resolve a take's loudness gain: use the provided blob, else the cached
 * profile, else quietly pull the blob from the device audio cache (covers
 * attach sites that only know the memo id — e.g. the take player's gesture
 * retry). null = no profile available; leave the gain at unity.
 */
async function loudnessFor(memoId: string, blob?: Blob): Promise<number | null> {
  if (blob) return computeLoudnessProfile(memoId, blob);
  const cached = profileCache.get(memoId);
  if (cached !== undefined) return cached;
  try {
    const { audioCache } = await import("@/lib/voice/audioCache");
    const stored = await audioCache.get(memoId);
    if (!stored) return null;
    return computeLoudnessProfile(memoId, stored);
  } catch {
    return null;
  }
}

// ── The global preference (default ON, persisted, live) ──────────────────
const PREF_KEY = "cog-polish-enabled";
let prefValue: boolean | null = null;
const prefListeners = new Set<() => void>();

export function isPolishEnabled(): boolean {
  if (prefValue === null) {
    try {
      prefValue = localStorage.getItem(PREF_KEY) !== "off";
    } catch {
      prefValue = true;
    }
  }
  return prefValue;
}

export function setPolishEnabled(on: boolean): void {
  prefValue = on;
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* preference lives for the session anyway */
  }
  routeAll();
  prefListeners.forEach((l) => l());
}

/** useSyncExternalStore-compatible subscription (G2's settings + the pill). */
export function subscribePolish(listener: () => void): () => void {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

/** Web Audio exists at all? (The pill hides itself when it doesn't.) */
export function isPolishSupported(): boolean {
  return typeof window !== "undefined" &&
    typeof (window.AudioContext ?? (window as any).webkitAudioContext) === "function";
}

// ── The shared bus ───────────────────────────────────────────────────────
type BusEntry = {
  el: HTMLAudioElement;
  makeup: GainNode;
  loudnessGain: number;
};

let busCtx: AudioContext | null = null;
/** Chain input (null = chain build failed → loudness-gain-only rung). */
let chainInput: AudioNode | null = null;
let dryOut: GainNode | null = null;
const entries: Set<BusEntry> = new Set();
const attachedEls = new WeakSet<HTMLAudioElement>();
let visibilityHooked = false;

function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

/** Build the shared music-safe chain into a context. Returns its input. */
export function buildPolishChain(ctx: BaseAudioContext, destination: AudioNode): AudioNode {
  const c = POLISH_CHAIN;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = c.highPassHz;
  hp.Q.value = c.highPassQ;

  const mud = ctx.createBiquadFilter();
  mud.type = "peaking";
  mud.frequency.value = c.mudHz;
  mud.gain.value = c.mudDb;
  mud.Q.value = c.mudQ;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = c.presenceHz;
  presence.gain.value = c.presenceDb;
  presence.Q.value = c.presenceQ;

  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = c.airHz;
  air.gain.value = c.airDb;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = c.compThresholdDb;
  comp.ratio.value = c.compRatio;
  comp.knee.value = c.compKneeDb;
  comp.attack.value = c.compAttackS;
  comp.release.value = c.compReleaseS;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = c.limiterThresholdDb;
  limiter.ratio.value = c.limiterRatio;
  limiter.knee.value = 0;
  limiter.attack.value = c.limiterAttackS;
  limiter.release.value = c.limiterReleaseS;

  const master = ctx.createGain();
  master.gain.value = c.masterGain;

  hp.connect(mud);
  mud.connect(presence);
  presence.connect(air);
  air.connect(comp);
  comp.connect(limiter);
  limiter.connect(master);
  master.connect(destination);
  return hp;
}

function ensureBus(): AudioContext | null {
  if (busCtx && busCtx.state !== "closed") return busCtx;
  if (!isPolishSupported()) return null;
  try {
    const Ctor: typeof AudioContext = window.AudioContext ?? (window as any).webkitAudioContext;
    busCtx = new Ctor();
    dryOut = busCtx.createGain();
    dryOut.gain.value = 1;
    dryOut.connect(busCtx.destination);
    try {
      chainInput = buildPolishChain(busCtx, busCtx.destination);
    } catch {
      chainInput = null; // loudness-gain-only rung — still never worse
    }
    if (!visibilityHooked && typeof document !== "undefined") {
      visibilityHooked = true;
      // iOS suspends the context on calls/screen lock — self-heal on return
      // (the Pad lesson: a suspended context under attached elements = silence).
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && busCtx && busCtx.state === "suspended") {
          void busCtx.resume().catch(() => {});
        }
      });
    }
    return busCtx;
  } catch {
    busCtx = null;
    return null;
  }
}

function pruneEntries(): void {
  entries.forEach((e) => {
    if (!e.el.src || e.el.src === "about:blank") {
      try {
        e.makeup.disconnect();
      } catch {
        /* already free */
      }
      entries.delete(e);
    }
  });
}

function routeEntry(e: BusEntry): void {
  try {
    e.makeup.disconnect();
  } catch {
    /* first route */
  }
  const polished = isPolishEnabled();
  try {
    if (polished && chainInput) {
      e.makeup.gain.value = e.loudnessGain;
      e.makeup.connect(chainInput);
    } else if (polished && dryOut) {
      // Chain unavailable — the loudness-gain-only rung.
      e.makeup.gain.value = e.loudnessGain;
      e.makeup.connect(dryOut);
    } else if (dryOut) {
      // "Original": the untouched take — unity gain, straight through.
      e.makeup.gain.value = 1;
      e.makeup.connect(dryOut);
    } else if (busCtx) {
      e.makeup.gain.value = 1;
      e.makeup.connect(busCtx.destination);
    }
  } catch {
    // Last-resort: never leave a source dangling (dangling = silence).
    try {
      if (busCtx) e.makeup.connect(busCtx.destination);
    } catch {
      /* nothing left to try — element was attached, context is gone */
    }
  }
}

function routeAll(): void {
  pruneEntries();
  entries.forEach(routeEntry);
}

/**
 * Is this element already wired into the bus? A media-element source is
 * PERMANENT — once attached, a cross-origin src on that element would play
 * silence, so players that REUSE an element must convert any remote source
 * to a blob first when this returns true (see TakeMiniPlayer/
 * VoiceMemoListItem).
 */
export function isPolishAttached(el: HTMLAudioElement): boolean {
  return attachedEls.has(el);
}

/**
 * Route an <audio> element through the polish bus — STRICTLY ADDITIVELY.
 * Call from inside the play gesture, before or right after play(). No-ops
 * (leaving today's dry playback untouched) unless every safety condition
 * holds. Safe to call repeatedly. Never throws.
 */
export async function polishAttach(
  el: HTMLAudioElement,
  opts: { memoId?: string; blob?: Blob } = {},
): Promise<void> {
  try {
    if (attachedEls.has(el)) return;
    pruneEntries(); // free graph nodes of released elements as we go
    // Rule 1: blob: sources only — cross-origin media through the graph is
    // silence, so remote/signed URLs keep today's plain-element path.
    if (!el.src || !el.src.startsWith("blob:")) return;
    const ctx = ensureBus();
    if (!ctx) return;
    if (ctx.state !== "running") {
      // Rule 2: resume INSIDE the gesture; if it won't run, stay dry this
      // play and retry on the next tap. Bounded so play is never delayed.
      await Promise.race([
        ctx.resume().catch(() => {}),
        new Promise((r) => setTimeout(r, 250)),
      ]);
      if (ctx.state !== "running") return;
    }
    if (attachedEls.has(el)) return; // re-check across the await
    const source = ctx.createMediaElementSource(el);
    attachedEls.add(el);
    try {
      const makeup = ctx.createGain();
      makeup.gain.value = 1;
      source.connect(makeup);
      const entry: BusEntry = { el, makeup, loudnessGain: 1 };
      entries.add(entry);
      routeEntry(entry);
      if (opts.memoId) {
        void loudnessFor(opts.memoId, opts.blob).then((gain) => {
          if (gain === null) return;
          entry.loudnessGain = gain;
          if (isPolishEnabled() && busCtx) {
            // Glide, don't jump, if the profile lands mid-play.
            try {
              entry.makeup.gain.setTargetAtTime(gain, busCtx.currentTime, 0.05);
            } catch {
              entry.makeup.gain.value = gain;
            }
          }
        });
      }
    } catch {
      // Source exists — it MUST reach the destination or the element is
      // silent. Hard-wire dry.
      try {
        source.connect(ctx.destination);
      } catch {
        /* unreachable in practice; context alive, source valid */
      }
    }
  } catch {
    /* any failure above source creation = element stays exactly as today */
  }
}

/** Test hook: tear the bus down (unit tests only). */
export function __resetPolishBus(): void {
  entries.clear();
  try {
    void busCtx?.close();
  } catch {
    /* already closed */
  }
  busCtx = null;
  chainInput = null;
  dryOut = null;
}

// ── Export: render a polished WAV (the original is never touched) ────────

/** Encode an AudioBuffer to 16-bit PCM WAV bytes. Exported for tests. */
export function encodeWavBytes(buffer: AudioBuffer): ArrayBuffer {
  const channels = Math.min(2, buffer.numberOfChannels);
  const length = buffer.length;
  const rate = buffer.sampleRate;
  const bytesPerFrame = channels * 2;
  const dataSize = length * bytesPerFrame;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  const chData: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) chData.push(buffer.getChannelData(ch));
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const s = Math.max(-1, Math.min(1, chData[ch][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return buf;
}

/** Encode an AudioBuffer to a 16-bit PCM WAV blob. */
export function encodeWav(buffer: AudioBuffer): Blob {
  return new Blob([encodeWavBytes(buffer)], { type: "audio/wav" });
}

/**
 * Render the polished version of a take once, offline, through the SAME
 * chain — a produced demo to share. Returns null on any failure; the
 * original blob is never modified.
 */
export async function renderPolishedWav(memoId: string, blob: Blob): Promise<Blob | null> {
  try {
    const arr = await blob.arrayBuffer();
    const probe = new OfflineAudioContext(1, 1, 44_100);
    const decoded = await probe.decodeAudioData(arr);
    const ctx = new OfflineAudioContext(
      Math.min(2, decoded.numberOfChannels),
      decoded.length,
      decoded.sampleRate,
    );
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    const makeup = ctx.createGain();
    makeup.gain.value = await computeLoudnessProfile(memoId, blob);
    const input = buildPolishChain(ctx, ctx.destination);
    src.connect(makeup);
    makeup.connect(input);
    src.start();
    const rendered = await ctx.startRendering();
    return encodeWav(rendered);
  } catch {
    return null;
  }
}
