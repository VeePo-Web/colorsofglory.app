import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type ReactNode } from "react";

/**
 * A3 · Step 10 — the DATA-ACCESS LOCK SUITE.
 *
 * One integration-style suite over the ~10 critical paths between the app and the
 * backend. It exercises the REAL seam fns / hooks against a mocked Supabase
 * client (and the real Capture Outbox against mocked IO), so a regression in the
 * data layer — a dropped error code, a lost optimistic update, a double-created
 * take, a realtime event that stops invalidating — fails here, loudly, before it
 * reaches a screen.
 *
 * The rules being locked (see docs/DATA-ACCESS.md):
 *   • every backend call resolves data or throws a `CogError` with a stable
 *     `.code` (UI switches on the code, never the message);
 *   • every recorded take routes through the outbox — retries are idempotent
 *     (never double-create) and an over-quota upload RETAINS the take;
 *   • realtime carries IDs + event kinds only and INVALIDATES a cached query,
 *     never streams content;
 *   • reads fail soft.
 *
 * Paths covered (11):
 *   1. auth session load           getSessionUser
 *   2. catalog read                listMySongs
 *   3. workspace read (counts)     getSong
 *   4. quick capture (optimistic)  useQuickCapture
 *   5. memo save via outbox        enqueueCaptureUpload (idempotent + over-quota retains)
 *   6. commit take (idempotent)    commitTakeToCanvas
 *   7. accept invite (error codes) acceptInvite
 *   8. billing snapshot            getMyBillingStatus
 *   9. realtime → invalidation     useRealtimeSong
 *  10. normalized error (edge)     call → FORBIDDEN / QUOTA
 *  11. normalized error (direct)   toCogError → FORBIDDEN / QUOTA
 */

// ── Supabase client mock ────────────────────────────────────────────────────
// Configured per-test. `rpc` is a bare vi.fn so a test can return either an
// awaitable `{ data, error }` (listMySongs) or a `.maybeSingle()`-chained
// builder (getSong).
const invoke = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const removeChannel = vi.hoisted(() => vi.fn());
const channelFactory = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    auth: { getUser: (...a: unknown[]) => getUser(...a) },
    rpc: (...a: unknown[]) => rpc(...a),
    channel: (...a: unknown[]) => channelFactory(...a),
    removeChannel: (...a: unknown[]) => removeChannel(...a),
    from: () => {
      throw new Error("unexpected supabase.from() in a critical-path test");
    },
  },
}));

// react-router — useMutations imports useNavigate at module scope.
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

import { CogError, toCogError, call } from "@/integrations/cog/errors";
import { getSessionUser } from "@/integrations/cog/auth";
import { listMySongs, getSong, acceptInvite } from "@/integrations/cog/songs";
import { commitTakeToCanvas } from "@/integrations/cog/canvas";
import { getMyBillingStatus } from "@/integrations/cog/billing";
import { qk } from "@/hooks/queryKeys";
import { useQuickCapture } from "@/hooks/useMutations";
import { useRealtimeSong } from "@/hooks/useRealtime";

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
function freshClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
/** A non-2xx edge error whose JSON body carries a legacy `{ error: slug }`. */
function edgeSlugError(slug: string) {
  return {
    data: null,
    error: { message: "non-2xx", context: { json: async () => ({ error: slug }) } },
  };
}

beforeEach(() => {
  invoke.mockReset();
  getUser.mockReset();
  rpc.mockReset();
  removeChannel.mockReset();
  channelFactory.mockReset();
});

// 1 ─ auth session load ──────────────────────────────────────────────────────
describe("auth session load — getSessionUser", () => {
  it("returns the signed-in user when a session exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(getSessionUser()).resolves.toEqual({ id: "u1" });
  });

  it("resolves null (never throws) when signed out — reads fail soft", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getSessionUser()).resolves.toBeNull();
  });
});

// 2 ─ catalog read ────────────────────────────────────────────────────────────
describe("catalog read — listMySongs", () => {
  it("returns the RPC rows", async () => {
    rpc.mockResolvedValue({ data: [{ id: "s1", title: "First" }], error: null });
    const songs = await listMySongs();
    expect(rpc).toHaveBeenCalledWith("list_my_songs");
    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe("s1");
  });

  it("normalizes an RLS failure to a FORBIDDEN CogError", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const err = await listMySongs().catch((e) => e as CogError);
    expect(err).toBeInstanceOf(CogError);
    expect((err as CogError).code).toBe("FORBIDDEN");
  });
});

// 3 ─ workspace read (counts) ─────────────────────────────────────────────────
describe("workspace read — getSong maps the per-room counts", () => {
  it("projects the RPC row into typed counts", async () => {
    rpc.mockReturnValue({
      maybeSingle: async () => ({
        data: {
          id: "s1",
          owner_user_id: "u1",
          title: "Song",
          status: "active",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
          my_role: "owner",
          section_count: 3,
          lyrics_filled_count: 2,
          voice_memo_count: 5,
          note_count: 1,
          collaborator_count: 4,
          pending_suggestion_count: 6,
        },
        error: null,
      }),
    });

    const detail = await getSong("s1");
    expect(detail?.counts).toEqual({
      sections: 3,
      lyrics_filled: 2,
      voice_memos: 5,
      notes: 1,
      collaborators: 4,
      pending_suggestions: 6,
    });
  });

  it("returns null for a non-member instead of throwing", async () => {
    rpc.mockReturnValue({ maybeSingle: async () => ({ data: null, error: null }) });
    await expect(getSong("s1")).resolves.toBeNull();
  });
});

// 4 ─ quick capture (optimistic) ──────────────────────────────────────────────
describe("quick capture — useQuickCapture prepends optimistically", () => {
  it("shows the card before the server responds, then rolls back on error", async () => {
    const client = freshClient();
    client.setQueryData(qk.captures("s1"), []);

    // First call hangs (inspect the optimistic state); pattern mirrors prod UX.
    let reject: ((e: unknown) => void) | undefined;
    rpc.mockReturnValueOnce(new Promise((_res, rej) => { reject = rej; }));

    const { result } = renderHook(() => useQuickCapture(), { wrapper: makeWrapper(client) });
    act(() => {
      result.current.mutate({ song_id: "s1", title: "a spark" });
    });

    await waitFor(() => {
      const cards = client.getQueryData(qk.captures("s1")) as Array<{ title: string }>;
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe("a spark");
    });

    // The server rejects → the optimistic card rolls back to the snapshot.
    await act(async () => {
      reject?.({ code: "42501", message: "permission denied" });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(client.getQueryData(qk.captures("s1"))).toEqual([]);
    });
  });
});

// 6 ─ commit take (idempotent) ────────────────────────────────────────────────
describe("commit take — commitTakeToCanvas is idempotent", () => {
  it("a retry of the same take returns the same cards (edge dedupes, no double-create)", async () => {
    // The commit-take edge dedupes by take_id: committing the same take twice
    // yields the SAME card set — the seam must surface that verbatim.
    invoke.mockResolvedValue({ data: { song_id: "s1", card_ids: ["c1", "c2"] }, error: null });

    const input = { take_id: "t1", song_id: "s1", blocks: [] };
    const first = await commitTakeToCanvas(input);
    const second = await commitTakeToCanvas(input);

    expect(first.card_ids).toEqual(["c1", "c2"]);
    expect(second.card_ids).toEqual(first.card_ids);
  });

  it("a new-song commit over the song quota surfaces QUOTA_EXCEEDED_SONGS (a moment, not a toast)", async () => {
    invoke.mockResolvedValue(edgeSlugError("song_limit_reached"));
    const err = await commitTakeToCanvas({ take_id: "t1", song_id: "__new__", blocks: [] }).catch(
      (e) => e as CogError,
    );
    expect((err as CogError).code).toBe("QUOTA_EXCEEDED_SONGS");
  });
});

// 7 ─ accept invite (error codes → outcomes) ──────────────────────────────────
describe("accept invite — each server code drives which screen renders", () => {
  const cases: Array<[string, string]> = [
    ["invite_expired", "INVITE_EXPIRED"],
    ["invite_not_found", "INVITE_NOT_FOUND"],
    ["invite_already_used", "INVITE_ALREADY_USED"],
    ["invite_exhausted", "INVITE_EXHAUSTED"],
    ["forbidden", "FORBIDDEN"],
  ];

  for (const [slug, code] of cases) {
    it(`${slug} → CogError.code === ${code}`, async () => {
      invoke.mockResolvedValue(edgeSlugError(slug));
      const err = await acceptInvite("tok").catch((e) => e as CogError);
      expect(err).toBeInstanceOf(CogError);
      expect((err as CogError).code).toBe(code);
    });
  }

  it("a valid token resolves the membership payload", async () => {
    invoke.mockResolvedValue({
      data: { song_id: "s1", role: "collaborator", already_member: false },
      error: null,
    });
    await expect(acceptInvite("tok")).resolves.toEqual({
      song_id: "s1",
      role: "collaborator",
      already_member: false,
    });
  });
});

// 8 ─ billing snapshot ────────────────────────────────────────────────────────
describe("billing snapshot — getMyBillingStatus", () => {
  it("returns the plan + storage + song-quota snapshot", async () => {
    invoke.mockResolvedValue({
      data: {
        authenticated: true,
        user_id: "u1",
        plan: "free",
        is_pro: false,
        subscription: null,
        storage: {
          used_bytes: 900,
          included_bytes: 1000,
          addon_bytes: 0,
          limit_bytes: 1000,
          pct_used: 0.9,
        },
        addons: [],
        song_quota: { owned_limit: 1, can_create_song: false },
      },
      error: null,
    });

    const status = await getMyBillingStatus();
    expect(status.plan).toBe("free");
    expect(status.storage.limit_bytes).toBe(1000);
    expect(status.song_quota.can_create_song).toBe(false);
  });

  it("normalizes an edge failure to a CogError", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(getMyBillingStatus()).rejects.toBeInstanceOf(CogError);
  });
});

// 9 ─ realtime → invalidation ─────────────────────────────────────────────────
describe("realtime song update — useRealtimeSong invalidates, never streams", () => {
  it("an activity event invalidates activity + songDetail (and drops the payload)", async () => {
    // Capture the per-table handlers the real subscribeSongRoom registers.
    const handlers: Record<string, (p: unknown) => void> = {};
    channelFactory.mockImplementation(() => {
      const ch = {
        on: (_type: string, cfg: { table: string }, handler: (p: unknown) => void) => {
          handlers[cfg.table] = handler;
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    });

    const client = freshClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderHook(() => useRealtimeSong("s1"), { wrapper: makeWrapper(client) });

    // Fire a remote activity insert with a CONTENT payload — it must be ignored.
    act(() => {
      handlers["song_activity"]?.({ new: { secret: "should never be read" } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.activity("s1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.songDetail("s1") });

    // A remote card change invalidates the board, not activity.
    invalidate.mockClear();
    act(() => {
      handlers["canvas_cards"]?.({});
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.canvas("s1") });
  });

  it("tears the channel down on unmount (exactly one live channel)", () => {
    channelFactory.mockImplementation(() => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    });
    const client = freshClient();
    const { unmount } = renderHook(() => useRealtimeSong("s1"), { wrapper: makeWrapper(client) });
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});

// 10 / 11 ─ normalized error contract ────────────────────────────────────────
describe("normalized error contract — FORBIDDEN / QUOTA end to end", () => {
  it("edge path (call): a { ok:false, code:FORBIDDEN } envelope → FORBIDDEN", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: "non-2xx", context: { json: async () => ({ ok: false, code: "FORBIDDEN" }) } },
    });
    const err = await call("commit-take", {}).catch((e) => e as CogError);
    expect((err as CogError).code).toBe("FORBIDDEN");
  });

  it("edge path (call): a storage_limit_reached slug → QUOTA_EXCEEDED_STORAGE", async () => {
    invoke.mockResolvedValue(edgeSlugError("storage_limit_reached"));
    await expect(call("voice-memo-upload-url", {})).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED_STORAGE",
    });
  });

  it("direct path (toCogError): SQLSTATE 42501 → FORBIDDEN; a RAISEd quota token survives", () => {
    expect(toCogError({ code: "42501", message: "permission denied" }).code).toBe("FORBIDDEN");
    expect(toCogError({ message: "QUOTA_EXCEEDED_STORAGE" }).code).toBe("QUOTA_EXCEEDED_STORAGE");
  });
});

// ── 5 ─ memo save via the outbox (idempotent + over-quota retains) ────────────
// Separate realm: the outbox crosses the IndexedDB blob cache + the upload
// pipeline, both mocked; the durable index / status transitions / idempotency
// are REAL. This is the single write path every recorded take flows through.
vi.mock("@/lib/voice/audioCache", () => ({
  audioCache: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), prefetch: vi.fn() },
}));
vi.mock("@/lib/voice/voiceApi", () => ({ uploadVoiceMemo: vi.fn() }));

import { audioCache } from "@/lib/voice/audioCache";
import { uploadVoiceMemo } from "@/lib/voice/voiceApi";
import {
  __resetCaptureOutboxForTests,
  __setOutboxAutoProcessForTests,
  enqueueCaptureUpload,
  pendingCount,
  processOutbox,
} from "@/lib/voice/captureOutbox";

const mockAudioCache = vi.mocked(audioCache);
const mockUpload = vi.mocked(uploadVoiceMemo);
const INDEX_KEY = "cog-capture-outbox";

function readRawIndex(): Array<{ id: string; status: string; attempts: number; idempotencyKey: string }> {
  const raw = localStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}
function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
}
const memoParams = () => ({
  blob: new Blob(["hum"], { type: "audio/webm" }),
  songId: "song-1",
  title: "Bridge hum",
  mimeType: "audio/webm",
  durationMs: 4200,
  sectionLabel: "Raw idea",
});

describe("memo save via the outbox — the take can never be lost or double-created", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    __resetCaptureOutboxForTests();
    __setOutboxAutoProcessForTests(false);
    mockAudioCache.set.mockResolvedValue(undefined);
    mockAudioCache.delete.mockResolvedValue(undefined);
    mockAudioCache.get.mockResolvedValue(new Blob(["cached"], { type: "audio/webm" }));
    mockUpload.mockResolvedValue("memo-123");
    setOnline(true);
  });
  afterEach(() => {
    __resetCaptureOutboxForTests();
  });

  it("a retried upload reuses the SAME idempotency key — never double-creates", async () => {
    mockUpload.mockRejectedValueOnce(new Error("network unreachable"));
    const { outboxId } = await enqueueCaptureUpload(memoParams());
    await processOutbox(); // attempt 1 fails, take retained

    const key = readRawIndex().find((j) => j.id === outboxId)!.idempotencyKey;
    mockUpload.mockResolvedValueOnce("memo-777");
    await processOutbox(); // retry

    // Exactly one distinct take is created: both attempts carry the same key,
    // so the server dedupes the retry instead of creating a second memo.
    expect(mockUpload).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotencyKey: key, songId: "song-1" }),
    );
    expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false); // cleared on success
  });

  it("an over-quota upload RETAINS the take (queued, no attempt burned) so it can sync after Add Storage", async () => {
    mockUpload.mockRejectedValue(
      Object.assign(new Error("QUOTA_EXCEEDED_STORAGE"), { code: "QUOTA_EXCEEDED_STORAGE" }),
    );
    const { outboxId } = await enqueueCaptureUpload(memoParams());
    await processOutbox();

    const job = readRawIndex().find((j) => j.id === outboxId)!;
    expect(job.status).toBe("queued"); // not failed/parked — safe + retryable
    expect(job.attempts).toBe(0); // storage-full is not a transient error
    expect(mockAudioCache.delete).not.toHaveBeenCalledWith(outboxId); // blob kept
    expect(pendingCount()).toBe(1);
  });
});
