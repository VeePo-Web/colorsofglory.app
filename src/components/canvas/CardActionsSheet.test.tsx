import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CardActionsSheet, { type CardAction } from "./CardActionsSheet";

/**
 * The card overflow sheet is a real modal (aria-modal). For a songwriter picking
 * a card action by keyboard / screen reader it must behave like one: focus moves
 * INTO the sheet on open, and Escape closes it (focus returns to the card).
 */
describe("CardActionsSheet — the card action sheet is keyboard-safe", () => {
  const actions: CardAction[] = [
    { id: "weave", label: "Weave lines into this section", onClick: vi.fn() },
    { id: "path", label: "Add to Listen Path", onClick: vi.fn() },
  ];

  const open = (onClose = vi.fn()) => {
    render(<CardActionsSheet title="Verse 1" subtitle="Verse" actions={actions} onClose={onClose} />);
    return { dialog: screen.getByRole("dialog", { name: /actions for verse 1/i }), onClose };
  };

  it("moves focus into the sheet on open", async () => {
    const { dialog } = open();
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("closes on Escape", async () => {
    const { onClose } = open();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("runs an action and then closes", () => {
    const onClose = vi.fn();
    render(<CardActionsSheet title="Verse 1" actions={actions} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /add to listen path/i }));
    expect(actions[1].onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
