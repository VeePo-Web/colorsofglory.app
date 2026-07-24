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

/**
 * F12 hybrid pipeline — the on-device deterministic split is the INSTANT
 * preview and the guaranteed fallback when the server transcript never lands
 * (offline, AI credits exhausted, poll timeout). The spoken structure must
 * survive; low-confidence markers must be one-tap resolvable.
 */
describe("ReviewSheet — on-device structure fallback (F12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const liveBlocks = [
    {
      id: "b0",
      marker: { atMs: 0, kind: "unlabeled" as const, source: "manual" as const, label: "Idea" },
      words: [{ text: "warming", startMs: 0, endMs: 400 }],
      text: "warming up",
    },
    {
      id: "b1",
      marker: {
        atMs: 1000,
        contentStartMs: 1600,
        kind: "chorus" as const,
        source: "voice" as const,
        label: "Chorus",
        confidence: 0.9,
      },
      words: [{ text: "you", startMs: 1600, endMs: 1800 }],
      text: "you are my rock",
    },
  ];

  function renderWithLive(extra: Record<string, unknown> = {}) {
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
          liveBlocks={liveBlocks}
          onClose={vi.fn()}
          onCommitted={vi.fn()}
          {...extra}
        />
      </MemoryRouter>,
    );
  }

  it("shows the spoken sections instantly and keeps them when the server never lands", async () => {
    renderWithLive();

    // The Chorus block from the on-device split is editable immediately —
    // label input + body textarea — with the announcement stripped.
    const label = await screen.findByDisplayValue("Chorus");
    expect(label).toBeTruthy();
    const body = await screen.findByDisplayValue("you are my rock");
    expect(body).toBeTruthy();
    // No empty manual fallback block was injected — the structure IS the content.
    expect(screen.queryByText(/Transcription couldn't finish/)).toBeNull();
  });

  it("commits the fallback structure with section kinds intact", async () => {
    renderWithLive();
    await screen.findByDisplayValue("Chorus");

    fireEvent.click(screen.getByRole("button", { name: "Add to song" }));

    await waitFor(() => expect(commitTakeToCanvas).toHaveBeenCalledTimes(1));
    const payload = (commitTakeToCanvas as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const chorus = payload.blocks.find((b: { label: string }) => b.label === "Chorus");
    expect(chorus).toMatchObject({
      kind: "lyrics",
      section_kind: "chorus",
      text: "you are my rock",
    });
  });

  it("flags a low-confidence marker and splits on one tap", async () => {
    renderWithLive({
      candidateMarkers: [
        {
          atMs: 3000,
          kind: "bridge",
          source: "voice",
          label: "Bridge",
          confidence: 0.3,
        },
      ],
    });

    // Flagged, not silently applied.
    expect(await screen.findByText(/split here\?/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Split here" }));

    // One tap → a Bridge block exists now, and the flag is resolved.
    await screen.findByDisplayValue("Bridge");
    expect(screen.queryByRole("button", { name: "Split here" })).toBeNull();
  });

  it("dismissing a flagged marker keeps the take unstructured at that moment", async () => {
    renderWithLive({
      candidateMarkers: [
        {
          atMs: 3000,
          kind: "bridge",
          source: "voice",
          label: "Bridge",
          confidence: 0.3,
        },
      ],
    });

    fireEvent.click(await screen.findByRole("button", { name: "It's a lyric" }));
    expect(screen.queryByRole("button", { name: "Split here" })).toBeNull();
    expect(screen.queryByDisplayValue("Bridge")).toBeNull();
  });

  // jsdom can't measure layout, so this locks the CLASS CONTRACT that yields the
  // ≥44px touch target — a regression to `p-1.5` (~26px) would fail here.
  it("gives every block control a 44px touch target", async () => {
    renderWithLive();
    await screen.findByDisplayValue("Chorus");
    for (const name of [
      "Move block up",
      "Move block down",
      "Delete block",
      "Split block at cursor",
    ]) {
      const btn = screen.getAllByRole("button", { name })[0];
      expect(btn.className).toContain("min-w-[44px]");
      expect(btn.className).toContain("min-h-[44px]");
    }
  });
});
