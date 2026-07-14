/**
 * clickTransport — the ONE app-wide click, as an external store.
 *
 * Every `useMetronome()` hook is a VIEW over this module, not an engine of its
 * own. That is what makes the system honest: the recording sheet's beat strip,
 * the capture scene, and the canvas record flow all see the SAME running
 * click, the same count-in, the same beat — and it is structurally impossible
 * for two transports to tick against each other (the "two hooks, two engines,
 * double click" failure this module exists to prevent).
 *
 * The engine underneath is lib/audio/metronome's `Metronome`, which enforces
 * the never-bleed invariant per scheduled click. This module adds:
 *   • shared state (running / beat / bpm) with subscribe/getSnapshot,
 *   • the HANG-PROOF count-in contract: an awaiter is ALWAYS released —
 *     downbeat (normal), stop/rebuild (canceled), engine failure, or a
 *     wall-clock fallback when the audio clock never delivers (hidden tab),
 *   • refcounted teardown: when the last subscribed surface unmounts, the
 *     click stops and the AudioContext is released. A click can never outlive
 *     every surface that could silence it.
 */

import { clampBpm, Metronome } from "./metronome";

export interface ClickBeat {
  /** 0-indexed beat within the bar. */
  beatInBar: number;
  /** Monotonic counter so effects can fire once per landed beat. */
  seq: number;
  /** Count-in pulses are visually distinct and precede the take. */
  phase: "count-in" | "beat";
}

export interface ClickTransportState {
  running: boolean;
  /** The beat that just landed (null when idle) — drives the visual pulse. */
  beat: ClickBeat | null;
}

let engine: Metronome | null = null;
let engineHasCountIn = false;
let state: ClickTransportState = { running: false, beat: null };
let beatSeq = 0;
let countInResolve: (() => void) | null = null;
let countInFallback: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(next: Partial<ClickTransportState>): void {
  const merged = { ...state, ...next };
  if (merged.running === state.running && merged.beat === state.beat) return;
  state = merged;
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* one bad view must not stall the clock for the rest */
    }
  });
}

/**
 * Release any pending clickCountIn() awaiter. The ONLY way the resolver is
 * ever dropped — every stop/rebuild/teardown path funnels through here, so an
 * awaited record flow can never hang behind a dead click.
 */
function resolvePendingCountIn(): void {
  if (countInFallback != null) {
    clearTimeout(countInFallback);
    countInFallback = null;
  }
  const resolve = countInResolve;
  countInResolve = null;
  resolve?.();
}

function disposeEngine(): void {
  resolvePendingCountIn();
  engine?.dispose();
  engine = null;
  engineHasCountIn = false;
}

function buildEngine(bpm: number, beatsPerBar: number, withCountIn: boolean): Metronome {
  disposeEngine();
  engine = new Metronome({
    bpm,
    beatsPerBar,
    countIn: withCountIn,
    onBeat: (beatInBar) => {
      beatSeq += 1;
      emit({ beat: { beatInBar, seq: beatSeq, phase: "beat" } });
    },
    onCountInBeat: (beatInBar) => {
      beatSeq += 1;
      emit({ beat: { beatInBar, seq: beatSeq, phase: "count-in" } });
    },
    onCountInDone: resolvePendingCountIn,
  });
  engineHasCountIn = withCountIn;
  return engine;
}

export function clickSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) != null
  );
}

/**
 * One count-in bar of `beats`; resolves on the audio clock as the first real
 * beat lands, and the click CONTINUES seamlessly on the same grid
 * (session-gated once the mic arms). Open the mic on resolve.
 */
export function clickCountIn(bpm: number, beats = 4): Promise<void> {
  if (!clickSupported()) return Promise.resolve();
  const built = buildEngine(bpm, beats, true);
  return new Promise<void>((resolve) => {
    countInResolve = resolve;
    // Wall-clock fallback: if the audio clock never delivers the downbeat
    // (tab backgrounded mid-count-in, context suspended), release the awaiter
    // anyway — the recorder's own resilience owns what follows.
    const expectedMs = (beats * 60_000) / clampBpm(bpm);
    countInFallback = setTimeout(resolvePendingCountIn, expectedMs + 1500);
    emit({ running: true });
    void built.start().catch(() => {
      // No context / resume refused — never strand the take behind a click.
      emit({ running: false });
      resolvePendingCountIn();
    });
  });
}

/** Start (or live-retune) the steady click at `bpm`. */
export function clickStart(bpm: number, beatsPerBar = 4): void {
  if (!clickSupported()) return;
  if (engine?.isRunning) {
    // Live retune — the seamless count-in → take continuation path.
    engine.setBpm(bpm);
    engine.setBeatsPerBar(beatsPerBar);
    emit({ running: true });
    return;
  }
  // A stopped count-in engine must not count in again as a steady click.
  const target = engine && !engineHasCountIn ? engine : buildEngine(bpm, beatsPerBar, false);
  target.setBpm(bpm);
  target.setBeatsPerBar(beatsPerBar);
  emit({ running: true });
  void target.start().catch(() => emit({ running: false }));
}

export function clickStop(): void {
  resolvePendingCountIn();
  engine?.stop();
  emit({ running: false, beat: null });
}

export function clickSetBpm(bpm: number): void {
  engine?.setBpm(bpm);
}

export function getClickState(): ClickTransportState {
  return state;
}

/**
 * Subscribe a surface to the shared click. When the LAST surface unsubscribes
 * (route change, full unmount), the click stops and the audio graph is
 * released — a beat must never keep ticking with nobody left to silence it.
 */
export function subscribeClick(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clickStop();
      disposeEngine();
    }
  };
}

/** Test-only. */
export function __resetClickTransportForTests(): void {
  disposeEngine();
  listeners.clear();
  state = { running: false, beat: null };
  beatSeq = 0;
}
