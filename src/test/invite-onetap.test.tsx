import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// A signed-in user tapping an invite link should join in ONE tap (no phone
// re-entry). A logged-out user still gets the phone flow.

const navigate = vi.fn();
const acceptInvite = vi.fn();
const sendPhoneOtp = vi.fn();
const previewInvite = vi.fn();
let account: { loading: boolean; user: unknown; profile: { display_name: string | null } | null };

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ token: "tok-1" }) };
});

vi.mock("@/integrations/cog/auth", () => ({
  useCurrentAccount: () => account,
  sendPhoneOtp: (e164: string) => sendPhoneOtp(e164),
  AuthError: class AuthError extends Error { code: string; constructor(c: string, m: string) { super(m); this.code = c; } },
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  previewInvite: (t: string) => previewInvite(t),
  checkPhoneRegistered: vi.fn().mockResolvedValue({ exists: false, firstName: null }),
  acceptInvite: (t: string) => acceptInvite(t),
}));

vi.mock("@/lib/invite/inviteContext", () => ({ saveInviteContext: vi.fn() }));
vi.mock("@/integrations/cog/songs", () => ({ requestNewInvite: vi.fn() }));

import InviteJoinPage from "@/pages/invite/InviteJoinPage";

const PREVIEW = {
  status: "valid", token: "tok-1", songId: "song-1", songTitle: "Grace in the Waiting",
  inviterFirstName: "Kevin", inviterLastName: "Lee", inviterAvatarColor: "#8070C4",
  assignedRole: "contributor", lyricsSnippet: null, collaborators: [], collaboratorCount: 0,
  maxUses: 5, currentUses: 1,
};

describe("InviteJoinPage — signed-in one-tap join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    previewInvite.mockResolvedValue(PREVIEW);
    acceptInvite.mockResolvedValue({ songId: "song-1", songTitle: "Grace in the Waiting", role: "contributor" });
    account = { loading: false, user: { id: "u1" }, profile: { display_name: "Sarah Lee" } };
  });

  it("offers a one-tap 'Join as <name>' for a signed-in invitee and accepts immediately", async () => {
    render(<InviteJoinPage />);
    const joinBtn = await screen.findByRole("button", { name: /join as sarah/i });
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
    fireEvent.click(joinBtn);
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith("tok-1"));
    expect(navigate).toHaveBeenCalledWith("/invite/team");
  });

  it("lets a signed-in user fall back to a different number", async () => {
    render(<InviteJoinPage />);
    fireEvent.click(await screen.findByRole("button", { name: /use a different number/i }));
    expect(await screen.findByLabelText("Phone number")).toBeInTheDocument();
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("shows the phone flow (no one-tap) for a logged-out visitor", async () => {
    account = { loading: false, user: null, profile: null };
    render(<InviteJoinPage />);
    expect(await screen.findByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /join as/i })).not.toBeInTheDocument();
  });
});
