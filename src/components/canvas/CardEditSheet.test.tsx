import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardEditSheet from "./CardEditSheet";

const base = {
  initial: { title: "Old title", body: "line one", section: "Verse" },
  kind: "Lyric",
  accent: "#B8953A",
} as const;

/**
 * CardEditSheet is a real modal. Via the shared focus-trap hook it's now
 * keyboard-safe — AND its "nothing is ever lost" contract must survive: a stray
 * Escape SAVES a changed draft rather than discarding a just-composed lyric.
 */
describe("CardEditSheet — keyboard-safe, Escape never discards", () => {
  it("renders the edit dialog", () => {
    render(<CardEditSheet {...base} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: /edit idea/i })).toBeInTheDocument();
  });

  it("routes Escape through save-on-dismiss: an edited draft is SAVED, then closes", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<CardEditSheet {...base} onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByDisplayValue("Old title"), { target: { value: "New title" } });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "New title" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape with no change closes without a spurious save", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<CardEditSheet {...base} onSave={onSave} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
