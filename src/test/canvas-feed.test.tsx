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
    expect(await screen.findByRole("tab", { name: /^ideas$/i }, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /final/i })).toBeInTheDocument();
    // The one creation surface rides along (Record memo is the primary).
    expect(screen.getAllByRole("button", { name: /record memo/i }).length).toBeGreaterThan(0);
    // Spatial-only chrome stays in the map view.
    expect(screen.queryByLabelText(/fit the whole song to view/i)).toBeNull();
  });

  it("the Final page is a listen mode with its own identity (empty state guides back to Ideas)", async () => {
    renderCanvas();
    const finalTab = await screen.findByRole("tab", { name: /final/i }, { timeout: 10000 });
    fireEvent.click(finalTab);
    expect(await screen.findByText(/final shape lives here/i)).toBeInTheDocument();
    // The safe route back to the stream.
    fireEvent.click(screen.getByRole("button", { name: /back to the ideas/i }));
    await waitFor(() => expect(screen.getByRole("tab", { name: /^ideas$/i })).toHaveAttribute("aria-selected", "true"));
  });

  it("the map stays one tap away — and the choice persists", async () => {
    renderCanvas();
    const mapBtn = await screen.findByRole("button", { name: /open the map view/i }, { timeout: 10000 });
    fireEvent.click(mapBtn);
    // The spatial room: root song card + Fit control.
    expect(await screen.findByLabelText(/root song card/i, {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByLabelText(/fit the whole song to view/i)).toBeInTheDocument();
    expect(localStorage.getItem("cog:canvas-view")).toBe("map");
    // And back to the feed.
    fireEvent.click(screen.getByRole("button", { name: /open the feed view/i }));
    expect(await screen.findByRole("tab", { name: /^ideas$/i })).toBeInTheDocument();
    expect(localStorage.getItem("cog:canvas-view")).toBe("feed");
  });
});
