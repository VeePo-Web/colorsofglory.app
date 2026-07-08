import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const navigate = vi.fn();
const getSong = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/integrations/cog/songs", () => ({
  getSong: (id: string) => getSong(id),
}));

import SongWorkspacePage from "@/pages/SongWorkspacePage";

const detail = (overrides: Record<string, unknown> = {}, counts: Record<string, number> = {}) => ({
  id: "s1",
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
  counts: {
    sections: 3,
    lyrics_filled: 5,
    voice_memos: 2,
    notes: 1,
    collaborators: 3,
    pending_suggestions: 0,
    ...counts,
  },
  ...overrides,
});

const renderHub = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter
        initialEntries={["/songs/s1/room"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/songs/:id/room" element={<SongWorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("SongWorkspacePage — real private room (no mock)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the REAL song title, key/BPM, and on-brief copy", async () => {
    getSong.mockResolvedValue(detail());
    renderHub();

    expect(await screen.findByRole("heading", { name: "River of Mercy" })).toBeInTheDocument();
    expect(screen.getByText("G · 72 BPM")).toBeInTheDocument();
    expect(screen.getByText("Private song space")).toBeInTheDocument();
    expect(
      screen.getByText("Start anywhere. Add a lyric, record a voice memo, or invite someone into the song."),
    ).toBeInTheDocument();
    // Mock-era titles must be gone forever.
    expect(screen.queryByText(/Grace in the Waiting|Morning Prayer|Holy Fire/)).not.toBeInTheDocument();
  });

  it("shows each card's live count from SongDetail.counts (mini-sections, not buttons)", async () => {
    getSong.mockResolvedValue(detail());
    renderHub();

    expect(await screen.findByText("3 sections")).toBeInTheDocument();
    expect(screen.getByText("2 memos")).toBeInTheDocument();
    expect(screen.getByText("1 note")).toBeInTheDocument();
    expect(screen.getByText("3 people")).toBeInTheDocument();
    expect(screen.getByText("Key of G · 72 BPM")).toBeInTheDocument();
  });

  it("shows soft first-action affordances on an empty song — never a bare 0", async () => {
    getSong.mockResolvedValue(
      detail(
        { key_signature: null, tempo_bpm: null },
        { sections: 0, voice_memos: 0, notes: 0, collaborators: 1 },
      ),
    );
    renderHub();

    expect(await screen.findByText("Add your first lyric")).toBeInTheDocument();
    expect(screen.getByText("Record your first memo")).toBeInTheDocument();
    expect(screen.getByText("Add your first note")).toBeInTheDocument();
    expect(screen.getByText("Invite someone in")).toBeInTheDocument();
    expect(screen.getByText("Set key & tempo")).toBeInTheDocument();
    expect(screen.queryByText(/^0 /)).not.toBeInTheDocument();
  });

  it("navigates each of the exactly-5 cards to its canonical panel", async () => {
    getSong.mockResolvedValue(detail());
    renderHub();
    await screen.findByRole("heading", { name: "River of Mercy" });

    fireEvent.click(screen.getByRole("button", { name: /Lyrics/ }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/sheet");

    fireEvent.click(screen.getByRole("button", { name: /Voice Memo/ }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/canvas?layer=voice");

    fireEvent.click(screen.getByRole("button", { name: /Chords/ }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/sheet");

    fireEvent.click(screen.getByRole("button", { name: /Notes/ }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/canvas?layer=notes");

    fireEvent.click(screen.getByRole("button", { name: /Invite 3 people/ }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/canvas?layer=people");
  });

  it("keeps the quick-action bar with the single gold Record memo emphasis", async () => {
    getSong.mockResolvedValue(detail());
    renderHub();
    await screen.findByRole("heading", { name: "River of Mercy" });

    fireEvent.click(screen.getByRole("button", { name: "Record memo" }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/canvas?layer=voice");
    fireEvent.click(screen.getByRole("button", { name: "Write lyric" }));
    expect(navigate).toHaveBeenLastCalledWith("/songs/s1/sheet");
  });

  it("shows a calm unavailable state when getSong returns null (not a member)", async () => {
    getSong.mockResolvedValue(null);
    renderHub();

    expect(await screen.findByText("This song isn't available")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to your songs/i }));
    expect(navigate).toHaveBeenLastCalledWith("/songs");
  });
});

describe("route guard — /songs/:id/room requires auth", () => {
  it("wraps the room route in RequireAuth", () => {
    const appSource = readFileSync(resolve(__dirname, "../App.tsx"), "utf-8");
    expect(appSource).toContain(
      '<Route path="/songs/:id/room" element={<RequireAuth><SongWorkspacePage /></RequireAuth>} />',
    );
  });
});
