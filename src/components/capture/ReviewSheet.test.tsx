import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewSheet from "./ReviewSheet";
import { commitTakeToCanvas } from "@/integrations/cog/canvas";

/**
 * C2 Step 5 — the Review Sheet must NEVER be a dead end, and the commit must
 * hand D-group's commitTakeToCanvas exactly the edited blocks.
 *
 * The dead-end this guards: a transcript that never reaches a terminal status
 * (poll timeout / still processing). The old code left ZERO blocks and copy
 * pointing at the side rail — which sits BEHIND the open sheet.
 */

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), message: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/integrations/cog/transcript", () => ({
  requestTranscript: vi.fn(async () => []),
  // Non-terminal on purpose: simulates the 45s poll giving up mid-processing.
  pollTranscriptUntilReady: vi.fn(async () => ({
    id: "take-1",
    song_id: "song-1",
    storage_path: "takes/take-1.webm",
    duration_ms: 4200,
    transcript_status: "processing",
    transcript_json: null,
    transcript_error: null,
  })),
}));

vi.mock("@/integrations/cog/takes", () => ({
  getTakeSignedUrl: vi.fn(async () => "https://signed.example/take-1"),
}));

vi.mock("@/integrations/cog/canvas", () => ({
  commitTakeToCanvas: vi.fn(async () => ({ song_id: "song-1", card_ids: ["card-1"] })),
}));

vi.mock("@/lib/voice/audioCache", () => ({
  audioCache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) },
}));

vi.mock("./ReviewAudioPlayer", () => ({ default: () => null }));

function renderSheet(onCommitted = vi.fn()) {
  render(
    <MemoryRouter>
      <ReviewSheet
        open
        takeId="take-1"
        songId="song-1"
        songTitle="Grace"
        storagePath="takes/take-1.webm"
        durationMs={4200}
        pendingBlocks={[]}
        onClose={vi.fn()}
        onCommitted={onCommitted}
      />
    </MemoryRouter>,
  );
  return onCommitted;
}

describe("ReviewSheet — never a dead end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds one editable block when the transcript never reaches a terminal status", async () => {
    renderSheet();

    // The manual fallback block appears even though transcription timed out —
    // the writer can type immediately; the audio is already saved.
    const textarea = await screen.findByPlaceholderText("Edit this block…");
    expect(textarea).toBeTruthy();
    // And the sheet is NOT in the error state — this is a calm continuation.
    expect(screen.queryByText(/Transcription couldn't finish/)).toBeNull();
  });

  it("commits the edited block to commitTakeToCanvas with the exact payload shape", async () => {
    const onCommitted = renderSheet();

    const textarea = await screen.findByPlaceholderText("Edit this block…");
    fireEvent.change(textarea, { target: { value: "when mercy found me" } });

    fireEvent.click(screen.getByRole("button", { name: "Add to song" }));

    await waitFor(() => expect(commitTakeToCanvas).toHaveBeenCalledTimes(1));
    expect(commitTakeToCanvas).toHaveBeenCalledWith({
      take_id: "take-1",
      song_id: "song-1",
      blocks: [
        expect.objectContaining({
          kind: "idea",
          label: "Idea",
          text: "when mercy found me",
        }),
      ],
    });
    await waitFor(() =>
      expect(onCommitted).toHaveBeenCalledWith({
        songId: "song-1",
        songTitle: "Grace",
        blockCount: 1,
      }),
    );
  });
});
