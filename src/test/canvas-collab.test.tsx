import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActivitySince = vi.fn();
const markSongSeen = vi.fn().mockResolvedValue(undefined);

vi.mock("@/integrations/cog/activity", () => ({
  getActivitySince: (songId: string, since: string | null) => getActivitySince(songId, since),
  markSongSeen: (songId: string) => markSongSeen(songId),
}));

vi.mock("@/hooks/useCurrentAccount", () => ({
  useCurrentAccount: () => ({
    loading: false,
    user: { id: "me" },
    profile: null,
    isAdmin: false,
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import CanvasRecapGate from "@/components/canvas/CanvasRecapGate";

const renderWithQuery = (ui: ReactElement) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

const activityRow = (overrides: Record<string, unknown> = {}) => ({
  id: Math.random().toString(36).slice(2),
  created_at: new Date().toISOString(),
  action: "memo_uploaded",
  entity_type: "voice_memo",
  entity_id: "m1",
  actor_user_id: "u-other",
  actor_name: "Levi",
  actor_color: "#8070C4",
  payload: {},
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("CanvasRecapGate — 'what changed since you left' (Product 12)", () => {
  it("stays silent on a first visit and records the visit anchor", async () => {
    renderWithQuery(<CanvasRecapGate songId="song1" />);

    expect(screen.queryByText("What changed since you left")).not.toBeInTheDocument();
    expect(getActivitySince).not.toHaveBeenCalled();
    expect(localStorage.getItem("cog:canvas-last-visit-song1")).toBeTruthy();
    expect(markSongSeen).toHaveBeenCalledWith("song1");
  });

  it("shows a capped digest of OTHERS' changes on return", async () => {
    localStorage.setItem("cog:canvas-last-visit-song1", "2026-07-01T00:00:00.000Z");
    getActivitySince.mockResolvedValue([
      activityRow(),
      activityRow(),
      activityRow({ action: "card_promoted_final" }),
      activityRow({ actor_user_id: "me", actor_name: "Me" }), // own change — hidden
    ]);

    renderWithQuery(<CanvasRecapGate songId="song1" />);

    expect(await screen.findByText("What changed since you left")).toBeInTheDocument();
    expect(await screen.findByText("Levi added 2 voice memos")).toBeInTheDocument();
    expect(screen.getByText("Levi moved an idea into Final")).toBeInTheDocument();
    expect(screen.queryByText(/^Me /)).not.toBeInTheDocument();
    expect(getActivitySince).toHaveBeenCalledWith("song1", "2026-07-01T00:00:00.000Z");
  });

  it("stays silent when only YOU changed things since last visit", async () => {
    localStorage.setItem("cog:canvas-last-visit-song1", "2026-07-01T00:00:00.000Z");
    getActivitySince.mockResolvedValue([
      activityRow({ actor_user_id: "me", actor_name: "Me" }),
    ]);

    renderWithQuery(<CanvasRecapGate songId="song1" />);

    // Let the query resolve, then confirm calm silence.
    await waitFor(() =>
      expect(getActivitySince).toHaveBeenCalledWith("song1", "2026-07-01T00:00:00.000Z"),
    );
    expect(screen.queryByText("What changed since you left")).not.toBeInTheDocument();
  });
});
