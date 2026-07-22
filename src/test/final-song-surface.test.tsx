import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FinalSongSurface from "@/components/canvas/FinalSongSurface";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

const card = (overrides: Partial<CanvasBoardCard>): CanvasBoardCard => ({
  id: "final-1",
  tree: "final",
  type: "lyric",
  title: "Verse idea",
  body: "Morning breaks with mercy",
  meta: "Edited today",
  section: "Verse 1",
  contributor: "Parker",
  status: "approved",
  accent: "#B8953A",
  x: 880,
  y: 240,
  ...overrides,
});

const handlers = () => ({
  onBeginArrange: vi.fn(),
  onMove: vi.fn(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onPlayAll: vi.fn(),
  onPlaySection: vi.fn(),
  onOpenSongSheet: vi.fn(),
});

describe("FinalSongSurface", () => {
  it("turns an empty Final view into a clear, calm next step", () => {
    const actions = handlers();
    render(
      <FinalSongSurface
        songTitle="New Mercy"
        cards={[]}
        arranging={false}
        canArrange={false}
        {...actions}
      />,
    );

    expect(screen.getByRole("heading", { name: "New Mercy" })).toBeInTheDocument();
    expect(screen.getByText("Your keepers will gather here")).toBeInTheDocument();
    expect(screen.getByText(/In Ideas, choose the fragments/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play from top" })).not.toBeInTheDocument();
  });

  it("makes the final song readable and directly playable", () => {
    const actions = handlers();
    const cards = [
      card({ id: "v1" }),
      card({ id: "c1", section: "Chorus", title: "Chorus idea", body: "Glory is rising", y: 520 }),
    ];
    render(
      <FinalSongSurface
        songTitle="New Mercy"
        cards={cards}
        arranging={false}
        canArrange
        {...actions}
      />,
    );

    expect(screen.getByRole("list", { name: "Final song running order" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Verse 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chorus" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play from top" }));
    fireEvent.click(screen.getByRole("button", { name: "Play Verse 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    fireEvent.click(screen.getByRole("button", { name: "Song sheet" }));

    expect(actions.onPlayAll).toHaveBeenCalledOnce();
    expect(actions.onPlaySection).toHaveBeenCalledWith("v1");
    expect(actions.onBeginArrange).toHaveBeenCalledOnce();
    expect(actions.onOpenSongSheet).toHaveBeenCalledOnce();
  });

  it("offers accessible ordering controls with save and cancel", () => {
    const actions = handlers();
    const cards = [
      card({ id: "v1" }),
      card({ id: "c1", section: "Chorus", y: 520 }),
    ];
    render(
      <FinalSongSurface
        songTitle="New Mercy"
        cards={cards}
        arranging
        canArrange
        {...actions}
      />,
    );

    expect(screen.getByRole("toolbar", { name: "Edit final song running order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Verse 1 earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Chorus later" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move Verse 1 later" }));
    fireEvent.click(screen.getByRole("button", { name: "Save order" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(actions.onMove).toHaveBeenCalledWith("v1", 1);
    expect(actions.onSave).toHaveBeenCalledOnce();
    expect(actions.onCancel).toHaveBeenCalledOnce();
  });
});
