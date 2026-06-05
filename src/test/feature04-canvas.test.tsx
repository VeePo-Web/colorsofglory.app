import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SongCanvasPage from "@/pages/SongCanvasPage";

const renderCanvas = (path = "/songs/1/canvas") =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/songs/:id/canvas" element={<SongCanvasPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Feature 04 song whiteboard canvas", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  it("renders the song-specific canvas foundation with root card and primary actions", async () => {
    renderCanvas();

    expect(await screen.findByText(/start building the song here/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /grace in the waiting/i })).toBeInTheDocument();
    expect(screen.getByText(/root idea/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add idea/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record memo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open sarah chorus melody/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/song canvas map/i)).toBeInTheDocument();
  });

  it("adds a new idea through the capture-first sheet and shows a saved card", async () => {
    renderCanvas();

    fireEvent.click(await screen.findByRole("button", { name: /add idea/i }));

    const sheet = screen.getByRole("dialog", { name: /add idea to this song/i });
    fireEvent.change(within(sheet).getByLabelText(/idea title/i), {
      target: { value: "Bridge lift" },
    });
    fireEvent.change(within(sheet).getByLabelText(/idea preview/i), {
      target: { value: "Let the bridge rise with a quiet harmony." },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: /save idea/i }));

    expect(await screen.findByRole("button", { name: /open bridge lift/i })).toBeInTheDocument();
    expect(screen.getByText(/saved to this song/i)).toBeInTheDocument();
  });

  it("opens a detail drawer for a card without leaving the canvas", async () => {
    renderCanvas();

    fireEvent.click(await screen.findByRole("button", { name: /open sarah chorus melody/i }));

    const drawer = screen.getByRole("dialog", { name: /sarah chorus melody/i });
    expect(within(drawer).getByText(/voice memo/i)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /add to final/i })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /branch from this/i })).toBeInTheDocument();
  });

  it("keeps viewer mode readable and blocks creation with plain-language copy", async () => {
    renderCanvas("/songs/1/canvas?role=viewer");

    expect(await screen.findByText(/you can view this canvas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add idea/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /record memo/i })).toBeDisabled();
  });
});
