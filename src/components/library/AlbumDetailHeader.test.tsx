import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AlbumDetailHeader from "./AlbumDetailHeader";
import type { SongAlbum } from "@/lib/library/albums";

const album: SongAlbum = {
  id: "a1",
  name: "Worship EP",
  songIds: [],
  createdAt: "2026-08-01T00:00:00Z",
  color: "sage",
};

const setup = (over: Partial<React.ComponentProps<typeof AlbumDetailHeader>> = {}) => {
  const props = {
    album,
    songs: [],
    onExit: vi.fn(),
    onEdit: vi.fn(),
    onAddSongs: vi.fn(),
    onRename: vi.fn(),
    ...over,
  };
  render(<AlbumDetailHeader {...props} />);
  return props;
};

describe("AlbumDetailHeader — the breadcrumb and the name that lives here (C4)", () => {
  it("reads as a true breadcrumb: All songs / Worship EP, with the root one tap from home", () => {
    const p = setup();
    const crumbs = screen.getByRole("navigation", { name: "Where you are" });
    expect(crumbs).toHaveTextContent("All songs/Worship EP");
    fireEvent.click(screen.getByRole("button", { name: "Back to all songs" }));
    expect(p.onExit).toHaveBeenCalledTimes(1);
  });

  it("renames where the name lives: tap the title → same-size input → Enter keeps it", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /tap to rename/ }));
    const input = screen.getByRole("textbox", { name: "Album name" });
    fireEvent.change(input, { target: { value: "Advent Set" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onRename).toHaveBeenCalledWith("Advent Set");
  });

  it("Escape lets the edit go; an emptied name quietly keeps the old one", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /tap to rename/ }));
    let input = screen.getByRole("textbox", { name: "Album name" });
    fireEvent.change(input, { target: { value: "half-typed" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(p.onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("navigation", { name: "Where you are" })).toHaveTextContent("Worship EP");

    fireEvent.click(screen.getByRole("button", { name: /tap to rename/ }));
    input = screen.getByRole("textbox", { name: "Album name" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(p.onRename).not.toHaveBeenCalled();
  });

  it("without onRename the title is plain — no dead rename affordance", () => {
    setup({ onRename: undefined });
    expect(screen.queryByRole("button", { name: /tap to rename/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Worship EP" })).toBeInTheDocument();
  });
});
