import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GuidedShapeRail from "./GuidedShapeRail";

const setup = (over: Partial<React.ComponentProps<typeof GuidedShapeRail>> = {}) => {
  const props = {
    songTitle: "Grace in the Waiting",
    canCommit: true,
    onAddLyrics: vi.fn(),
    onSetSection: vi.fn(),
    onAddChords: vi.fn(),
    onCommit: vi.fn(),
    onKeepLoose: vi.fn(),
    onDismiss: vi.fn(),
    ...over,
  };
  render(<GuidedShapeRail {...props} />);
  return props;
};

describe("GuidedShapeRail — the guided path from a fresh idea to its home", () => {
  it("step 1 asks for the words; adding fires onAddLyrics and advances", () => {
    const p = setup();
    expect(screen.getByText(/what words go with it/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/lyrics for this idea/i), {
      target: { value: "Grace like rain" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add lyrics/i }));
    expect(p.onAddLyrics).toHaveBeenCalledWith("Grace like rain");
    expect(screen.getByText(/2 of 4/)).toBeInTheDocument();
  });

  it("every step skips in one tap without firing anything", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i })); // words
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i })); // part
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i })); // chords
    expect(p.onAddLyrics).not.toHaveBeenCalled();
    expect(p.onSetSection).not.toHaveBeenCalled();
    expect(p.onAddChords).not.toHaveBeenCalled();
    expect(screen.getByText(/where should this idea live/i)).toBeInTheDocument();
  });

  it("a section chip commits in one tap and advances", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^chorus$/i }));
    expect(p.onSetSection).toHaveBeenCalledWith("chorus", "Chorus");
    expect(screen.getByText(/3 of 4/)).toBeInTheDocument();
  });

  it("Back returns to the previous step", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(screen.getByText(/2 of 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to the previous step/i }));
    expect(screen.getByText(/1 of 4/)).toBeInTheDocument();
  });

  it("the last card: Add to the song commits; Keep it loose keeps it loose", () => {
    const p = setup();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    fireEvent.click(screen.getByRole("button", { name: /add to grace in the waiting/i }));
    expect(p.onCommit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /keep it loose/i }));
    expect(p.onKeepLoose).toHaveBeenCalledTimes(1);
  });

  it("without a song attached, the last card offers only the loose home", () => {
    setup({ canCommit: false });
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    expect(screen.queryByRole("button", { name: /add to/i })).toBeNull();
    expect(screen.getByRole("button", { name: /keep it loose/i })).toBeInTheDocument();
  });

  it("dismiss closes the guide — a path, never a cage", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /close the guide/i }));
    expect(p.onDismiss).toHaveBeenCalledTimes(1);
  });
});
