import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The two founder-code kinds must NEVER collapse:
 *  - 'founder'         → server-side redemption RPC; success ONLY after it returns
 *                        true (a prior bug faked success on any string — guard it).
 *  - 'member_referral' → saves a discount for checkout ("Code applied"), no unlock.
 *  - invalid           → calm inline copy, no success screen.
 */

const navigate = vi.fn();
const validateCode = vi.fn();
const updateOnboardingStep = vi.fn(() => Promise.resolve());
const rpc = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/pricing/pricingApi", () => ({
  validateCode: (code: string, tier: string) => validateCode(code, tier),
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (step: string) => updateOnboardingStep(step),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (name: string, args: unknown) => rpc(name, args) },
}));

import FounderCodePage from "@/pages/onboarding/FounderCodePage";

const enterCode = (value: string) => {
  const input = screen.getByLabelText(/founder code/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /unlock access/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("FounderCodePage — two code kinds", () => {
  it("unlocks founder access only after the redemption RPC returns true", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "code-1" });
    rpc.mockResolvedValue({ data: true, error: null });
    render(<FounderCodePage />);
    enterCode("FOUNDER-X7K92Q");

    await waitFor(() => expect(screen.getByText(/founder access unlocked/i)).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("claim_founder_code_redemption", { _code_id: "code-1" });
    expect(sessionStorage.getItem("cog:referral-code")).toBeNull();
  });

  it("does NOT fake founder success when the RPC fails", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "code-1" });
    rpc.mockResolvedValue({ data: false, error: null });
    render(<FounderCodePage />);
    enterCode("FOUNDER-USED99");

    await waitFor(() => expect(screen.getByText(/couldn't be redeemed/i)).toBeInTheDocument());
    expect(screen.queryByText(/founder access unlocked/i)).not.toBeInTheDocument();
  });

  it("saves a referral code for checkout without unlocking founder access", async () => {
    validateCode.mockResolvedValue({ kind: "member_referral" });
    render(<FounderCodePage />);
    enterCode("FRIEND-2026");

    await waitFor(() => expect(screen.getByText(/code applied/i)).toBeInTheDocument());
    expect(sessionStorage.getItem("cog:referral-code")).toBe("FRIEND-2026");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows calm inline copy for an invalid code", async () => {
    validateCode.mockResolvedValue({ kind: "invalid", reason: "invalid_code" });
    render(<FounderCodePage />);
    enterCode("NOPE-000");

    await waitFor(() =>
      expect(screen.getByText(/that code didn't work/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/founder access unlocked/i)).not.toBeInTheDocument();
  });
});
