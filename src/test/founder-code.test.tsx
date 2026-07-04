import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// A founder who unlocks access taps a button labelled "Start a song" — it must
// take them to their song, never to the referral-earnings screen. (The label
// once pointed at /onboarding/earn: a mismatch that broke the North Star of
// getting a new user into their first song.)

const navigate = vi.fn();
const validateCode = vi.fn();
const rpc = vi.fn();
const updateOnboardingStep = vi.fn(() => Promise.resolve());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("@/lib/pricing/pricingApi", () => ({ validateCode: (...a: unknown[]) => validateCode(...a) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("@/lib/invite/inviteApi", () => ({ updateOnboardingStep: () => updateOnboardingStep() }));

import FounderCodePage from "@/pages/onboarding/FounderCodePage";

const enterCodeAndUnlock = (value: string) => {
  fireEvent.change(screen.getByLabelText("Founder code"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: /unlock access/i }));
};

describe("FounderCodePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("sends a redeemed founder to Start-a-song, not the earn screen", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "c1" });
    rpc.mockResolvedValue({ data: true, error: null });

    render(<FounderCodePage />);
    enterCodeAndUnlock("FOUNDER-X7K92Q");

    // Success state appears.
    expect(await screen.findByText(/Founder access unlocked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start a song/i }));
    expect(navigate).toHaveBeenCalledWith("/onboarding/start-song");
    expect(navigate).not.toHaveBeenCalledWith("/onboarding/earn");
  });

  it("shows a friendly error when a founder code cannot be redeemed", async () => {
    validateCode.mockResolvedValue({ kind: "founder", codeId: "c1" });
    rpc.mockResolvedValue({ data: false, error: null });

    render(<FounderCodePage />);
    enterCodeAndUnlock("FOUNDER-USED1");

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be redeemed/i);
    expect(navigate).not.toHaveBeenCalled();
  });
});
