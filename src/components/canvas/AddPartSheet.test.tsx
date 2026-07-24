import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddPartSheet from "./AddPartSheet";

/**
 * AddPartSheet is a real modal (aria-modal). Via the shared focus-trap hook it
 * must move focus into the sheet on open and close on Escape — and still create
 * the part the songwriter taps.
 */
describe("AddPartSheet — keyboard-safe modal that still adds a part", () => {
  it("moves focus into the sheet on open", async () => {
    render(<AddPartSheet onPick={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: /add a part to the song/i });
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<AddPartSheet onPick={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("picks a Verse part", () => {
    const onPick = vi.fn();
    render(<AddPartSheet onPick={onPick} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^verse$/i }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ section: "Verse", type: "lyric" }));
  });
});
