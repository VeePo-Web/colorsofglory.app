import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaptureScene from "./CaptureScene";

/**
 * Lifecycle regression guard (C2) — mounts CaptureScene with the REAL
 * useVoiceRecorder + useLiveTranscript hooks and only shims the browser media
 * APIs.
 *
 * Why this exists: CaptureScene once keyed its teardown effect on
 * `[recorder, live]`. Both hooks return a fresh object literal every render, so
 * that cleanup fired on EVERY re-render — cancelRecording() killed a take the
 * moment recording started ("flashes listening, then reverts, never records"),
 * and CaptureScene.test.tsx couldn't see it because it mocks both hooks as
 * stable singletons. This suite is the one place the real identity churn meets
 * the real component, so a re-keyed teardown can never ship silently again.
 */

// ── Browser media shims (as in useVoiceRecorder.test.ts) ──────────────────
let lastTrack: { stop: ReturnType<typeof vi.fn>; onended: (() => void) | null; kind: string };
function makeStream() {
  const track = { stop: vi.fn(), onended: null as (() => void) | null, kind: "audio" };
  lastTrack = track;
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

let lastRecorder: MockMediaRecorder | null = null;
class MockMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  stopCalls = 0;
  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastRecorder = this;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.stopCalls += 1;
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}

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

// ── Network / storage seams mocked; hooks + BigMic stay REAL ──────────────
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), message: vi.fn(), success: vi.fn() }),
}));
vi.mock("@/integrations/cog/transcript", () => ({
  getPrimaryTakeIdForMemo: vi.fn(async () => null),
  getTakeWithTranscript: vi.fn(async () => null),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/lib/voice/captureOutbox", () => ({
  enqueueCaptureUpload: vi.fn(async () => ({ outboxId: "ob-life" })),
  subscribeOutbox: vi.fn(() => () => {}),
  retryOutboxJob: vi.fn(),
}));
vi.mock("@/lib/voice/audioCache", () => ({
  audioCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/voice/seedIdeaApi", () => ({
  saveSeedIdea: vi.fn(),
  listSeedIdeas: vi.fn(async () => []),
}));
vi.mock("@/lib/voice/failedCaptureStore", () => ({
  saveFailedCapture: vi.fn(async () => undefined),
  listFailedCaptures: vi.fn(() => []),
  getFailedCaptureFile: vi.fn(async () => null),
  clearAllFailedCaptures: vi.fn(async () => undefined),
}));
vi.mock("@/lib/nav/preloadOnIdle", () => ({ preloadOnIdle: vi.fn() }));
vi.mock("./SideRail", () => ({ default: () => null }));
vi.mock("./LiveTranscript", () => ({ default: () => null }));
vi.mock("./CaptureSheet", () => ({ default: () => null }));
vi.mock("./ReviewSheet", () => ({ default: () => null }));
vi.mock("./ImportMemoButton", () => ({ default: () => null }));
vi.mock("./LatestPeekStrip", () => ({ default: () => null }));
vi.mock("./CommitRibbon", () => ({ default: () => null }));
// NOTE: BigMic, useVoiceRecorder, useLiveTranscript are deliberately REAL.

beforeEach(() => {
  lastRecorder = null;
  vi.stubGlobal("MediaRecorder", MockMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal("AudioContext", MockAudioContext as unknown as typeof AudioContext);
  Object.defineProperty(window, "AudioContext", {
    writable: true,
    configurable: true,
    value: MockAudioContext,
  });
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

describe("CaptureScene lifecycle with the real hooks", () => {
  it("keeps a live recording alive across re-renders (duration ticker, hook identity churn)", async () => {
    render(
      <MemoryRouter>
        <CaptureScene songId="song-1" songTitle="Grace" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    // Real BigMic flips its label from the real recorder phase.
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());

    // Let the 100ms duration ticker force several re-renders. With the old
    // [recorder, live]-keyed cleanup this is where the take died.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

    expect(lastRecorder?.state).toBe("recording");
    expect(lastRecorder?.stopCalls).toBe(0);
    expect(lastTrack.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy();

    // Tidy: stop so no interval leaks out of the test.
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await waitFor(() => expect(lastRecorder?.state).toBe("inactive"));
  });
});
