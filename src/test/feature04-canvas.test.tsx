import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
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

const lastButton = (name: RegExp) => {
  const buttons = screen.getAllByRole("button", { name });
  return buttons[buttons.length - 1];
};

describe("Feature 04 song whiteboard canvas", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  it("anchors the canvas around one root song card and clear thumb actions", async () => {
    renderCanvas();

    expect(await screen.findByLabelText(/root song card/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/start building the song here/i)).toBeInTheDocument();
    expect(lastButton(/add part/i)).toBeEnabled();
    expect(lastButton(/record idea|record memo/i)).toBeEnabled();
    expect(screen.getByText(/saved to this song/i)).toBeInTheDocument();
  });

  it("adds a named song part (Verse) and keeps it after remount", async () => {
    const view = renderCanvas();

    await screen.findByLabelText(/root song card/i, {}, { timeout: 5000 });
    // Open the "Add a part" picker, then pick Verse.
    fireEvent.click(lastButton(/add part/i));
    const verseBtn = await screen.findByRole("button", { name: /^verse$/i }, { timeout: 3000 });
    fireEvent.click(verseBtn);

    expect(await screen.findByRole("button", { name: /lyric card: verse 1/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem("cog:canvas-cards-1")).toContain("Verse 1");
    });

    view.unmount();
    renderCanvas();

    expect(await screen.findByRole("button", { name: /lyric card: verse 1/i })).toBeInTheDocument();
  });

  it("keeps viewer mode readable and blocks creation with product copy", async () => {
    renderCanvas("/songs/1/canvas?role=viewer");

    expect(await screen.findByText(/you can view this canvas/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(lastButton(/add part/i)).toBeDisabled();
    expect(lastButton(/record idea|record memo/i)).toBeDisabled();
  });
});
