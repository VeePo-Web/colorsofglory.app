import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavior coverage for /auth/phone/verify (CodeVerifyPage) — the verify screen
 * had none, only /auth/login did. Locks the frictionless + calm-error contract:
 * paste/autofill fills all 6 and auto-submits, a wrong code stays calm and clears,
 * "Change number" escapes to /auth/login, and WebOTP absence never blocks manual
 * entry. Success reconciles the invite token then hands off via routeAfterAuth.
 */

const navigate = vi.fn();
const verifyPhoneOtp = vi.fn();
const sendPhoneOtp = vi.fn();
const routeAfterAuth = vi.fn();
const reconcileInviteToken = vi.fn();

// Hoisted so the (hoisted) vi.mock factory and the tests share one AuthError class
// — the page's `err instanceof AuthError` check must see the same constructor.
const { AuthError } = vi.hoisted(() => ({
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/integrations/cog/auth", () => ({
  verifyPhoneOtp: (e164: string, code: string) => verifyPhoneOtp(e164, code),
  sendPhoneOtp: (e164: string) => sendPhoneOtp(e164),
  AuthError,
}));

vi.mock("@/lib/auth/postAuthRoute", () => ({
  routeAfterAuth: (n: unknown) => routeAfterAuth(n),
}));

vi.mock("@/pages/auth/inviteHandoff", () => ({
  reconcileInviteToken: () => reconcileInviteToken(),
}));

// WebOTP + Turnstile are progressive no-ops in the test env — the point is that
// manual/paste entry still works when they don't fire.
vi.mock("@/lib/auth/useWebOtpAutofill", () => ({ useWebOtpAutofill: () => {} }));
vi.mock("@/lib/auth/useTurnstile", () => ({
  useTurnstile: () => ({ containerRef: { current: null }, getToken: async () => undefined }),
}));
// The screen idle-prefetches its next destinations; no-op it in tests.
vi.mock("@/lib/onboarding/prefetchNext", () => ({ useIdlePrefetch: () => {} }));

import CodeVerifyPage from "@/pages/auth/CodeVerifyPage";

const field = () =>
  document.querySelector('input[autocomplete="one-time-code"]') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("cog:phone-e164", "+15555550123");
  sessionStorage.setItem("cog:phone-display", "(555) 555-0123");
});

describe("CodeVerifyPage — /auth/phone/verify", () => {
  it("masks the number it sent the code to", () => {
    render(<CodeVerifyPage />);
    expect(screen.getByText(/\(555\) 555-0123/)).toBeInTheDocument();
  });

  it("paste/autofill fills all six and auto-submits, then hands off", async () => {
    verifyPhoneOtp.mockResolvedValue({});
    render(<CodeVerifyPage />);
    fireEvent.change(field(), { target: { value: "483920" } });

    await waitFor(() => expect(verifyPhoneOtp).toHaveBeenCalledWith("+15555550123", "483920"));
    await waitFor(() => expect(reconcileInviteToken).toHaveBeenCalled());
    await waitFor(() => expect(routeAfterAuth).toHaveBeenCalledWith(navigate));
  });

  it("keeps a wrong code calm and clears the field for instant retry", async () => {
    verifyPhoneOtp.mockRejectedValue(new AuthError("INVALID_OTP", "That code isn't right. Double-check and try again."));
    render(<CodeVerifyPage />);
    fireEvent.change(field(), { target: { value: "000000" } });

    await waitFor(() =>
      expect(screen.getByText(/that code isn't right/i)).toBeInTheDocument(),
    );
    expect(routeAfterAuth).not.toHaveBeenCalled();
    expect(field().value).toBe("");
  });

  it("starts the resend control in its 30s countdown (disabled)", () => {
    render(<CodeVerifyPage />);
    const resend = screen.getByRole("button", { name: /resend code \(30s\)/i });
    expect(resend).toBeDisabled();
  });

  it("'Change number' escapes back to /auth/login", () => {
    render(<CodeVerifyPage />);
    fireEvent.click(screen.getByRole("button", { name: /change number/i }));
    expect(navigate).toHaveBeenCalledWith("/auth/login");
  });

  it("redirects to /auth/login when there is no pending phone number", () => {
    sessionStorage.removeItem("cog:phone-e164");
    render(<CodeVerifyPage />);
    expect(navigate).toHaveBeenCalledWith("/auth/login", { replace: true });
  });
});
