import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// "Your people" is the band lever: one tap adds a known co-writer, "Add
// everyone" adds the lot, every add is undoable, partial failure is honest.

const addMember = vi.fn();
const removeMember = vi.fn();
let knownPeople: Array<{
  userId: string; name: string; firstName: string;
  avatarColor: string; initials: string; songCount: number;
}>;

vi.mock("@/integrations/cog/members", () => ({
  addMember: (songId: string, userId: string) => addMember(songId, userId),
  removeMember: (songId: string, userId: string) => removeMember(songId, userId),
}));

vi.mock("@/lib/invite/useKnownPeople", () => ({
  useKnownPeople: () => ({ people: knownPeople, loading: false }),
}));

import AddYourPeople from "./AddYourPeople";

const person = (userId: string, firstName: string, songCount = 2) => ({
  userId,
  name: `${firstName} Levine`,
  firstName,
  avatarColor: "#C26A95",
  initials: firstName.slice(0, 2).toUpperCase(),
  songCount,
});

describe("AddYourPeople — the band, one tap each", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addMember.mockResolvedValue(undefined);
    removeMember.mockResolvedValue(undefined);
    knownPeople = [person("u-sarah", "Sarah"), person("u-caleb", "Caleb")];
  });

  it("adds one person on tap and flips their button to In", async () => {
    render(<AddYourPeople songId="s1" songTitle="Grace" myUserId="me" />);
    fireEvent.click(screen.getByRole("button", { name: /add sarah to this song/i }));
    await waitFor(() => expect(addMember).toHaveBeenCalledWith("s1", "u-sarah"));
    expect(await screen.findByRole("button", { name: /sarah is in this song/i })).toBeDisabled();
  });

  it("'Add everyone' appears at 2+ people and adds them all", async () => {
    render(<AddYourPeople songId="s1" songTitle="Grace" myUserId="me" />);
    fireEvent.click(screen.getByRole("button", { name: /add all 2 of your people/i }));
    await waitFor(() => expect(addMember).toHaveBeenCalledTimes(2));
    expect(addMember).toHaveBeenCalledWith("s1", "u-sarah");
    expect(addMember).toHaveBeenCalledWith("s1", "u-caleb");
    // Everyone's in — the bulk lever leaves (nothing remaining).
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /add all/i })).toBeNull());
  });

  it("hides 'Add everyone' for a single person (one row is already one tap)", () => {
    knownPeople = [person("u-sarah", "Sarah")];
    render(<AddYourPeople songId="s1" songTitle="Grace" myUserId="me" />);
    expect(screen.queryByRole("button", { name: /add all/i })).toBeNull();
    expect(screen.getByRole("button", { name: /add sarah/i })).toBeInTheDocument();
  });

  it("a failed add stays honest: the button returns to Add, nothing pretends", async () => {
    addMember.mockRejectedValueOnce(new Error("offline"));
    render(<AddYourPeople songId="s1" songTitle="Grace" myUserId="me" />);
    fireEvent.click(screen.getByRole("button", { name: /add sarah to this song/i }));
    await waitFor(() => expect(addMember).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /add sarah to this song/i })).not.toBeDisabled();
  });

  it("renders nothing when there is no one to add", () => {
    knownPeople = [];
    const { container } = render(<AddYourPeople songId="s1" songTitle="Grace" myUserId="me" />);
    expect(container.firstChild).toBeNull();
  });
});
