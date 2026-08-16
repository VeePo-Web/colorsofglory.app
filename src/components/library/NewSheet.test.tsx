import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewSheet from "./NewSheet";

const setup = (over: Partial<React.ComponentProps<typeof NewSheet>> = {}) => {
  const props = {
    albumName: null as string | null,
    checkingSong: false,
    onSong: vi.fn(),
    onAlbum: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<NewSheet {...props} />);
  return props;
};

describe("NewSheet — the library's ONE door for making things", () => {
  it("always offers the same two rows: Song and Album, each with its teaching line", () => {
    setup();
    expect(screen.getByRole("button", { name: "Song — a room for one song" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Album — a folder of songs" })).toBeInTheDocument();
    // The Album row is where people DISCOVER what an album is (Drive's + New
    // menu teaches Folder) — the explainer must be visible, not aria-only.
    expect(screen.getByText("A folder of songs — an EP or a set")).toBeInTheDocument();
  });

  it("routes each row to its own flow", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /^Song/ }));
    expect(p.onSong).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /^Album/ }));
    expect(p.onAlbum).toHaveBeenCalledTimes(1);
  });

  it("inside an album, the Song row says the new song starts there (Drive's contextual create)", () => {
    setup({ albumName: "Worship EP" });
    expect(screen.getByRole("button", { name: "Song — starts in Worship EP" })).toBeInTheDocument();
    expect(screen.getByText("Starts in “Worship EP”")).toBeInTheDocument();
  });

  it("waits honestly while the free-tier gate check runs: Song disabled, never double-fired", () => {
    const p = setup({ checkingSong: true });
    const song = screen.getByRole("button", { name: /^Song/ });
    expect(song).toBeDisabled();
    fireEvent.click(song);
    expect(p.onSong).not.toHaveBeenCalled();
    expect(screen.getByText("One moment…")).toBeInTheDocument();
  });

  it("the backdrop closes it", () => {
    const p = setup();
    const backdrop = document.querySelector('[aria-hidden].fixed.inset-0');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(p.onClose).toHaveBeenCalledTimes(1);
  });
});
