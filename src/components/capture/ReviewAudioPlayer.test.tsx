import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewAudioPlayer from "./ReviewAudioPlayer";

// Polish attach is Web-Audio-only and irrelevant to this a11y test.
vi.mock("@/lib/audio/enhance", () => ({ polishAttach: vi.fn() }));

/**
 * The transport must be meaningful to a screen reader. A bare range input
 * announces raw seconds ("108"); aria-valuetext turns the position into
 * "1:48 of 3:00" so a blind songwriter can scrub with confidence.
 */
describe("ReviewAudioPlayer — accessible seek", () => {
  it("exposes the position as time, not raw seconds", () => {
    render(<ReviewAudioPlayer src="blob:take" durationMs={180000} />);
    const seek = screen.getByRole("slider", { name: /seek/i });
    // current = 0, duration = 180s → "0:00 of 3:00".
    expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 3:00");
  });
});
