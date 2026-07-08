import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// FounderCodePage must really validate a code (validate-code) and, for a real
// founder code, redeem it (claim_founder_code_redemption) before claiming
// "Founder access unlocked" — previously ANY non-empty string faked success.

const navigate = vi.fn();
const validateCode = vi.fn();
const rpc = vi.fn();
const updateOnboardingStep = vi.fn((_step: string) => Promise.resolve());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/pricing/pricingApi", () => ({
  validateCode: (code: string, plan?: string) => validateCode(code, plan),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) },
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (s: string) => updateOnboardingStep(s),
}));

import FounderCodePage from "@/pages/onboarding/FounderCodePage";

const typeCode = (value: string) =>
  fireEvent.change(screen.getByLabelText("Founder code"), { target: { value } });
const clickUnlock = () => fireEvent.click(screen.getByRole("button", { name: /unlock access/i }));

describe("FounderCodePage — real validation + redemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("redeems a valid founder code and only then shows access unlocked", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "cid-1" });
    rpc.mockResolvedValue({ data: true, error: null });

    render(<FounderCodePage />);
    typeCode("FOUNDER-X7K92Q");
    clickUnlock();

    await screen.findByText("Founder access unlocked");
    expect(rpc).toHaveBeenCalledWith("claim_founder_code_redemption", { _code_id: "cid-1" });
    expect(updateOnboardingStep).toHaveBeenCalledWith("founder_code_seen");
  });

  it("shows a real error for an invalid code and never fakes success", async () => {
    validateCode.mockResolvedValue({ kind: "invalid", reason: "invalid_code" });

    render(<FounderCodePage />);
    typeCode("NOPENOPE");
    clickUnlock();

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't work/i);
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.queryByText("Founder access unlocked")).not.toBeInTheDocument();
  });

  it("does not unlock founder access if redemption fails", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "cid-2" });
    rpc.mockResolvedValue({ data: false, error: null });

    render(<FounderCodePage />);
    typeCode("USEDCODE");
    clickUnlock();

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be redeemed/i);
    expect(screen.queryByText("Founder access unlocked")).not.toBeInTheDocument();
  });

  it("carries a member-referral code to checkout instead of unlocking founder access", async () => {
    validateCode.mockResolvedValue({ kind: "member_referral", referrerUserId: "u-9" });

    render(<FounderCodePage />);
    typeCode("FRIEND50");
    clickUnlock();

    await screen.findByText("Code applied");
    expect(sessionStorage.getItem("cog:referral-code")).toBe("FRIEND50");
    expect(rpc).not.toHaveBeenCalled();
  });
});
