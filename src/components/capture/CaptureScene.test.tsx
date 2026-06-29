import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CaptureScene from "./CaptureScene";

const mocks = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    startSucceeds: true,
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
  getPrimaryTakeIdForMemo: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
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
  default: () => null,
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
