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
  // The floating capture FAB is retired in favor of the BottomNav center capture
  // mic + each screen's own record action (CapCut "one obvious action"). It must
  // not appear on app screens — a second floating mic only creates duplicate /
  // overlapping record affordances. See GlobalCaptureFlow + CF1 mobile fixes.
  it.each([
    "/auth/login",
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
    "/", // capture home — the hero mic is the one action
    "/songs", // catalog — BottomNav carries the capture mic
    "/songs/1", // song detail (capture) — its own mic
    "/songs/1/room", // room has "Record memo"
    "/songs/1/canvas", // canvas owns its capture
    "/songs/1/practice",
  ])("does not show the floating capture FAB on %s", (path) => {
    renderGlobalCaptureAt(path);

    expect(
      screen.queryByRole("button", { name: /record a new idea/i }),
    ).not.toBeInTheDocument();
  });
});
