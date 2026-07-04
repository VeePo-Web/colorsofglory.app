import { useRef } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CoachMark from "@/components/onboarding/CoachMark";
import { TOUR_STEPS } from "@/lib/onboarding/tour";

// The visual/interaction half of the tour engine (the state machine is covered
// by onboarding-tour.test.ts). Verifies the coach mark renders its copy + dot
// rail, and that every dismissal path fires the right callback — including the
// "tap anywhere outside" rule that keeps the tour from ever trapping a user.

function Harness({ onGotIt = () => {}, onSkip = () => {} }: { onGotIt?: () => void; onSkip?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="anchor" style={{ width: 200, height: 40 }}>
        song list
      </div>
      <CoachMark
        targetRef={ref}
        lead="This is your song's room."
        body="Everything for it lives inside. Tap to enter."
        onGotIt={onGotIt}
        onSkip={onSkip}
      />
    </>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe("CoachMark", () => {
  it("renders the lead + body copy and the 5-dot progress rail", () => {
    render(<Harness />);
    expect(screen.getByText("This is your song's room.")).toBeInTheDocument();
    expect(screen.getByText(/Everything for it lives inside/)).toBeInTheDocument();
    // Dot rail is the tour's only gamification — sized to the live registry,
    // none seen yet. It must complete, so it tracks TOUR_STEPS, not a constant.
    expect(screen.getByLabelText(`Tip 1 of ${TOUR_STEPS.length}`)).toBeInTheDocument();
  });

  it("fires onGotIt from the Got it button", () => {
    const onGotIt = vi.fn();
    render(<Harness onGotIt={onGotIt} />);
    fireEvent.click(screen.getByText("Got it"));
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });

  it("fires onSkip from the Skip tour link", () => {
    const onSkip = vi.fn();
    render(<Harness onSkip={onSkip} />);
    fireEvent.click(screen.getByText("Skip tour"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("treats a tap anywhere outside as Got it (never traps the user)", () => {
    vi.useFakeTimers();
    const onGotIt = vi.fn();
    render(<Harness onGotIt={onGotIt} />);
    // The outside-dismiss listener attaches after a 150ms guard (so the arming
    // tap doesn't instantly close it). Nothing fires before then.
    fireEvent.pointerDown(screen.getByTestId("anchor"));
    expect(onGotIt).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerDown(screen.getByTestId("anchor"));
    expect(onGotIt).toHaveBeenCalledTimes(1);
  });

  it("does NOT dismiss when tapping inside the tooltip", () => {
    vi.useFakeTimers();
    const onGotIt = vi.fn();
    render(<Harness onGotIt={onGotIt} />);
    act(() => vi.advanceTimersByTime(200));
    // A pointer-down on the tooltip's own copy must not count as an outside tap.
    fireEvent.pointerDown(screen.getByText("This is your song's room."));
    expect(onGotIt).not.toHaveBeenCalled();
  });

  it("renders into a document.body portal, not the anchor's subtree", () => {
    const { getByTestId } = render(<Harness />);
    const anchor = getByTestId("anchor");
    // The tip must escape any clipped/overflow-hidden host container.
    expect(anchor.contains(screen.getByText("Got it"))).toBe(false);
  });
});
