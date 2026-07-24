import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AmenChip from "./AmenChip";
import type { AmenSummary } from "@/lib/canvas/collab/amens";

const summary = (over: Partial<AmenSummary> = {}): AmenSummary => ({
  count: 1,
  mine: new Set(),
  contributors: [{ id: "u1", name: "Sarah", color: "#C94F4F" }],
  latestAt: "2026-07-24T00:00:00.000Z",
  ...over,
});

describe("AmenChip — intuitive, one-tap affirmation that always registers", () => {
  it("a selected card: one tap says amen", () => {
    const onToggle = vi.fn();
    render(<AmenChip summary={null} selected cardTitle="Chorus" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /say amen to chorus/i }));
    expect(onToggle).toHaveBeenCalledWith("amen");
  });

  it("heart and keeper each toggle their own kind", () => {
    const onToggle = vi.fn();
    render(<AmenChip summary={null} selected cardTitle="Chorus" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /send a heart to chorus/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark chorus as a keeper/i }));
    expect(onToggle).toHaveBeenNthCalledWith(1, "heart");
    expect(onToggle).toHaveBeenNthCalledWith(2, "keeper");
  });

  it("my own amen reads as pressed, with a plain-language withdraw label", () => {
    render(
      <AmenChip summary={summary({ mine: new Set(["amen"]) })} selected cardTitle="Chorus" onToggle={vi.fn()} />,
    );
    const btn = screen.getByRole("button", { name: /remove your amen from chorus/i });
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("an unselected card shows WHO affirmed as a calm, NON-interactive cluster (no mis-tap target on the pan canvas)", () => {
    render(
      <AmenChip
        summary={summary({ count: 2 })}
        selected={false}
        cardTitle="Chorus"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("img", { name: /said amen/i })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("an unselected card with no amens renders nothing", () => {
    const { container } = render(
      <AmenChip summary={null} selected={false} cardTitle="Chorus" onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
