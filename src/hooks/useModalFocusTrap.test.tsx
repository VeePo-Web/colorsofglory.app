import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useModalFocusTrap } from "./useModalFocusTrap";

function Harness({ onClose, autofocusInput = false }: { onClose: () => void; autofocusInput?: boolean }) {
  const ref = useModalFocusTrap(onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog" tabIndex={-1}>
      {autofocusInput && <input autoFocus aria-label="field" />}
      <button>First</button>
      <button>Last</button>
    </div>
  );
}

describe("useModalFocusTrap", () => {
  it("moves focus into the dialog on open", async () => {
    render(<Harness onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(dialog));
  });

  it("does NOT steal focus from an autofocused field inside the dialog", async () => {
    render(<Harness onClose={vi.fn()} autofocusInput />);
    const field = screen.getByLabelText("field");
    // The field keeps the caret; the trap only fills a vacuum.
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("wraps Tab from the last focusable back to the first", () => {
    render(<Harness onClose={vi.fn()} />);
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
  });
});
