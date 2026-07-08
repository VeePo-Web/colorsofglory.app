import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { type ReactNode } from "react";

// A3 · Step 7 — the mutation-hook seam. Mock only the cog seam fns + the outbox
// save; assert each hook's contract: quota MOMENT (not toast), optimistic +
// no-refetch card move, invalidation targets, CogError-code surfacing, and the
// single durable memo-save path.

const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateSpy }));

vi.mock("@/integrations/cog/songs", () => ({
  createSong: vi.fn(),
  createInvite: vi.fn(),
  acceptInvite: vi.fn(),
}));
vi.mock("@/integrations/cog/capture", () => ({ quickCapture: vi.fn() }));
vi.mock("@/integrations/cog/canvas", () => ({
  commitTakeToCanvas: vi.fn(),
  moveCard: vi.fn(),
  bulkMoveCards: vi.fn(),
}));
vi.mock("@/lib/voice/saveMemo", () => ({ saveMemoDurable: vi.fn() }));
vi.mock("@/lib/voice/captureOutbox", () => ({ subscribeOutbox: vi.fn(() => () => {}) }));

import { CogError } from "@/integrations/cog/errors";
import { qk } from "@/hooks/queryKeys";
import { createSong, acceptInvite } from "@/integrations/cog/songs";
import { quickCapture } from "@/integrations/cog/capture";
import { commitTakeToCanvas, moveCard } from "@/integrations/cog/canvas";
import { saveMemoDurable } from "@/lib/voice/saveMemo";
import {
  useCreateSong,
  useQuickCapture,
  useCommitTake,
  useMoveCard,
  useAcceptInvite,
} from "@/hooks/useMutations";
import { useMemoSave } from "@/hooks/useMemoSave";

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCreateSong", () => {
  it("on success invalidates catalog + billing and calls onCreated", async () => {
    const client = freshClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(createSong).mockResolvedValue({ song: { id: "s1", title: "New" } } as never);
    const onCreated = vi.fn();

    const { result } = renderHook(() => useCreateSong({ onCreated }), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ title: "New" });
    });

    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.songs() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.billing() });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("QUOTA_EXCEEDED_SONGS drives a redirect to /upgrade, not a toast", async () => {
    const client = freshClient();
    vi.mocked(createSong).mockRejectedValue(new CogError("QUOTA_EXCEEDED_SONGS"));

    const { result } = renderHook(() => useCreateSong(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ title: "Second" }).catch(() => {});
    });

    expect(navigateSpy).toHaveBeenCalledWith("/upgrade?source=song_gate");
  });
});

describe("useQuickCapture", () => {
  it("optimistically prepends the capture card", async () => {
    const client = freshClient();
    client.setQueryData(qk.captures("s1"), []);
    // Never resolve — we only inspect the optimistic (onMutate) state.
    vi.mocked(quickCapture).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useQuickCapture(), { wrapper: makeWrapper(client) });
    act(() => {
      result.current.mutate({ song_id: "s1", title: "a spark" });
    });

    await waitFor(() => {
      const cards = client.getQueryData(qk.captures("s1")) as Array<{ title: string }>;
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe("a spark");
    });
  });
});

describe("useCommitTake", () => {
  it("invalidates canvas + activity for the committed song (idempotent path)", async () => {
    const client = freshClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(commitTakeToCanvas).mockResolvedValue({ song_id: "s1", card_ids: ["c1"] });

    const { result } = renderHook(() => useCommitTake(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ take_id: "t1", song_id: "s1", blocks: [] });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.canvas("s1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.activity("s1") });
  });
});

describe("useMoveCard", () => {
  it("applies the move optimistically and does NOT refetch the board on success", async () => {
    const client = freshClient();
    client.setQueryData(qk.canvas("s1"), [{ id: "c1", x: 0, y: 0, z_index: 1 }]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(moveCard).mockResolvedValue({ id: "c1" } as never);

    const { result } = renderHook(() => useMoveCard("s1"), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ cardId: "c1", x: 120, y: 44 });
    });

    const cards = client.getQueryData(qk.canvas("s1")) as Array<{ x: number; y: number }>;
    expect(cards[0]).toMatchObject({ x: 120, y: 44 });
    // No invalidation on success == no full-board refetch.
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("rolls back and resyncs on a failed move", async () => {
    const client = freshClient();
    client.setQueryData(qk.canvas("s1"), [{ id: "c1", x: 0, y: 0, z_index: 1 }]);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    vi.mocked(moveCard).mockRejectedValue(new CogError("FORBIDDEN"));

    const { result } = renderHook(() => useMoveCard("s1"), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({ cardId: "c1", x: 120, y: 44 }).catch(() => {});
    });

    const cards = client.getQueryData(qk.canvas("s1")) as Array<{ x: number }>;
    expect(cards[0].x).toBe(0); // rolled back to snapshot
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.canvas("s1") });
  });
});

describe("useAcceptInvite", () => {
  it("surfaces the CogError code (which screen to render), never a message", async () => {
    const client = freshClient();
    vi.mocked(acceptInvite).mockRejectedValue(new CogError("INVITE_EXPIRED"));

    const { result } = renderHook(() => useAcceptInvite(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync("tok").catch(() => {});
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect((result.current.error as CogError).code).toBe("INVITE_EXPIRED");
  });
});

describe("useMemoSave", () => {
  it("routes the take through the single durable save (saveMemoDurable → outbox)", async () => {
    const client = freshClient();
    vi.mocked(saveMemoDurable).mockResolvedValue({
      outboxId: "o1",
      optimistic: { id: "o1" } as never,
    });

    const { result } = renderHook(() => useMemoSave(), { wrapper: makeWrapper(client) });
    await act(async () => {
      await result.current.mutateAsync({
        blob: new Blob(["x"]),
        songId: "s1",
        title: "hum",
        mimeType: "audio/webm",
        durationMs: 1200,
        sectionLabel: "Raw idea",
      });
    });

    expect(saveMemoDurable).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.data?.outboxId).toBe("o1"));
  });
});
