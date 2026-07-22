import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CaptureSheet from "./CaptureSheet";

/**
 * The rail capture sheet only ever opens BEFORE a take exists (rail taps during
 * a recording drop timestamped pins directly, never this modal). So its primary
 * action must not promise a "take" that isn't there yet — it reads "Keep this",
 * and the save toast (owned by the scene) explains it waits for the next take.
 */
describe("CaptureSheet — honest pre-take copy + save gating", () => {
  it("labels the primary action 'Keep this', never the old 'Save to take'", () => {
    render(
      <CaptureSheet open action="lyrics" onClose={vi.fn()} onSave={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /keep this/i })).toBeInTheDocument();
    expect(screen.queryByText(/save to take/i)).not.toBeInTheDocument();
  });

  it("keeps the primary action disabled until a lyric is typed, then saves the exact text", () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet open action="lyrics" onClose={vi.fn()} onSave={onSave} />,
    );
    const save = screen.getByRole("button", { name: /keep this/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  We were dead in our sin  " },
    });
    expect(save).toBeEnabled();

    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    const block = onSave.mock.calls[0][0];
    // Text preserved verbatim (trimmed at the edges only), no take binding yet.
    expect(block).toMatchObject({
      kind: "lyrics",
      label: "Lyrics",
      text: "We were dead in our sin",
      start_ms: null,
      end_ms: null,
    });
  });

  it("lets a section be kept with no text (the label carries it)", () => {
    const onSave = vi.fn();
    render(
      <CaptureSheet open action="section" onClose={vi.fn()} onSave={onSave} />,
    );
    const save = screen.getByRole("button", { name: /keep this/i });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ kind: "section", start_ms: null });
  });
});
