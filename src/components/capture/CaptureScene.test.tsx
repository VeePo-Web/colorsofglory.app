import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaptureScene from "./CaptureScene";
import { enqueueCaptureUpload } from "@/lib/voice/captureOutbox";
import { submitSharedAudio } from "@/integrations/cog/intake";

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    startSucceeds: true,
    outboxListeners: [] as Array<(event: unknown) => void>,
    recorder: {
      state: { phase: "idle", durationMs: 0, analyserNode: null, error: null },
      startRecording: vi.fn(async () => {
        order.push("recorder:start");
        return mocks.startSucceeds;
      }),
      stopRecording: vi.fn(),
      cancelRecording: vi.fn(),
    },
    live: {
      supported: true,
      listening: false,
      partial: "",
      words: [],
      error: null,
      start: vi.fn(() => order.push("live:start")),
      stop: vi.fn(() => order.push("live:stop")),
      reset: vi.fn(() => order.push("live:reset")),
    },
  };
});

vi.mock("@/hooks/useVoiceRecorder", () => ({
  useVoiceRecorder: () => mocks.recorder,
}));

vi.mock("@/hooks/useLiveTranscript", () => ({
  useLiveTranscript: () => mocks.live,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    message: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/integrations/cog/intake", () => ({
  submitSharedAudio: vi.fn(),
}));

vi.mock("@/integrations/cog/songs", () => ({
  createSong: vi.fn(),
}));

vi.mock("@/integrations/cog/transcript", () => ({
  getPrimaryTakeIdForMemo: vi.fn(async () => "take-7"),
  getTakeWithTranscript: vi.fn(async () => ({
    id: "take-7",
    song_id: "song-1",
    storage_path: "takes/take-7.webm",
    duration_ms: 4200,
    transcript_status: "idle",
    transcript_json: null,
    transcript_error: null,
  })),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

// The durable save path (C2 Step 2): CaptureScene must route takes through the
// Capture Outbox, never call the intake edge fn directly.
vi.mock("@/lib/voice/captureOutbox", () => ({
  enqueueCaptureUpload: vi.fn(async () => ({ outboxId: "ob-1" })),
  subscribeOutbox: vi.fn((listener: (event: unknown) => void) => {
    mocks.outboxListeners.push(listener);
    return () => {
      const idx = mocks.outboxListeners.indexOf(listener);
      if (idx >= 0) mocks.outboxListeners.splice(idx, 1);
    };
  }),
  retryOutboxJob: vi.fn(),
}));

vi.mock("@/lib/voice/audioCache", () => ({
  audioCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}));

vi.mock("./BigMic", () => ({
  default: ({ onTap }: { onTap: () => void }) => (
    <button type="button" onClick={onTap}>
      Start recording
    </button>
  ),
}));

vi.mock("./SideRail", () => ({
  default: () => null,
}));

vi.mock("./LiveTranscript", () => ({
  default: () => <div data-testid="live-transcript" />,
}));

vi.mock("./CaptureSheet", () => ({
  default: () => null,
}));

vi.mock("./ReviewSheet", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="review-open" /> : null),
}));

vi.mock("./ImportMemoButton", () => ({
  default: () => null,
}));

vi.mock("./LatestPeekStrip", () => ({
  default: () => null,
}));

vi.mock("./CommitRibbon", () => ({
  default: () => null,
}));

describe("CaptureScene mic start", () => {
  beforeEach(() => {
    mocks.order.length = 0;
    mocks.startSucceeds = true;
    mocks.outboxListeners.length = 0;
    mocks.recorder.state.phase = "idle";
    vi.clearAllMocks();
  });

  it("lets MediaRecorder start before optional live transcription starts", async () => {
    render(
      <MemoryRouter>
        <CaptureScene songId="song-1" songTitle="Grace" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    await waitFor(() => expect(mocks.live.start).toHaveBeenCalledTimes(1));
    expect(mocks.order).toEqual(["live:stop", "live:reset", "recorder:start", "live:start"]);
  });

  it("does not start live transcription when the recorder cannot start", async () => {
    mocks.startSucceeds = false;
    render(
      <MemoryRouter>
        <CaptureScene songId="song-1" songTitle="Grace" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    await waitFor(() => expect(mocks.recorder.startRecording).toHaveBeenCalledTimes(1));
    expect(mocks.live.start).not.toHaveBeenCalled();
  });
});

describe("CaptureScene durable save (the sacred promise)", () => {
  beforeEach(() => {
    mocks.order.length = 0;
    mocks.startSucceeds = true;
    mocks.outboxListeners.length = 0;
    mocks.recorder.state.phase = "idle";
    vi.clearAllMocks();
  });

  function stopWithTake() {
    mocks.recorder.state.phase = "recording";
    mocks.recorder.stopRecording.mockResolvedValueOnce({
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
      mimeType: "audio/webm",
      durationMs: 4200,
      reason: "manual",
    });
    render(
      <MemoryRouter>
        <CaptureScene songId="song-1" songTitle="Grace" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    // The real recorder transitions to "done" once stopRecording resolves; the
    // scene re-reads phase on its next render (queued card is hidden mid-take).
    mocks.recorder.state.phase = "done";
  }

  function fireOutbox(event: Record<string, unknown>) {
    return act(async () => {
      mocks.outboxListeners.slice().forEach((listener) => listener(event));
    });
  }

  it("routes a stopped take through the outbox (uploaderKey 'intake'), never the intake fn directly", async () => {
    stopWithTake();

    await waitFor(() => expect(enqueueCaptureUpload).toHaveBeenCalledTimes(1));
    expect(enqueueCaptureUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        songId: "song-1",
        title: "Grace — capture",
        durationMs: 4200,
        uploaderKey: "intake",
      }),
    );
    expect(submitSharedAudio).not.toHaveBeenCalled();

    // The scene's waiter + the background listener are both subscribed.
    await waitFor(() => expect(mocks.outboxListeners.length).toBeGreaterThanOrEqual(2));
    await fireOutbox({ type: "success", outboxId: "ob-1", memoId: "memo-9", songId: "song-1" });

    // Synced take → primary take resolved → Review Sheet opens.
    await waitFor(() => expect(screen.getByTestId("review-open")).toBeTruthy());
  });

  it("parks a failed first attempt as a calm queued card, then graduates it to review when the outbox syncs", async () => {
    stopWithTake();

    await waitFor(() => expect(enqueueCaptureUpload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.outboxListeners.length).toBeGreaterThanOrEqual(2));

    // First attempt fails (e.g. offline). The take is retained + auto-retried —
    // the scene shows reassurance, not an error, and review does NOT open.
    await fireOutbox({ type: "failed", outboxId: "ob-1", songId: "song-1", error: "offline", willRetry: true });
    await waitFor(() => expect(screen.getByText("Saved on this device")).toBeTruthy());
    expect(screen.queryByTestId("review-open")).toBeNull();

    // A background auto-retry succeeds while the scene is still open — the
    // queued take graduates straight into review.
    await fireOutbox({ type: "success", outboxId: "ob-1", memoId: "memo-9", songId: "song-1" });
    await waitFor(() => expect(screen.getByTestId("review-open")).toBeTruthy());
  });
});
