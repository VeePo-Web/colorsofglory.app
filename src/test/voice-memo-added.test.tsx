import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// The "Voice memo added" celebration must render the user's REAL memo (via
// A3's memo SDK) — never the old hardcoded fixture — and must only mark the
// first_voice_memo_added step when a real memo actually exists.

const listMemosForSong = vi.fn();
const getPlaybackUrl = vi.fn((_id: string) => Promise.resolve("https://example.com/a.webm"));
const updateOnboardingStep = vi.fn((_s: string) => Promise.resolve());

vi.mock("@/integrations/cog/memos", () => ({
  listMemosForSong: (id: string) => listMemosForSong(id),
  getPlaybackUrl: (id: string) => getPlaybackUrl(id),
}));
vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (s: string) => updateOnboardingStep(s),
}));
vi.mock("@/lib/songContext", () => ({
  getSong: () => ({ id: "s1", title: "Grace in the Waiting" }),
}));

import VoiceMemoAddedPage from "@/pages/onboarding/VoiceMemoAddedPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/songs/s1/voice-added"]}>
        <Routes>
          <Route path="/songs/:id/voice-added" element={<VoiceMemoAddedPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("VoiceMemoAddedPage — real memo celebration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the REAL latest memo (title + duration) and marks the step", async () => {
    listMemosForSong.mockResolvedValue([
      { id: "m1", title: "Bridge hum", duration_ms: 12000, waveform_peaks: [0.2, 0.8, 0.5] },
    ]);
    renderPage();
    expect(await screen.findByText("Bridge hum")).toBeInTheDocument();
    expect(screen.getByText(/0:12/)).toBeInTheDocument();
    expect(screen.getByText(/Grace in the Waiting/)).toBeInTheDocument();
    await waitFor(() =>
      expect(updateOnboardingStep).toHaveBeenCalledWith("first_voice_memo_added"),
    );
  });

  it("never fakes success: no memo → guidance back to the recorder, no step mark", async () => {
    listMemosForSong.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No voice memo here yet/i)).toBeInTheDocument();
    expect(screen.queryByText("First melody idea")).not.toBeInTheDocument();
    expect(updateOnboardingStep).not.toHaveBeenCalledWith("first_voice_memo_added");
  });

  it("offers the invite-a-collaborator path and a calm dismiss", async () => {
    listMemosForSong.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByRole("button", { name: /invite a collaborator/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /finish setting up later/i })).toBeInTheDocument();
  });
});
