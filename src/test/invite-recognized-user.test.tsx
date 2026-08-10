import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// A person the app already knows ("Continue as Parker →") must only one-tap
// join when a MATCHING session truly exists on this device; otherwise a real,
// guarded OTP is sent and they go to verify. These behaviors used to live on
// the deleted /invite/welcome interstitial — they now live on the join page
// itself, one screen earlier.

const navigate = vi.fn();
const acceptInvite = vi.fn();
const getSessionUser = vi.fn();
const sendPhoneOtp = vi.fn();
const previewInvite = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ token: "tok-1" }) };
});

vi.mock("@/integrations/cog/auth", () => ({
  useCurrentAccount: () => ({ loading: false, user: null, profile: null }),
  getSessionUser: () => getSessionUser(),
  sendPhoneOtp: (e164: string) => sendPhoneOtp(e164),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  previewInvite: (t: string) => previewInvite(t),
  checkPhoneRegistered: vi.fn().mockResolvedValue({ exists: true, firstName: "Parker" }),
  acceptInvite: (t: string) => acceptInvite(t),
}));

vi.mock("@/integrations/cog/songs", () => ({ requestNewInvite: vi.fn() }));

// inviteContext stays REAL (sessionStorage) so enterInvitedSong's landing URL
// is exercised end to end.
import InviteJoinPage from "@/pages/invite/InviteJoinPage";

const PREVIEW = {
  status: "valid", token: "tok-1", songId: "song-1", songTitle: "Grace in the Waiting",
  inviterFirstName: "Sarah", inviterLastName: "Lee", inviterAvatarColor: "#8070C4",
  assignedRole: "contributor", lyricsSnippet: null, collaborators: [], collaboratorCount: 0,
  usesRemaining: 4,
};

/** Type a full number, wait for the recognized-user CTA, tap it. */
async function continueAsParker() {
  const input = await screen.findByLabelText("Phone number");
  fireEvent.change(input, { target: { value: "5555550123" } });
  const cta = await screen.findByRole("button", { name: /continue as parker/i });
  fireEvent.click(cta);
}

describe("InviteJoinPage — recognized user (folded welcome-back)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    previewInvite.mockResolvedValue(PREVIEW);
    acceptInvite.mockResolvedValue({ status: "success", songId: "song-1", songTitle: "Grace in the Waiting", role: "contributor" });
    sendPhoneOtp.mockResolvedValue(undefined);
  });

  it("one-tap joins straight into the song when a matching session exists on this device", async () => {
    getSessionUser.mockResolvedValue({ phone: "15555550123" });
    render(<InviteJoinPage />);
    await continueAsParker();
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith("tok-1"));
    expect(navigate).toHaveBeenCalledWith(
      "/songs/song-1/canvas?invite=1&role=contributor",
      { replace: true },
    );
    expect(sendPhoneOtp).not.toHaveBeenCalled();
  });

  it("sends a real guarded OTP and routes to verify when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);
    render(<InviteJoinPage />);
    await continueAsParker();
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+15555550123"));
    expect(navigate).toHaveBeenCalledWith("/invite/verify");
    expect(sessionStorage.getItem("cog:phone-e164")).toBe("+15555550123");
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("does NOT accept as the wrong account when a different phone is signed in", async () => {
    getSessionUser.mockResolvedValue({ phone: "19998887777" });
    render(<InviteJoinPage />);
    await continueAsParker();
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+15555550123"));
    expect(acceptInvite).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/invite/verify");
  });
});
