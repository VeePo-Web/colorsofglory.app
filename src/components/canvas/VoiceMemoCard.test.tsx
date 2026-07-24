import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VoiceMemoCard from "./VoiceMemoCard";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { TYPE_TONE } from "@/lib/canvas/glorySpectrum";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

const card = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "voice", tree: "ideas", title: "Take 3", body: "", section: "",
  x: 0, y: 0, contributor: "Sarah", meta: "0:42",
} as CanvasBoardCard;

const base = { card, color: getCreatorColor("Sarah"), tone: TYPE_TONE.voice, selected: false };

describe("VoiceMemoCard — one-tap audition play", () => {
  it("shows a Play control when playable and fires onPlay on tap", () => {
    const onPlay = vi.fn();
    render(<VoiceMemoCard {...base} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button", { name: /play this take/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("becomes Pause while the take is sounding", () => {
    render(<VoiceMemoCard {...base} playing onPlay={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /pause/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders no play control when the card has no backing audio (onPlay absent)", () => {
    render(<VoiceMemoCard {...base} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
