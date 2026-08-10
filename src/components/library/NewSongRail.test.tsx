import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NewSongRail from "./NewSongRail";

const setup = (over: Partial<React.ComponentProps<typeof NewSongRail>> = {}) => {
  const props = {
    open: true,
    albumName: null,
    creating: false,
    onCreate: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<NewSongRail {...props} />);
  return props;
};

describe("NewSongRail — starting a song in the rail grammar", () => {
  it("name → who is it for? → create carries both", () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText(/song name/i), { target: { value: "Grace in the Waiting" } });
    fireEvent.click(screen.getByRole("button", { name: /name it/i }));
    expect(screen.getByText(/2 of 2/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/who this song is for/i), { target: { value: "for the youth night" } });
    fireEvent.click(screen.getByRole("button", { name: /start .grace in the waiting./i }));
    expect(p.onCreate).toHaveBeenCalledWith({
      title: "Grace in the Waiting",
      dedication: "for the youth night",
    });
  });

  it("every card is skippable: skip-name defaults, skip-dedication creates without one", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /skip — call it/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip — just start the song/i }));
    expect(p.onCreate).toHaveBeenCalledWith({ title: "New song", dedication: null });
  });

  it("Back is real — the name survives the round trip", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/song name/i), { target: { value: "Hold On" } });
    fireEvent.click(screen.getByRole("button", { name: /name it/i }));
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(screen.getByLabelText(/song name/i)).toHaveValue("Hold On");
  });

  it("dismiss loses nothing because nothing exists yet — the label says so", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /close — nothing is created yet/i }));
    expect(p.onClose).toHaveBeenCalledTimes(1);
    expect(p.onCreate).not.toHaveBeenCalled();
  });

  it("only one card is mounted at a time (the carousel a11y law)", () => {
    setup();
    expect(screen.getByLabelText(/song name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/who this song is for/i)).toBeNull();
  });
});
