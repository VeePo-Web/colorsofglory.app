import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const navigate = vi.fn();
const listMySongs = vi.fn();
let profile: { display_name: string | null } | null;

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/integrations/cog/auth", () => ({
  useCurrentAccount: () => ({ profile }),
}));

vi.mock("@/integrations/cog/songs", () => ({
  listMySongs: () => listMySongs(),
}));

import ReturningHomePage from "@/pages/ReturningHomePage";

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ReturningHomePage />
    </MemoryRouter>,
  );

describe("ReturningHomePage — real returning-user data (no mock Parker)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profile = { display_name: "Sarah Lee" };
  });

  it("greets the real signed-in user and surfaces their real last song", async () => {
    listMySongs.mockResolvedValue([
      { id: "s1", title: "Morning Prayer", last_activity_at: new Date().toISOString(), voice_memo_count: 2, collaborator_count: 1, status: "active", my_role: "owner", cover_color: null, created_at: "" },
    ]);
    renderPage();

    expect(await screen.findByText("Morning Prayer")).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Sarah/)).toBeInTheDocument();
    expect(screen.queryByText(/Parker/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Grace in the Waiting/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open last song/i }));
    expect(navigate).toHaveBeenCalledWith("/songs/s1");
  });

  it("offers to start a song when a returning user has none", async () => {
    listMySongs.mockResolvedValue([]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /start a song/i }));
    expect(navigate).toHaveBeenCalledWith("/onboarding/start-song");
  });
});
