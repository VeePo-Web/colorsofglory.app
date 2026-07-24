import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MetronomeBar from "./MetronomeBar";

/**
 * The reported friction: tapping "Tap tempo" made the button slide sideways the
 * instant a BPM landed (the ± stepper popped in and re-centered the row), so the
 * next taps missed. The fix reserves the stepper's space and keeps every control
 * a constant width — the tempo controls never move under the thumb.
 */
describe("MetronomeBar — the tempo controls never move under the thumb", () => {
  const props = {
    clickOn: false,
    onBpmChange: vi.fn(),
    onClickToggle: vi.fn(),
  };

  it("keeps the ± stepper in the layout even before a tempo exists", () => {
    // Present in the DOM (reserving width) though aria-hidden until usable — this
    // is exactly what stops the row re-centering when the first BPM lands.
    const { container } = render(<MetronomeBar bpm={null} {...props} />);
    expect(container.querySelector('[aria-label="Decrease BPM"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Increase BPM"]')).not.toBeNull();
  });

  it("labels the tap button 'Tap tempo' with or without a tempo (constant width)", () => {
    const { rerender } = render(<MetronomeBar bpm={null} {...props} />);
    expect(screen.getByText("Tap tempo")).toBeInTheDocument();
    rerender(<MetronomeBar bpm={92} {...props} />);
    expect(screen.getByText("Tap tempo")).toBeInTheDocument();
    // The BPM shows in the stepper, the single source of the number.
    expect(screen.getByText("92")).toBeInTheDocument();
  });

  it("fine-tunes the BPM from the stepper once a tempo exists", () => {
    const onBpmChange = vi.fn();
    render(<MetronomeBar bpm={90} clickOn={false} onBpmChange={onBpmChange} onClickToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /increase bpm/i }));
    expect(onBpmChange).toHaveBeenCalledWith(91);
  });

  it("reserves the count-in width so toggling on/off never resizes it", () => {
    const { rerender } = render(<MetronomeBar bpm={90} {...props} />);
    expect(screen.getByRole("switch").style.minWidth).toBe("112px");
    rerender(<MetronomeBar bpm={90} clickOn onBpmChange={vi.fn()} onClickToggle={vi.fn()} />);
    expect(screen.getByRole("switch").style.minWidth).toBe("112px");
    expect(screen.getByText("Count-in on")).toBeInTheDocument();
  });
});
