/**
 * E2 · Activity feed — the calm "what changed since you left".
 *
 * Guards the launch gates: the route is a real page (not a canvas redirect),
 * every activity kind renders calm content-free copy, the digest grouping
 * collapses repeats, the delta reads the prior last-seen BEFORE marking seen,
 * owner-only items hide from non-owners, and NO raw payload content leaks.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSong = vi.fn();
const getNotificationPrefs = vi.fn();
const getRecentActivity = vi.fn();
const listActivitySince = vi.fn();
const markSongSeen = vi.fn();
const getRecapDigest = vi.fn();
const listMembers = vi.fn();
const subscribeSongRoom = vi.fn(() => () => {});

vi.mock("@/integrations/cog/songs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/cog/songs")>();
  return {
    ...actual,
    getSong: (...args: unknown[]) => getSong(...args),
    getNotificationPrefs: (...args: unknown[]) => getNotificationPrefs(...args),
    getSongActivity: (...args: unknown[]) => getRecentActivity(...args),
  };
});
vi.mock("@/integrations/cog/activity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/integrations/cog/activity")>();
  return {
    ...actual,
    getRecentActivity: (...args: unknown[]) => getRecentActivity(...args),
    listActivitySince: (...args: unknown[]) => listActivitySince(...args),
    markSongSeen: (...args: unknown[]) => markSongSeen(...args),
    getRecapDigest: (...args: unknown[]) => getRecapDigest(...args),
  };
});
vi.mock("@/integrations/cog/members", () => ({
  listMembers: (...args: unknown[]) => listMembers(...args),
}));
vi.mock("@/integrations/cog/realtime", () => ({
  subscribeSongRoom: (...args: unknown[]) => subscribeSongRoom(...args),
}));

import ActivityPage from "@/pages/ActivityPage";
import {
  ACTIVITY_KIND_COPY,
  activityHref,
  activitySentence,
} from "@/components/activity/activityCopy";
import { groupRows } from "@/components/activity/useActivityFeed";
import type { SongActivityKind } from "@/integrations/cog/activity";

const ALL_KINDS: SongActivityKind[] = [
  "take_committed",
  "capture_created",
  "capture_promoted",
  "memo_uploaded",
  "memo_finalized",
  "memo_transcribed",
  "invite_accepted",
  "member_left",
  "owner_transferred",
  "card_moved",
  "card_linked",
  "card_unlinked",
  "card_grouped",
  "card_section_set",
  "card_promoted_final",
  "card_deleted",
];

// ---------- the copy contract (Step 3) ----------

describe("activity kind → calm copy map", () => {
  it("covers every SongActivityKind with a calm, content-free sentence", () => {
    for (const kind of ALL_KINDS) {
      expect(ACTIVITY_KIND_COPY[kind], `missing copy for ${kind}`).toBeDefined();
      const single = activitySentence(kind, "Sarah", 1);
      const grouped = activitySentence(kind, "Sarah", 3);
      for (const sentence of [single, grouped]) {
        expect(sentence).toBeTruthy();
        expect(sentence).toContain("Sarah");
        expect(sentence).not.toMatch(/undefined|null|NaN/);
        expect(sentence).not.toContain("_"); // no raw kind slugs in copy
      }
    }
  });

  it("falls back calmly for unknown kinds and unknown actors", () => {
    expect(activitySentence("some_future_kind", null, 1)).toBe("Someone made a change");
    expect(activitySentence("memo_uploaded", null, 2)).toBe("Someone added 2 voice memos");
  });

  it("deep-links every kind to a real song surface", () => {
    for (const kind of ALL_KINDS) {
      expect(activityHref("s1", kind)).toMatch(
        /^\/songs\/s1\/(voice|people|canvas|room)$/,
      );
    }
  });
});

// ---------- client-side grouping for the "Earlier" section (Step 5) ----------

describe("groupRows — calm folding of repeats", () => {
  const row = (id: string, action: string, at: string, actor = "u1", name = "Sarah") => ({
    id,
    created_at: at,
    action,
    entity_type: "voice_memo",
    entity_id: null,
    actor_user_id: actor,
    actor_name: name,
    actor_color: "#53AB8B",
    payload: {},
  });

  it("folds same actor+kind within the window into one counted group", () => {
    const groups = groupRows(
      [
        row("1", "memo_uploaded", "2026-07-06T10:00:00Z"),
        row("2", "memo_uploaded", "2026-07-06T10:20:00Z"),
        row("3", "capture_created", "2026-07-06T10:10:00Z"),
      ],
      new Map(),
    );
    expect(groups).toHaveLength(2);
    const memos = groups.find((g) => g.kind === "memo_uploaded");
    expect(memos?.count).toBe(2);
  });

  it("keeps different actors apart", () => {
    const groups = groupRows(
      [
        row("1", "memo_uploaded", "2026-07-06T10:00:00Z", "u1", "Sarah"),
        row("2", "memo_uploaded", "2026-07-06T10:05:00Z", "u2", "Caleb"),
      ],
      new Map(),
    );
    expect(groups).toHaveLength(2);
  });
});

// ---------- the route (Step 1) ----------

describe("route — /songs/:id/activity is a real, guarded page", () => {
  // The route tree lives inline in App.tsx (rendering <App/> here would drag
  // in the PasswordGate + auth machine), so guard the route contract at the
  // source level: the activity path must mount RequireAuth→ActivityPage and
  // must never regress to the old CanvasLayerRedirect.
  it("mounts RequireAuth→ActivityPage instead of redirecting to the canvas", () => {
    const appSource = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    const routeLine = appSource
      .split("\n")
      .find((line) => line.includes('path="/songs/:id/activity"'));
    expect(routeLine, "activity route missing from App.tsx").toBeTruthy();
    expect(routeLine).toContain("<RequireAuth>");
    expect(routeLine).toContain("<ActivityPage />");
    expect(routeLine).not.toContain("CanvasLayerRedirect");
  });
});

// ---------- the page end-to-end in jsdom (Steps 2, 4, 8 + the content rule) ----------

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: "s1",
  owner_user_id: "u-parker",
  title: "River of Mercy",
  status: "active",
  key_signature: null,
  tempo_bpm: null,
  time_signature: null,
  tags: null,
  cover_color: null,
  is_locked: false,
  last_activity_at: null,
  created_at: "",
  updated_at: "",
  lyrics_snippet: null,
  my_role: "owner",
  counts: {
    sections: 0,
    lyrics_filled: 0,
    voice_memos: 2,
    notes: 0,
    collaborators: 2,
    pending_suggestions: 2,
  },
  ...overrides,
});

const LAST_SEEN = "2026-07-06T00:00:00Z";

const seedHappyPath = () => {
  getSong.mockResolvedValue(detail());
  getNotificationPrefs.mockResolvedValue({
    user_id: "u-parker",
    song_id: "s1",
    notify_on_join: true,
    notify_on_contribution: true,
    push_enabled: false,
    last_seen_at: LAST_SEEN,
  });
  markSongSeen.mockResolvedValue(undefined);
  getRecentActivity.mockResolvedValue([
    {
      id: "a1",
      created_at: "2026-07-06T12:00:00Z", // since you left
      action: "memo_uploaded",
      entity_type: "voice_memo",
      entity_id: "m1",
      actor_user_id: "u-sarah",
      actor_name: "Sarah M",
      actor_color: "#53AB8B",
      payload: { note: "Grace in the storm" }, // must NEVER render
    },
    {
      id: "a2",
      created_at: "2026-07-05T09:00:00Z", // earlier
      action: "invite_accepted",
      entity_type: "member",
      entity_id: null,
      actor_user_id: "u-caleb",
      actor_name: "Caleb R",
      actor_color: "#8070C4",
      payload: {},
    },
  ]);
  listActivitySince.mockResolvedValue([
    {
      kind: "memo_uploaded",
      actor_user_id: "u-sarah",
      event_count: 2,
      last_at: "2026-07-06T12:00:00Z",
      sample_entity_ids: ["m1"],
    },
  ]);
  listMembers.mockResolvedValue([
    {
      user_id: "u-sarah",
      role: "collaborator",
      joined_at: "",
      display_name: "Sarah M",
      first_name: "Sarah",
      avatar_url: null,
      avatar_color: "#53AB8B",
      initials: "SM",
    },
  ]);
  getRecapDigest.mockResolvedValue({ digest: "", rows: [] });
};

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter
        initialEntries={["/songs/s1/activity"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/songs/:id/activity" element={<ActivityPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("ActivityPage — real feed, calm and content-safe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the grouped since-you-left delta with a real count — and leaks no content", async () => {
    seedHappyPath();
    renderPage();

    // Digest grouping: "Sarah M added 2 voice memos", one card, not two rows.
    expect(await screen.findByText("Sarah M added 2 voice memos")).toBeInTheDocument();
    expect(screen.getByText("Since you left")).toBeInTheDocument();
    expect(screen.getByText("River of Mercy · 2 changes")).toBeInTheDocument();

    // The earlier group sits under its own divider.
    expect(screen.getByText("Earlier")).toBeInTheDocument();
    expect(screen.getByText("Caleb R joined the song")).toBeInTheDocument();

    // THE CONTENT RULE: raw payload text never renders.
    expect(screen.queryByText(/Grace in the storm/)).not.toBeInTheDocument();

    // Owner sees the pending-review rollup (link-only).
    expect(screen.getByText("2 ideas are waiting for your review")).toBeInTheDocument();

    // Calm intelligence: no red badge anywhere (no destructive/red styling hooks).
    expect(document.querySelector('[class*="bg-red"], [class*="text-red"]')).toBeNull();
  });

  it("reads the prior last-seen BEFORE marking the song seen (never mark-then-read)", async () => {
    seedHappyPath();
    renderPage();
    await screen.findByText("Sarah M added 2 voice memos");

    expect(getNotificationPrefs).toHaveBeenCalled();
    expect(markSongSeen).toHaveBeenCalledWith("s1");
    const readOrder = getNotificationPrefs.mock.invocationCallOrder[0];
    const markOrder = markSongSeen.mock.invocationCallOrder[0];
    expect(readOrder).toBeLessThan(markOrder);

    // The delta used the PRIOR timestamp, not the fresh mark.
    expect(listActivitySince).toHaveBeenCalledWith("s1", LAST_SEEN);
  });

  it("hides owner-only review items from a viewer", async () => {
    seedHappyPath();
    getSong.mockResolvedValue(detail({ my_role: "viewer" }));
    renderPage();

    await screen.findByText("Sarah M added 2 voice memos");
    expect(screen.queryByText(/waiting for your review/)).not.toBeInTheDocument();
  });

  it("shows the warm empty state on a song with no activity", async () => {
    seedHappyPath();
    getRecentActivity.mockResolvedValue([]);
    listActivitySince.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nothing's changed yet")).toBeInTheDocument();
    expect(
      screen.getByText(/Invite someone in or start writing/),
    ).toBeInTheDocument();
  });

  it("subscribes to the song room for calm realtime and cleans up on unmount", async () => {
    seedHappyPath();
    const { unmount } = renderPage();
    await screen.findByText("Sarah M added 2 voice memos");

    expect(subscribeSongRoom).toHaveBeenCalledTimes(1);
    expect(subscribeSongRoom.mock.calls[0][0]).toBe("s1");
    unmount();
    // On the way out we mark seen again so watched-live events don't reappear.
    expect(markSongSeen.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
