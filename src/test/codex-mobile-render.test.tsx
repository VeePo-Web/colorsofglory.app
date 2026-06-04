import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SongCatalogPage from "@/pages/SongCatalogPage";
import SongWorkspacePage from "@/pages/SongWorkspacePage";
import CaptureFirstIdeaPage from "@/pages/onboarding/CaptureFirstIdeaPage";
import VoiceMemoAddedPage from "@/pages/onboarding/VoiceMemoAddedPage";
import NotFound from "@/pages/NotFound";
import UpgradePage from "@/pages/UpgradePage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ChordsPage from "@/pages/ChordsPage";
import SongCanvasPage from "@/pages/SongCanvasPage";

const setMobileViewport = () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  window.dispatchEvent(new Event("resize"));
};

const renderRoute = (initialPath: string, routePath: string, element: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );

describe("Codex 390px mobile render smoke", () => {
  beforeEach(() => {
    setMobileViewport();
    sessionStorage.clear();
  });

  it("renders the song catalog at the primary mobile width", () => {
    renderRoute("/", "/", <SongCatalogPage />);

    expect(screen.getByRole("heading", { name: /your songs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new song/i })).toBeInTheDocument();
  });

  it("renders the song workspace at the primary mobile width", () => {
    renderRoute("/songs/1?first=1", "/songs/:id", <SongWorkspacePage />);

    expect(screen.getByRole("heading", { name: /grace in the waiting/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /write/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
  });

  it("renders the guided capture and saved memo states at the primary mobile width", () => {
    const { unmount } = renderRoute("/songs/1/capture", "/songs/:id/capture", <CaptureFirstIdeaPage />);

    expect(screen.getByRole("heading", { name: /capture the first idea/i })).toBeInTheDocument();
    unmount();

    renderRoute("/songs/1/voice-added", "/songs/:id/voice-added", <VoiceMemoAddedPage />);
    expect(screen.getByRole("heading", { name: /voice memo added/i })).toBeInTheDocument();
    expect(screen.getByText(/your first idea is saved inside/i)).toBeInTheDocument();
  });

  it("renders the 404 fallback at the primary mobile width", () => {
    renderRoute("/not-a-real-song-room", "*", <NotFound />);

    expect(screen.getByRole("heading", { name: /this song room is not here/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to songs/i })).toBeInTheDocument();
  });

  it("renders the upgrade page at the primary mobile width", () => {
    renderRoute("/upgrade", "/upgrade", <UpgradePage />);

    expect(screen.getByRole("heading", { name: /ready to build your catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go pro/i })).toBeInTheDocument();
  });

  it("renders the settings page at the primary mobile width", () => {
    renderRoute("/settings", "/settings", <SettingsPage />);

    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /storage/i })).toBeInTheDocument();
  });

  it("renders the chords page at the primary mobile width", () => {
    renderRoute("/songs/1/chords", "/songs/:id/chords", <ChordsPage />);

    expect(screen.getByRole("heading", { name: /grace in the waiting/i })).toBeInTheDocument();
    expect(screen.getByText(/chord chart/i)).toBeInTheDocument();
  });

  it("renders the song whiteboard at the primary mobile width", async () => {
    renderRoute("/songs/1/canvas", "/songs/:id/canvas", <SongCanvasPage />);

    expect(screen.getByRole("heading", { name: /grace in the waiting/i })).toBeInTheDocument();
    expect(screen.getByText(/everything for this song stays connected here/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /lyrics/i }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /voice memos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /chord map/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /song notes/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /ideas tree/i }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /final tree/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /in this room/i }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what changed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add idea/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record idea/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/song whiteboard canvas/i)).toBeInTheDocument();
  }, 10000);
});
