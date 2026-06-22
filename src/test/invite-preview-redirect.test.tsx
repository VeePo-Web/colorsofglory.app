import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { describe, it, expect } from "vitest";
import InvitePreviewPage from "@/pages/InvitePreviewPage";

// Probe stands in for the real /join/:token flow (InviteJoinPage).
const JoinProbe = () => {
  const { token } = useParams();
  return <div>join-flow:{token}</div>;
};
const JoinEntryProbe = () => <div>join-entry</div>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]} future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/invite/:token" element={<InvitePreviewPage />} />
        <Route path="/join/:token" element={<JoinProbe />} />
        <Route path="/join" element={<JoinEntryProbe />} />
      </Routes>
    </MemoryRouter>,
  );

describe("InvitePreviewPage — legacy /invite/:token redirect", () => {
  it("redirects the legacy invite URL into the real /join/:token flow with the token preserved", () => {
    renderAt("/invite/abc123XYZ");
    expect(screen.getByText("join-flow:abc123XYZ")).toBeInTheDocument();
  });

  it("never renders the old mock that hardcoded /songs/1", () => {
    renderAt("/invite/tok-9");
    expect(screen.queryByText(/Open song/i)).not.toBeInTheDocument();
    expect(screen.getByText("join-flow:tok-9")).toBeInTheDocument();
  });
});
