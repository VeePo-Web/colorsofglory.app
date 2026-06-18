import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import GlobalCaptureFlow from "@/components/capture/GlobalCaptureFlow";

const renderGlobalCaptureAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <GlobalCaptureFlow />
    </MemoryRouter>,
  );

describe("GlobalCaptureFlow route policy", () => {
  it.each([
    "/auth/login",
    "/auth/phone",
    "/auth/phone/verify",
    "/auth/verify",
    "/onboarding/intent",
    "/join/song-invite-token",
    "/invite/verify",
    "/upgrade",
    "/pricing",
    "/checkout/success",
    "/settings",
    "/admin",
    "/capture",
    "/songs/1/capture",
  ])("does not show the capture action on %s", (path) => {
    renderGlobalCaptureAt(path);

    expect(screen.queryByRole("button", { name: /record a new idea/i })).not.toBeInTheDocument();
  });

  it.each(["/", "/songs/1", "/songs/1/practice"])(
    "shows the capture action on creative workspace route %s",
    (path) => {
      renderGlobalCaptureAt(path);

      expect(screen.getByRole("button", { name: /record a new idea/i })).toBeInTheDocument();
    },
  );
});
