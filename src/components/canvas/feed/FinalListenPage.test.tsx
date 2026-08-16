import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";
import FinalListenPage from "./FinalListenPage";

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({
    id: "x", type: "lyric", tree: "final", title: "", body: "", section: "", x: 0, y: 0,
    contributor: "Me", ...over,
  } as CanvasBoardCard);

const CARDS = [
  card({ id: "v1", section: "Verse 1", body: "Grace like rain\nfalls on me" }),
  card({ id: "ch", section: "Chorus", body: "Hallelujah, all my chains are gone" }),
  card({ id: "v2", section: "Verse 2", body: "" }),
];

const interactions = (): CanvasCardInteractions => ({
  onSelect: vi.fn(),
  onMoveToFinal: vi.fn(),
  onMoveToIdeas: vi.fn(),
  onMove: vi.fn(),
});

const setup = (over: Partial<React.ComponentProps<typeof FinalListenPage>> = {}) => {
  const props = {
    cards: CARDS,
    selectedId: null,
    getInteractions: () => interactions(),
    listening: false,
    currentId: null,
    finished: false,
    paused: false,
    onPlaySong: vi.fn(),
    onPlayPause: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onReorder: vi.fn(),
    isViewer: false,
    onGoToIdeas: vi.fn(),
    ...over,
  };
  render(<FinalListenPage {...props} />);
  return props;
};

describe("FinalListenPage — the song as a performance", () => {
  it("tapping any part plays FROM there to the end", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /part 2: chorus.*tap to play from here/i }));
    expect(p.onPlaySong).toHaveBeenCalledWith(["ch", "v2"]);
  });

  it("tapping the sounding part pauses instead of restarting", () => {
    const p = setup({ listening: true, currentId: "ch" });
    fireEvent.click(screen.getByRole("button", { name: /part 2: chorus.*tap to pause/i }));
    expect(p.onPlayPause).toHaveBeenCalledTimes(1);
    expect(p.onPlaySong).not.toHaveBeenCalled();
  });

  it("read-along: the sounding part opens its full words; resting parts keep one line", () => {
    setup({ listening: true, currentId: "v1" });
    // Full multi-line body visible for the sounding lyric part…
    expect(screen.getByText(/grace like rain\s*falls on me/i)).toBeInTheDocument();
    // …while the resting chorus stays a one-line preview.
    expect(screen.getByText("Hallelujah, all my chains are gone")).toBeInTheDocument();
  });

  it("the finished moment offers the two natural next things", () => {
    const p = setup({ finished: true });
    expect(screen.getByText(/that.s the whole song/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /play the song again/i }));
    expect(p.onPlaySong).toHaveBeenCalledWith(["v1", "ch", "v2"]);
    fireEvent.click(screen.getByRole("button", { name: /back to ideas/i }));
    expect(p.onGoToIdeas).toHaveBeenCalledTimes(1);
  });

  it("the finished moment never shows while the song is still sounding", () => {
    setup({ finished: true, listening: true, currentId: "v1" });
    expect(screen.queryByText(/that.s the whole song/i)).toBeNull();
  });

  it("the finished moment opens the door when the host says the writer is alone (GOLDEN-PATH E2 ⇢ F1)", () => {
    const onInvite = vi.fn();
    setup({ finished: true, onInvite });
    fireEvent.click(screen.getByRole("button", { name: /invite someone to hear it/i }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it("the invite line stays absent when the host withholds it (co-writers present, or a viewer)", () => {
    setup({ finished: true });
    expect(screen.queryByRole("button", { name: /invite someone to hear it/i })).toBeNull();
  });

  it("while finished, the finished card owns the ONE gold play — the header yields", () => {
    setup({ finished: true });
    expect(screen.queryByRole("button", { name: /play the whole song/i })).toBeNull();
    expect(screen.getByRole("button", { name: /play the song again/i })).toBeInTheDocument();
  });

  it("paused mid-song keeps the transport up: Resume is one tap, the row stays lit", () => {
    const p = setup({ paused: true, currentId: "v1" });
    // The resting "Play the song" (which would RESTART) is replaced by Resume.
    expect(screen.queryByRole("button", { name: /play the whole song/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /resume the song/i }));
    expect(p.onPlayPause).toHaveBeenCalledTimes(1);
    // The paused row still narrates its held place.
    expect(screen.getByRole("button", { name: /part 1: verse 1.*paused here — tap to resume/i })).toBeInTheDocument();
  });
});
