import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// The invite-to-onboard path must send its first OTP through the protected
// auth SDK (sendPhoneOtp → otp-guard toll-fraud rails), exactly like the main
// phone login — never a raw, unguarded supabase.auth.signInWithOtp.

const navigate = vi.fn();
const sendPhoneOtp = vi.fn();
const previewInvite = vi.fn();
const checkPhoneRegistered = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate, useParams: () => ({ token: "tok-1" }) };
});

vi.mock("@/integrations/cog/auth", () => ({
  sendPhoneOtp: (e164: string) => sendPhoneOtp(e164),
  // Real-enough AuthError for instanceof checks in the page's error mapper.
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  // InviteJoinPage reads this for the signed-in one-tap fast path; here we force
  // the unauthenticated state so the test exercises the phone-entry OTP-guard path.
  useCurrentAccount: () => ({ loading: false, user: null, profile: null }),
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  previewInvite: (t: string) => previewInvite(t),
  checkPhoneRegistered: (p: string) => checkPhoneRegistered(p),
}));

vi.mock("@/lib/invite/inviteContext", () => ({
  saveInviteContext: vi.fn(),
}));

import InviteJoinPage from "@/pages/invite/InviteJoinPage";

const PREVIEW = {
  status: "valid",
  token: "tok-1",
  songId: "song-1",
  songTitle: "Grace in the Waiting",
  inviterFirstName: "Sarah",
  inviterLastName: "Lee",
  inviterAvatarColor: "#8070C4",
  assignedRole: "contributor",
  lyricsSnippet: null,
  collaborators: [],
  collaboratorCount: 0,
  maxUses: 5,
  currentUses: 1,
};

describe("InviteJoinPage — OTP toll-fraud guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    previewInvite.mockResolvedValue(PREVIEW);
    checkPhoneRegistered.mockResolvedValue({ exists: false, firstName: null });
    sendPhoneOtp.mockResolvedValue(undefined);
  });

  it("sends the first invite OTP through the protected sendPhoneOtp SDK and advances to verify", async () => {
    render(<InviteJoinPage />);

    // Wait for the invite to load into the phone-entry state.
    const input = await screen.findByLabelText("Phone number");
    fireEvent.change(input, { target: { value: "5555550123" } });

    fireEvent.click(screen.getByRole("button", { name: /join this song/i }));

    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+15555550123"));
    expect(navigate).toHaveBeenCalledWith("/invite/verify");
    expect(sessionStorage.getItem("cog:phone-e164")).toBe("+15555550123");
  });

  it("surfaces a kind error and stays on the join screen when the guard blocks the send", async () => {
    const { AuthError } = await import("@/integrations/cog/auth");
    sendPhoneOtp.mockRejectedValue(new AuthError("RATE_LIMITED", "blocked"));

    render(<InviteJoinPage />);
    const input = await screen.findByLabelText("Phone number");
    fireEvent.change(input, { target: { value: "5555550123" } });
    fireEvent.click(screen.getByRole("button", { name: /join this song/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many attempts/i);
    expect(navigate).not.toHaveBeenCalledWith("/invite/verify");
  });
});
