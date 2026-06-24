import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// Creating the first song must NOT silently drop an authenticated user onto the
// demo song "1" when the insert fails — it must show a retryable error. The
// demo fallback is only for a genuinely absent session.

const navigate = vi.fn();
const getUser = vi.fn();
const setSong = vi.fn();
const updateOnboardingStep = vi.fn((_s: string) => Promise.resolve());
let songResult: { data: { id: string; title: string } | null; error: { message: string } | null };

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from: (table: string) => ({
      insert: (_payload: unknown) =>
        table === "songs"
          ? { select: () => ({ single: () => Promise.resolve(songResult) }) }
          : Promise.resolve({ error: null }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
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
    songResult = { data: { id: "song-9", title: "My Song" }, error: null };
  });

  it("creates the real song and advances the onboarding step", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/songs/song-9?first=1"));
    expect(updateOnboardingStep).toHaveBeenCalledWith("first_song_created");
  });

  it("shows a retryable error (not the demo song) when an authed insert fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    songResult = { data: null, error: { message: "db down" } };
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't create your song/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses the demo fallback only when there is genuinely no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(<StartFirstSongPage />);
    typeTitle("My Song");
    clickCreate();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/songs/1?first=1"));
  });
});
