import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DedicationOffer, { dedicationOfferSeen } from "./DedicationOffer";
import DedicationLine from "@/components/cog/DedicationLine";
import { __resetDedicationsForTests, resolveDedication } from "@/lib/songs/dedication";

const setMock = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/cog/songs", () => ({
  setSongDedication: setMock,
}));

/**
 * The four hard requirements, at the surfaces where they live:
 * offered once (marker) · skip is weightless (no save, no re-ask) ·
 * the header line is the always-open edit door · invisible when empty.
 */
describe("DedicationOffer — once, gentle, never blocks", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetDedicationsForTests();
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
  });

  it("asks warmly, marks itself seen immediately, and never re-offers", () => {
    render(<DedicationOffer songId="s1" songTitle="Morning Mercy" onDone={vi.fn()} />);
    expect(screen.getByText(/who is this song for\?/i)).toBeInTheDocument();
    // The once-marker lands on mount — a reload or return trip can't re-prompt.
    expect(dedicationOfferSeen("s1")).toBe(true);
  });

  it("saves in one tap and resolves the moment", () => {
    const onDone = vi.fn();
    render(<DedicationOffer songId="s2" songTitle="Morning Mercy" onDone={onDone} />);
    fireEvent.change(screen.getByLabelText(/song dedication/i), {
      target: { value: "the youth night" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(resolveDedication("s2")).toBe("the youth night");
    expect(onDone).toHaveBeenCalled();
  });

  it("skip is weightless — nothing saved, no empty state left behind", () => {
    const onDone = vi.fn();
    render(<DedicationOffer songId="s3" songTitle="Morning Mercy" onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onDone).toHaveBeenCalled();
    expect(resolveDedication("s3")).toBeNull();
  });

  it("Save stays disabled until there are real words (no empty dedications)", () => {
    render(<DedicationOffer songId="s4" songTitle="Morning Mercy" onDone={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
  });
});

describe("DedicationLine — the quiet header line", () => {
  beforeEach(() => {
    localStorage.clear();
    __resetDedicationsForTests();
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
  });

  it("is genuinely invisible when empty (no placeholder, no add label by default)", () => {
    const { container } = render(<DedicationLine songId="s5" serverValue={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the barely-there add affordance only where invited, and edits in place", () => {
    render(<DedicationLine songId="s6" serverValue={null} canEdit showAddWhenEmpty />);
    fireEvent.click(screen.getByRole("button", { name: /add a dedication/i }));
    const input = screen.getByLabelText(/song dedication/i);
    fireEvent.change(input, { target: { value: "the retreat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/for the retreat/i)).toBeInTheDocument();
    expect(resolveDedication("s6")).toBe("the retreat");
  });

  it("renders a set dedication as muted prose, and clearing returns to invisible", () => {
    render(<DedicationLine songId="s7" serverValue="the youth night" canEdit showAddWhenEmpty />);
    const line = screen.getByRole("button", { name: /for the youth night/i });
    fireEvent.click(line);
    const input = screen.getByLabelText(/song dedication/i);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(resolveDedication("s7")).toBeNull();
    // Back to the low-emphasis add affordance (this surface opted in).
    expect(screen.getByRole("button", { name: /add a dedication/i })).toBeInTheDocument();
  });

  it("viewers read but never edit", () => {
    render(<DedicationLine songId="s8" serverValue="the youth night" canEdit={false} />);
    expect(screen.getByText(/for the youth night/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
