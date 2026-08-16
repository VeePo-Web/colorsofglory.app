import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedCard from "./FeedCard";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { CanvasCardInteractions } from "@/components/canvas/CanvasCard";

/**
 * Pins the hallway's "state at rest, verbs on selection" contract (Hallway
 * ledger H7): a resting voice card tells its state quietly; the layering verb
 * waits in the selected action row. Six memos at rest must never mean six
 * standing CTAs.
 */

const card = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "voice", tree: "ideas", title: "Take 3", body: "", section: "",
  x: 0, y: 0, contributor: "Sarah", meta: "0:42",
} as CanvasBoardCard;

const interactions = (over: Partial<CanvasCardInteractions> = {}): CanvasCardInteractions =>
  ({
    onSelect: vi.fn(),
    onPlay: vi.fn(),
    onMoveToFinal: vi.fn(),
    onMoveToIdeas: vi.fn(),
    onRecordOver: vi.fn(),
    onOpenStack: vi.fn(),
    layerCount: 0,
    ...over,
  }) as CanvasCardInteractions;

describe("FeedCard — state at rest, verbs on selection", () => {
  it("a resting voice card shows NO layering verb — only the quiet state chip when layers exist", () => {
    render(<FeedCard card={card} selected={false} interactions={interactions({ layerCount: 2 })} />);
    expect(screen.queryByRole("button", { name: /sing over this/i })).toBeNull();
    expect(screen.getByLabelText(/2 layers on this take/i)).toBeInTheDocument();
  });

  it("selection reveals the layering verb and the stack door", () => {
    const ix = interactions({ layerCount: 2 });
    render(<FeedCard card={card} selected interactions={ix} />);
    fireEvent.click(screen.getByRole("button", { name: /sing over this/i }));
    expect(ix.onRecordOver).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /open the stack — 2 layers/i }));
    expect(ix.onOpenStack).toHaveBeenCalledTimes(1);
  });

  it("a bare memo (no layers) selected offers the layer verb but no stack door", () => {
    render(<FeedCard card={card} selected interactions={interactions({ layerCount: 0 })} />);
    expect(screen.getByRole("button", { name: /sing over this/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open the stack/i })).toBeNull();
  });

  it("tapping the layer verb never doubles as a card select", () => {
    const ix = interactions({ layerCount: 0 });
    render(<FeedCard card={card} selected interactions={ix} />);
    fireEvent.click(screen.getByRole("button", { name: /sing over this/i }));
    expect(ix.onRecordOver).toHaveBeenCalledTimes(1);
    expect(ix.onSelect).not.toHaveBeenCalled();
  });

  it("non-audio cards and view-only rooms (no onRecordOver granted) show no layer verb, even selected", () => {
    const viewerIx = interactions({ onRecordOver: undefined, layerCount: 0 });
    render(<FeedCard card={card} selected interactions={viewerIx} />);
    expect(screen.queryByRole("button", { name: /sing over this/i })).toBeNull();

    const chord = { ...card, id: "22222222-2222-4222-8222-222222222222", type: "chord" } as CanvasBoardCard;
    render(<FeedCard card={chord} selected interactions={interactions()} />);
    expect(screen.queryByRole("button", { name: /sing over this/i })).toBeNull();
  });
});
