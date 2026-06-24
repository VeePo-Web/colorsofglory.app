import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
// EarnPage is the onboarding "Refer & Earn" screen. It must show the user's
// REAL referral link + REAL reward rate (from the same source as settings),
// and record the `referral_program_seen` onboarding step — never a demo link.

const fetchReferralStats = vi.fn();
const updateOnboardingStep = vi.fn((_step: string) => Promise.resolve());

vi.mock("@/lib/pricing/pricingApi", () => ({
  fetchReferralStats: () => fetchReferralStats(),
}));

vi.mock("@/integrations/cog/auth", () => ({
  useCurrentAccount: () => ({ profile: { referral_code: "REALCODE" } }),
}));

vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (s: string) => updateOnboardingStep(s),
}));

import EarnPage from "@/pages/onboarding/EarnPage";

const renderEarn = () =>
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <EarnPage />
    </MemoryRouter>,
  );

describe("EarnPage — onboarding Refer & Earn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records the referral_program_seen onboarding step on mount", async () => {
    fetchReferralStats.mockResolvedValue({ link: "colorsofglory.app/r/REALCODE", perReferralCents: 500 });
    renderEarn();
    expect(updateOnboardingStep).toHaveBeenCalledWith("referral_program_seen");
    // Flush the async stats fetch so the state update settles inside act().
    await waitFor(() => expect(fetchReferralStats).toHaveBeenCalled());
    await screen.findByText("colorsofglory.app/r/REALCODE");
  });

  it("shows the user's real referral link, never the demo code", async () => {
    fetchReferralStats.mockResolvedValue({ link: "colorsofglory.app/r/REALCODE", perReferralCents: 500 });
    renderEarn();
    expect(await screen.findByText("colorsofglory.app/r/REALCODE")).toBeInTheDocument();
    expect(screen.queryByText(/PARKER123/)).not.toBeInTheDocument();
  });

  it("scales the headline reward off the real backend rate", async () => {
    fetchReferralStats.mockResolvedValue({ link: "colorsofglory.app/r/REALCODE", perReferralCents: 1000 });
    renderEarn();
    // $10/mo per referral → headline tier (5,000) projects $600,000/yr.
    expect(await screen.findByText(/\$10 \/ month/)).toBeInTheDocument();
    expect(screen.getByText(/\$600,000 \/ year/)).toBeInTheDocument();
  });

  it("falls back to the profile referral code when stats are unavailable", async () => {
    fetchReferralStats.mockRejectedValue(new Error("offline"));
    renderEarn();
    expect(await screen.findByText("colorsofglory.app/r/REALCODE")).toBeInTheDocument();
  });
});
