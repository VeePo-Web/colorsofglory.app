import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// Creating the first song goes through A3's createSong() edge function. It must
// NOT silently drop an authenticated user onto the demo song "1" when creation
// fails — it must show a retryable error. The demo fallback is DEV-only and
// only for a genuinely absent session.

const navigate = vi.fn();
const getUser = vi.fn();
const setSong = vi.fn();
const updateOnboardingStep = vi.fn((_s: string) => Promise.resolve());
const createSong = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("@/integrations/cog/songs", () => ({
  createSong: (input: unknown) => createSong(input),
  setFirstSong: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/songContext", () => ({ setSong: (s: unknown) => setSong(s) }));
vi.mock("@/lib/invite/inviteApi", () => ({ updateOnboardingStep: (s: string) => updateOnboardingStep(s) }));

import StartFirstSongPage from "@/pages/onboarding/StartFirstSongPage";

const typeTitle = (v: string) => fireEvent.change(screen.getByLabelText("Song title"), { target: { value: v } });
const clickCreate = () => fireEvent.click(screen.getByRole("button", { name: /create song/i }));

describe("StartFirstSongPage — first song creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    createSong.mockResolvedValue({ song: { id: "song-9", title: "My Song" } });
  });

  it("creates the real song via createSong() and advances the onboarding step", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/songs/song-9"));
    expect(createSong).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Song" }),
    );
    expect(updateOnboardingStep).toHaveBeenCalledWith("first_song_created");
  });

  it("shows a retryable error (not the demo song) when createSong fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    createSong.mockRejectedValue(new Error("db down"));
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't create your song/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses the DEV-only demo fallback when there is genuinely no session", async () => {
    // vitest runs under Vite DEV mode, so the guarded branch is reachable here;
    // in a production build import.meta.env.DEV is false and this path routes
    // to /auth/login instead.
    getUser.mockResolvedValue({ data: { user: null } });
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/songs/1"));
    expect(createSong).not.toHaveBeenCalled();
  });
});
