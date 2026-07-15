import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChordPicker from "./ChordPicker";

/**
 * F13 acceptance, at the surface where it lives:
 *  - silent fallback = today's manual prompt, byte-for-byte;
 *  - the confirm variant is pinned to WHAT WAS DETECTED (mode-toggle honest);
 *  - confirm/change/dismiss resolve the suggestion with the right verdict;
 *  - a user-set key is never replaced — the detection is a hint beside it.
 */

const detectedG94 = {
  keySignature: "G",
  tonic: "G",
  mode: "major" as const,
  bpm: 94,
  filledKey: true,
  filledBpm: true,
};

describe("ChordPicker — F13 confirm-or-change UX", () => {
  it("renders exactly the manual ask when there is no detection (silent fallback)", () => {
    render(<ChordPicker onSave={vi.fn()} />);
    expect(screen.getByText(/what key is this song in/i)).toBeInTheDocument();
    expect(screen.queryByText(/sounds like/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/detected from your recording/i)).not.toBeInTheDocument();
  });

  it("turns the blank ask into a pre-filled confirm, and one tap persists everything", () => {
    const onKeyChange = vi.fn();
    const onBpmChange = vi.fn();
    const onDetectedResolved = vi.fn();
    render(
      <ChordPicker
        detected={detectedG94}
        onKeyChange={onKeyChange}
        onBpmChange={onBpmChange}
        onDetectedResolved={onDetectedResolved}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/sounds like/i)).toBeInTheDocument();
    expect(screen.getByText(/detected from your recording/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /use g major · 94 bpm/i }));

    expect(onKeyChange).toHaveBeenLastCalledWith("G", "major");
    expect(onBpmChange).toHaveBeenLastCalledWith(94);
    expect(onDetectedResolved).toHaveBeenCalledWith(true);
    // The confirm hands off to the main picker.
    expect(screen.getByText("Progression")).toBeInTheDocument();
  });

  it("keeps the confirm line pinned to the DETECTED key when the mode toggle changes", () => {
    render(<ChordPicker detected={detectedG94} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^minor$/i }));
    // Still what the take sounded like — never silently rewritten to "G minor".
    expect(screen.getByRole("button", { name: /use g major · 94 bpm/i })).toBeInTheDocument();
  });

  it("resolves as NOT accepted when the songwriter picks a different key", () => {
    const onKeyChange = vi.fn();
    const onDetectedResolved = vi.fn();
    render(
      <ChordPicker
        detected={detectedG94}
        onKeyChange={onKeyChange}
        onDetectedResolved={onDetectedResolved}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^D$/ }));
    expect(onKeyChange).toHaveBeenLastCalledWith("D", "major");
    expect(onDetectedResolved).toHaveBeenCalledWith(false);
  });

  it("shows a dismissible hint BESIDE a user-set key instead of replacing it", () => {
    const onKeyChange = vi.fn();
    const onBpmChange = vi.fn();
    const onDetectedResolved = vi.fn();
    render(
      <ChordPicker
        initialKey="C"
        initialMode="major"
        initialBpm={120}
        detected={{
          keySignature: "Am",
          tonic: "A",
          mode: "minor",
          bpm: 88,
          filledKey: false,
          filledBpm: false,
        }}
        onKeyChange={onKeyChange}
        onBpmChange={onBpmChange}
        onDetectedResolved={onDetectedResolved}
        onSave={vi.fn()}
      />,
    );
    // Their key stands: the main picker is shown, C persisted on mount.
    expect(onKeyChange).toHaveBeenLastCalledWith("C", "major");
    expect(screen.getByText(/your take sounds like/i)).toBeInTheDocument();
    expect(screen.getByText(/a minor · 88 bpm/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /use it/i }));
    expect(onKeyChange).toHaveBeenLastCalledWith("A", "minor");
    expect(onBpmChange).toHaveBeenLastCalledWith(88);
    expect(onDetectedResolved).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/your take sounds like/i)).not.toBeInTheDocument();
  });

  it("dismissing the hint keeps the user's values untouched", () => {
    const onKeyChange = vi.fn();
    const onDetectedResolved = vi.fn();
    render(
      <ChordPicker
        initialKey="C"
        initialMode="major"
        detected={{
          keySignature: "Am",
          tonic: "A",
          mode: "minor",
          bpm: 88,
          filledKey: false,
          filledBpm: false,
        }}
        onKeyChange={onKeyChange}
        onDetectedResolved={onDetectedResolved}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /dismiss the detected key and tempo suggestion/i }),
    );
    expect(onDetectedResolved).toHaveBeenCalledWith(false);
    expect(onKeyChange).toHaveBeenLastCalledWith("C", "major"); // never became A minor
    expect(screen.queryByText(/your take sounds like/i)).not.toBeInTheDocument();
  });
});
