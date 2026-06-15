import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceRecorder } from "./useVoiceRecorder";

/**
 * Drives the recorder through the scenarios that actually break in the field:
 * a clean start/stop, double-tap concurrency, audio interruption (call /
 * Bluetooth), and an empty capture. Browser media APIs are mocked because
 * jsdom has none — these assert our state machine, not the platform codecs.
 */

// ── Mock MediaStream + track ──────────────────────────────────────────────
let lastTrack: { stop: ReturnType<typeof vi.fn>; onended: (() => void) | null };
function makeStream() {
  const track = { stop: vi.fn(), onended: null as (() => void) | null, kind: "audio" };
  lastTrack = track;
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

// ── Mock MediaRecorder ────────────────────────────────────────────────────
let emitBytes = true;
class MockMediaRecorder {
  static instanceCount = 0;
  static isTypeSupported() {
    return true;
  }
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    MockMediaRecorder.instanceCount += 1;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    if (emitBytes) {
      this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }) });
    }
    this.onstop?.();
  }
}

// ── Mock AudioContext ─────────────────────────────────────────────────────
class MockAudioContext {
  state: "suspended" | "running" = "suspended";
  resume = vi.fn().mockImplementation(() => {
    this.state = "running";
    return Promise.resolve();
  });
  close = vi.fn().mockResolvedValue(undefined);
  createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }));
  createAnalyser = vi.fn(() => ({
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
  }));
}

beforeEach(() => {
  emitBytes = true;
  MockMediaRecorder.instanceCount = 0;
  vi.stubGlobal("MediaRecorder", MockMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal("AudioContext", MockAudioContext as unknown as typeof AudioContext);
  Object.defineProperty(window, "AudioContext", { writable: true, configurable: true, value: MockAudioContext });
  Object.defineProperty(navigator, "mediaDevices", {
    writable: true,
    configurable: true,
    value: { getUserMedia: vi.fn().mockImplementation(() => Promise.resolve(makeStream())) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useVoiceRecorder", () => {
  it("starts recording on startRecording()", async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.state.phase).toBe("recording");
    expect(MockMediaRecorder.instanceCount).toBe(1);
  });

  it("returns a non-empty blob with reason 'manual' on stopRecording()", async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    let res: Awaited<ReturnType<typeof result.current.stopRecording>> = null;
    await act(async () => {
      res = await result.current.stopRecording();
    });
    expect(res).not.toBeNull();
    expect(res!.blob.size).toBeGreaterThan(0);
    expect(res!.reason).toBe("manual");
    expect(result.current.state.phase).toBe("done");
  });

  it("ignores a concurrent second start (double-tap guard)", async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      const p1 = result.current.startRecording();
      const p2 = result.current.startRecording();
      await Promise.all([p1, p2]);
    });
    expect(MockMediaRecorder.instanceCount).toBe(1);
  });

  it("auto-saves with reason 'interrupted' when the audio track ends", async () => {
    const onAutoFinalize = vi.fn();
    const { result } = renderHook(() => useVoiceRecorder({ onAutoFinalize }));
    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      lastTrack.onended?.();
    });
    expect(onAutoFinalize).toHaveBeenCalledTimes(1);
    expect(onAutoFinalize.mock.calls[0][0]?.reason).toBe("interrupted");
  });

  it("surfaces an empty capture as null + error phase", async () => {
    emitBytes = false;
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => {
      await result.current.startRecording();
    });
    let res: Awaited<ReturnType<typeof result.current.stopRecording>> = null;
    await act(async () => {
      res = await result.current.stopRecording();
    });
    expect(res).toBeNull();
    expect(result.current.state.phase).toBe("error");
  });
});
