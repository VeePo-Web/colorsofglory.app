import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";
import FeedCard from "./FeedCard";

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({
    id: "x", type: "voice", tree: "ideas", title: "Morning hum", body: "", section: "",
    contributor: "Me", x: 0, y: 0, ...over,
  } as CanvasBoardCard);

const interactions = (over: Partial<CanvasCardInteractions> = {}): CanvasCardInteractions => ({
  onSelect: vi.fn(),
  onMoveToFinal: vi.fn(),
  onMoveToIdeas: vi.fn(),
  onMove: vi.fn(),
  ...over,
});

describe("FeedCard — one-tap layering on audio cards", () => {
  it("a voice card carries the always-visible 'Layer over this' button", () => {
    const ix = interactions({ onRecordOver: vi.fn() });
    render(<FeedCard card={card({})} selected={false} interactions={ix} />);
    const btn = screen.getByRole("button", { name: /record a layer over this take/i });
    fireEvent.click(btn);
    expect(ix.onRecordOver).toHaveBeenCalledTimes(1);
    // Tapping the layer button never doubles as a card select.
    expect(ix.onSelect).not.toHaveBeenCalled();
  });

  it("non-audio cards and view-only rooms show no layer button", () => {
    const ix = interactions(); // no onRecordOver granted (viewer / non-audio)
    render(<FeedCard card={card({ type: "chord", title: "Chorus chords" })} selected={false} interactions={ix} />);
    expect(screen.queryByRole("button", { name: /record a layer/i })).toBeNull();
  });
});
