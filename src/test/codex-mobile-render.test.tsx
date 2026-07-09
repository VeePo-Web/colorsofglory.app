import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The workspace hub loads its real song via getSong — stub it with a live-looking detail.
vi.mock("@/integrations/cog/songs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/cog/songs")>();
  return {
    ...actual,
    getSong: vi.fn().mockResolvedValue({
      id: "1",
      owner_user_id: "u1",
      title: "River of Mercy",
      status: "active",
      key_signature: "G",
      tempo_bpm: 72,
      time_signature: null,
      tags: null,
      cover_color: null,
      is_locked: false,
      last_activity_at: null,
      created_at: "",
      updated_at: "",
      lyrics_snippet: null,
      my_role: "owner",
      counts: { sections: 2, lyrics_filled: 3, voice_memos: 1, notes: 1, collaborators: 2, pending_suggestions: 0 },
    }),
  };
});
// The pricing page renders server plan tiers — stub the pricing API so the
// smoke render is deterministic (no supabase round-trip in jsdom).
vi.mock("@/lib/pricing/pricingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pricing/pricingApi")>();
  return {
    ...actual,
    fetchPlanTiers: vi.fn().mockResolvedValue([
      {
        key: "free", displayName: "Free", monthlyCents: 0, currency: "cad",
        ownedSongLimit: 1, storageBytesIncluded: 524_288_000,
        allowsFounderCode: false, allowsMemberReferral: false, allowsStorageAddons: false,
        stripePriceId: null, stripeReferralPriceId: null, sortOrder: 0,
      },
      {
        key: "pro", displayName: "Pro", monthlyCents: 10000, currency: "cad",
        ownedSongLimit: 50, storageBytesIncluded: 107_374_182_400,
        allowsFounderCode: true, allowsMemberReferral: true, allowsStorageAddons: true,
        stripePriceId: "price_pro", stripeReferralPriceId: "price_pro_ref", sortOrder: 2,
      },
    ]),
    fetchCurrentPlan: vi.fn().mockResolvedValue("free"),
    validateCode: vi.fn(),
    createCheckoutSession: vi.fn(),
  };
});

import SongCatalogPage from "@/pages/SongCatalogPage";
import SongWorkspacePage from "@/pages/SongWorkspacePage";
import CaptureFirstIdeaPage from "@/pages/onboarding/CaptureFirstIdeaPage";
import VoiceMemoAddedPage from "@/pages/onboarding/VoiceMemoAddedPage";
import NotFound from "@/pages/NotFound";
import UpgradePage from "@/pages/pricing/UpgradePage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ChordsPage from "@/pages/ChordsPage";
import SongCanvasPage from "@/pages/SongCanvasPage";
import CodeVerifyPage from "@/pages/auth/CodeVerifyPage";

const setMobileViewport = () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  window.dispatchEvent(new Event("resize"));
};

const renderRoute = (initialPath: string, routePath: string, element: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[initialPath]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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

  it("renders the song workspace at the primary mobile width", async () => {
    renderRoute("/songs/1/room", "/songs/:id/room", <SongWorkspacePage />);

    expect(await screen.findByRole("heading", { name: /river of mercy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /write/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /invite/i }).length).toBeGreaterThan(0);
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

  it("renders the upgrade page at the primary mobile width", async () => {
    renderRoute("/upgrade", "/upgrade", <UpgradePage />);

    expect(screen.getByRole("heading", { name: /ready to build your catalog/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /go pro/i })).toBeInTheDocument();
  });

  it("renders the settings page at the primary mobile width", () => {
    renderRoute("/settings", "/settings", <SettingsPage />);

    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /storage/i })).toBeInTheDocument();
  });

  it("renders the phone verification screen with seeded session context at the primary mobile width", () => {
    sessionStorage.setItem("cog:phone-e164", "+15555551212");
    sessionStorage.setItem("cog:phone-display", "(555) 555-1212");

    renderRoute("/auth/verify", "/auth/verify", <CodeVerifyPage />);

    expect(screen.getByRole("heading", { name: /check your phone/i })).toBeInTheDocument();
    expect(screen.getByText(/\(555\) 555-1212/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/code digit/i)).toHaveLength(6);
    expect(screen.getByRole("button", { name: /verify/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /change number/i })).toBeInTheDocument();
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
