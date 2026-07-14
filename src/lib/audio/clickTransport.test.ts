import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __resetClickTransportForTests,
  clickCountIn,
  clickStart,
  clickStop,
  getClickState,
  subscribeClick,
} from "./clickTransport";
import { __resetAudioSessionForTests } from "./audioSession";

/**
 * A minimal AudioContext stand-in whose clock NEVER advances — the exact
 * shape of a suspended/backgrounded context. Anything that depends on the
 * audio clock (the count-in downbeat) will never arrive, which is precisely
 * what the hang-proof contract must survive.
 */
class FakeAudioContext {
  currentTime = 0;
  state = "running";
  baseLatency = 0.01;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
  createOscillator() {
    return {
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      },
      connect: () => ({}),
    };
  }
}

describe("clickTransport — the one app-wide click", () => {
  let originalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
    vi.useFakeTimers();
    __resetAudioSessionForTests();
    __resetClickTransportForTests();
  });

  afterEach(() => {
    __resetClickTransportForTests();
    vi.useRealTimers();
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
  });

  it("countIn is HANG-PROOF: the wall-clock fallback releases the awaiter when the audio clock never delivers", async () => {
    let resolved = false;
    const p = clickCountIn(120, 4).then(() => {
      resolved = true;
    });
    // 4 beats at 120 BPM = 2000ms expected + 1500ms grace.
    await vi.advanceTimersByTimeAsync(3400);
    expect(resolved).toBe(false); // not a premature resolve
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(resolved).toBe(true);
  });

  it("stop() during a pending count-in releases the awaiter immediately — a record flow can never hang", async () => {
    let resolved = false;
    const p = clickCountIn(90, 4).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    clickStop();
    await p;
    expect(resolved).toBe(true);
    expect(getClickState().running).toBe(false);
  });

  it("a second count-in releases the first awaiter instead of stranding it (double-tap safety)", async () => {
    let firstResolved = false;
    const first = clickCountIn(120, 4).then(() => {
      firstResolved = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    const second = clickCountIn(120, 4);
    await first;
    expect(firstResolved).toBe(true);
    clickStop();
    await second;
  });

  it("is ONE shared transport: every subscriber reads the same state", async () => {
    const seenA: boolean[] = [];
    const seenB: boolean[] = [];
    const offA = subscribeClick(() => seenA.push(getClickState().running));
    const offB = subscribeClick(() => seenB.push(getClickState().running));
    clickStart(100);
    await vi.advanceTimersByTimeAsync(10);
    expect(getClickState().running).toBe(true);
    expect(seenA[0]).toBe(true);
    expect(seenB[0]).toBe(true);
    offA();
    // One surface left — the click keeps running for it.
    expect(getClickState().running).toBe(true);
    offB();
    // Last surface gone — the click must not tick on unheard.
    expect(getClickState().running).toBe(false);
  });
});
