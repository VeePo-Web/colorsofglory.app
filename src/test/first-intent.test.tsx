import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const navigate = vi.fn();
const updateOnboardingStep = vi.fn((_s: string) => Promise.resolve());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/lib/invite/inviteApi", () => ({
  updateOnboardingStep: (s: string) => updateOnboardingStep(s),
}));

import FirstIntentPage from "@/pages/onboarding/FirstIntentPage";

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <FirstIntentPage />
    </MemoryRouter>,
  );

describe("FirstIntentPage — route by intent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a founder/beta code holder to the founder-code screen (no longer orphaned)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /founder or beta code/i }));
    expect(navigate).toHaveBeenCalledWith("/onboarding/founder-code");
  });

  it("starts a song: records intent and routes to start-song", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /start a song/i }));
    expect(updateOnboardingStep).toHaveBeenCalledWith("intent_selected");
    expect(navigate).toHaveBeenCalledWith("/onboarding/start-song");
  });

  it("joins a song: routes to the join entry", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /join a song/i }));
    expect(navigate).toHaveBeenCalledWith("/join");
  });
});
