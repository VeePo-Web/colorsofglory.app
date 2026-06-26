import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// The "Welcome back" existing-user screen must only one-tap-join when a MATCHING
// session truly exists on this device; otherwise it must send a real, guarded
// OTP and route to verify (never assume "you're already in", which dead-ended).

const navigate = vi.fn();
const acceptInvite = vi.fn();
const getSessionUser = vi.fn();
const sendPhoneOtp = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/invite/inviteContext", () => ({
  loadInviteContext: () => ({
    token: "tok-1",
    verifiedPhone: "+15555550123",
    songTitle: "Grace in the Waiting",
    inviterFirstName: "Sarah",
    existingFirstName: "Parker",
  }),
  saveInviteContext: vi.fn(),
  getAvatarColor: () => "#8070C4",
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  acceptInvite: (t: string) => acceptInvite(t),
}));

vi.mock("@/integrations/cog/auth", () => ({
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

import InviteWelcomeBackPage from "@/pages/invite/InviteWelcomeBackPage";

const clickJoin = () =>
  fireEvent.click(screen.getByRole("button", { name: /join grace in the waiting/i }));

describe("InviteWelcomeBackPage — existing-user join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    acceptInvite.mockResolvedValue({ songId: "song-1", songTitle: "Grace in the Waiting", role: "contributor" });
    sendPhoneOtp.mockResolvedValue(undefined);
  });

  it("one-tap joins when a matching session already exists on this device", async () => {
    getSessionUser.mockResolvedValue({ phone: "15555550123" });
    render(<InviteWelcomeBackPage />);
    clickJoin();
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith("tok-1"));
    expect(navigate).toHaveBeenCalledWith("/invite/team");
    expect(sendPhoneOtp).not.toHaveBeenCalled();
  });

  it("sends a real guarded OTP and routes to verify when there is no session", async () => {
    getSessionUser.mockResolvedValue(null);
    render(<InviteWelcomeBackPage />);
    clickJoin();
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+15555550123"));
    expect(navigate).toHaveBeenCalledWith("/invite/verify");
    expect(sessionStorage.getItem("cog:phone-e164")).toBe("+15555550123");
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("does NOT accept as the wrong account when a different phone is signed in", async () => {
    getSessionUser.mockResolvedValue({ phone: "19998887777" });
    render(<InviteWelcomeBackPage />);
    clickJoin();
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith("+15555550123"));
    expect(acceptInvite).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/invite/verify");
  });
});
