import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RoomWelcome, { hasSeenRoomWelcome, markRoomWelcomeSeen } from "./RoomWelcome";

describe("RoomWelcome — the hallway, taught once per device", () => {
  beforeEach(() => localStorage.clear());

  it("names the room, teaches the one move, and the gold button dismisses + marks seen", () => {
    const onDismiss = vi.fn();
    render(<RoomWelcome songTitle="Grace in the Waiting" onDismiss={onDismiss} />);
    expect(screen.getByText(/grace in the waiting/i)).toBeInTheDocument();
    // The teaching sentence names the DESTINATION the tab shows ("Final") —
    // the old wording taught "the finished song" but the tab said Final, so
    // the one lesson pointed at a label that didn't exist.
    expect(screen.getByText(/swipe left for\s*final/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start writing/i }));
    expect(hasSeenRoomWelcome()).toBe(true);
    // Reduced-motion is off in jsdom's matchMedia mock? Either path must
    // eventually dismiss — the fade branch defers by ~260ms.
    return vi.waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it("tap ANYWHERE dismisses — an 8-year-old's first guess is the right one", () => {
    const onDismiss = vi.fn();
    render(<RoomWelcome songTitle="Hold On" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(hasSeenRoomWelcome()).toBe(true);
    return vi.waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it("Escape dismisses too", () => {
    const onDismiss = vi.fn();
    render(<RoomWelcome songTitle="Hold On" onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: "Escape" });
    return vi.waitFor(() => expect(onDismiss).toHaveBeenCalled());
  });

  it("seen means seen: the helper flips exactly once and stays", () => {
    expect(hasSeenRoomWelcome()).toBe(false);
    markRoomWelcomeSeen();
    expect(hasSeenRoomWelcome()).toBe(true);
  });
});
