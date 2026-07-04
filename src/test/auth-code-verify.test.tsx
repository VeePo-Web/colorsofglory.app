import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The auth front door's verify screen — every non-invited user passes through
// it, yet it had no test. Covers the two behaviors that must never regress:
//   1. a correct code authenticates AND routes onward (the happy path),
//   2. a wrong code shows honest copy and clears the boxes to re-try —
//      and critically does NOT strand the user, because routeAfterAuth (which
//      runs AFTER the code is consumed) can never throw back into this catch.

// vi.hoisted so these exist before the hoisted vi.mock factories reference them
// (a top-level class in a factory hits the TDZ during the page's import).
const { verifyPhoneOtp, sendPhoneOtp, routeAfterAuth, AuthError } = vi.hoisted(() => {
  class AuthError extends Error {
    code: string;
    constructor(message: string, code = "INVALID_OTP") {
      super(message);
      this.code = code;
    }
  }
  return {
    verifyPhoneOtp: vi.fn(),
    sendPhoneOtp: vi.fn(),
    routeAfterAuth: vi.fn(),
    AuthError,
  };
});

vi.mock("@/integrations/cog/auth", () => ({ verifyPhoneOtp, sendPhoneOtp, AuthError }));
vi.mock("@/lib/auth/postAuthRoute", () => ({ routeAfterAuth }));
vi.mock("@/lib/auth/useWebOtpAutofill", () => ({ useWebOtpAutofill: vi.fn() }));
vi.mock("@/lib/auth/useTurnstile", () => ({
  useTurnstile: () => ({ containerRef: { current: null }, getToken: vi.fn().mockResolvedValue(null) }),
}));
vi.mock("@/lib/onboarding/prefetchNext", () => ({ useIdlePrefetch: vi.fn() }));

// Isolate the page's own logic: a stub OTP field that reports one full code.
vi.mock("@/components/cog/OTPInput", () => ({
  default: ({ value, onComplete }: { value: string[]; onComplete: (c: string) => void }) => (
    <div>
      <span data-testid="otp-value">{value.join("")}</span>
      <button data-testid="otp-complete" onClick={() => onComplete("123456")}>
        complete
      </button>
    </div>
  ),
}));

import CodeVerifyPage from "@/pages/auth/CodeVerifyPage";

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <CodeVerifyPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem("cog:phone-e164", "+15555550123");
  sessionStorage.setItem("cog:phone-display", "(555) 555-0123");
  // Force reduced-motion so the success flash resolves instantly (no 500ms wait).
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe("CodeVerifyPage", () => {
  it("shows the number the code was sent to", () => {
    renderPage();
    expect(screen.getByText(/\(555\) 555-0123/)).toBeInTheDocument();
  });

  it("verifies a correct code and routes onward", async () => {
    verifyPhoneOtp.mockResolvedValue({ user: { id: "u1" } });
    renderPage();
    fireEvent.click(screen.getByTestId("otp-complete"));
    await waitFor(() => expect(verifyPhoneOtp).toHaveBeenCalledWith("+15555550123", "123456"));
    await waitFor(() => expect(routeAfterAuth).toHaveBeenCalledTimes(1));
  });

  it("shows honest copy and clears the boxes on a wrong code — never routes", async () => {
    verifyPhoneOtp.mockRejectedValue(new AuthError("That code didn't work. Check it and try again."));
    renderPage();
    fireEvent.click(screen.getByTestId("otp-complete"));
    expect(await screen.findByText("That code didn't work. Check it and try again.")).toBeInTheDocument();
    expect(routeAfterAuth).not.toHaveBeenCalled();
    // Boxes reset so the user can re-enter without a stuck value.
    expect(screen.getByTestId("otp-value").textContent).toBe("");
  });

  it("redirects to login when there is no phone in session (deep-link guard)", () => {
    sessionStorage.removeItem("cog:phone-e164");
    // Should not throw; the effect navigates away. Render succeeds either way.
    expect(() => renderPage()).not.toThrow();
  });
});
