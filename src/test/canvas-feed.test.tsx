import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SongCanvasPage from "@/pages/SongCanvasPage";

/**
 * The Glory Feed — the canvas's mobile-first vertical lens. At 390px the feed
 * is the DEFAULT: full-screen Ideas page ⇄ full-screen Final listen mode, with
 * the spatial map one tap away. This is the ideas→song flow contract.
 */
const renderCanvas = (path = "/songs/1/canvas") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/songs/:id/canvas" element={<SongCanvasPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Glory Feed — the ideas→song flow is the phone default", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  it("opens as the feed: Ideas | Final pager, creation dock, no spatial chrome", async () => {
    renderCanvas();
    expect(await screen.findByRole("tab", { name: /^ideas$/i }, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /final/i })).toBeInTheDocument();
    // The one creation surface rides along (Record memo is the primary).
    expect(screen.getAllByRole("button", { name: /record memo/i }).length).toBeGreaterThan(0);
    // Spatial-only chrome stays in the map view.
    expect(screen.queryByLabelText(/fit the whole song to view/i)).toBeNull();
  });

  it("the Final page is a listen mode with its own identity (empty state guides back to Ideas)", async () => {
    renderCanvas();
    const finalTab = await screen.findByRole("tab", { name: /final/i }, { timeout: 20000 });
    fireEvent.click(finalTab);
    expect(await screen.findByText(/final shape lives here/i)).toBeInTheDocument();
    // The safe route back to the stream.
    fireEvent.click(screen.getByRole("button", { name: /back to the ideas/i }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^ideas$/i })).toHaveAttribute("aria-selected", "true"));
  });

  it("the whiteboard is retired: no map entry anywhere in the feed", async () => {
    renderCanvas();
    await screen.findByRole("tab", { name: /^ideas$/i }, { timeout: 20000 });
    expect(screen.queryByRole("button", { name: /open the map view/i })).toBeNull();
  });

  it("the stored preference is the map's only door — and its Feed pill leads back", async () => {
    localStorage.setItem("cog:canvas-view", "map");
    renderCanvas();
    // The dormant spatial room still works behind the hatch (weave/merge live on).
    expect(await screen.findByLabelText(/root song card/i, {}, { timeout: 20000 })).toBeInTheDocument();
    // And its Feed pill returns to the one true canvas.
    fireEvent.click(screen.getByRole("button", { name: /open the feed view/i }));
    expect(await screen.findByRole("tab", { name: /^ideas$/i })).toBeInTheDocument();
    expect(localStorage.getItem("cog:canvas-view")).toBe("feed");
  });
});
