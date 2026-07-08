import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two boundaries the outbox crosses: the IndexedDB blob cache and the
// network upload pipeline. Everything else (the durable index, status
// transitions, retain-on-failure, idempotency) is real — that is the contract
// that makes "a captured take is never lost" actually true.
vi.mock("./audioCache", () => ({
  audioCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock("./voiceApi", () => ({
  uploadVoiceMemo: vi.fn(),
}));

import { audioCache } from "./audioCache";
import { uploadVoiceMemo } from "./voiceApi";
import {
  __resetCaptureOutboxForTests,
  __setOutboxAutoProcessForTests,
  enqueueCaptureUpload,
  pendingCount,
  processOutbox,
  registerOutboxUploader,
  retryOutbox,
  subscribeOutbox,
  type OutboxEvent,
  type OutboxJob,
} from "./captureOutbox";

function setOnline(online: boolean): void {
  // jsdom ignores a value redefine of navigator.onLine — override the getter.
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
}

const mockAudioCache = vi.mocked(audioCache);
const mockUpload = vi.mocked(uploadVoiceMemo);

const INDEX_KEY = "cog-capture-outbox";

function readRawIndex(): Array<{ id: string; status: string; attempts: number; idempotencyKey: string }> {
  const raw = localStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

function makeBlob(content = "hum"): Blob {
  return new Blob([content], { type: "audio/webm" });
}

const baseParams = (overrides: Partial<Parameters<typeof enqueueCaptureUpload>[0]> = {}) => ({
  blob: makeBlob(),
  songId: "song-1",
  title: "Bridge hum",
  mimeType: "audio/webm",
  durationMs: 4200,
  sectionLabel: "Raw idea",
  ...overrides,
});

describe("captureOutbox — the in-song save can never lose a take", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    __resetCaptureOutboxForTests();
    // Drive processing explicitly so specs never race a background attempt.
    __setOutboxAutoProcessForTests(false);
    mockAudioCache.set.mockResolvedValue(undefined);
    mockAudioCache.delete.mockResolvedValue(undefined);
    mockAudioCache.get.mockResolvedValue(makeBlob("cached audio"));
    mockUpload.mockResolvedValue("memo-123");
    setOnline(true);
  });

  afterEach(() => {
    __resetCaptureOutboxForTests();
  });

  describe("enqueue — the sacred promise", () => {
    it("caches the blob BEFORE persisting the job (durable even if the tab closes a moment later)", async () => {
      let cachedBeforeIndex = false;
      mockAudioCache.set.mockImplementation(async (id: string) => {
        // At the moment the blob is cached, the index must not yet hold the job —
        // proving the blob is durable before anything else can fail.
        cachedBeforeIndex = readRawIndex().every((j) => j.id !== id);
      });

      const blob = makeBlob("the recorded idea");
      const { outboxId } = await enqueueCaptureUpload(baseParams({ blob }));

      expect(mockAudioCache.set).toHaveBeenCalledWith(outboxId, blob);
      expect(cachedBeforeIndex).toBe(true);

      // The job is durably persisted with a stable idempotency key.
      const persisted = readRawIndex();
      expect(persisted.some((j) => j.id === outboxId)).toBe(true);
      const job = persisted.find((j) => j.id === outboxId)!;
      expect(job.idempotencyKey.length).toBeGreaterThan(0);
    });

    it("passes a stable idempotency key so a retried take never double-creates", async () => {
      mockUpload.mockRejectedValueOnce(new Error("network unreachable"));
      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox(); // first attempt fails

      // First attempt failed → job retained with its key.
      const afterFail = readRawIndex().find((j) => j.id === outboxId)!;
      const key = afterFail.idempotencyKey;
      expect(afterFail.status).toBe("failed");

      // Retry succeeds — and reuses the SAME idempotency key.
      mockUpload.mockResolvedValueOnce("memo-777");
      await processOutbox();

      expect(mockUpload).toHaveBeenLastCalledWith(
        expect.objectContaining({ idempotencyKey: key, songId: "song-1" }),
      );
    });
  });

  describe("success path", () => {
    it("uploads the cached blob, then releases the outbox copy + job and announces the real memo id", async () => {
      const events: OutboxEvent[] = [];
      subscribeOutbox((e) => events.push(e));

      mockAudioCache.get.mockResolvedValue(makeBlob("cached audio"));
      mockUpload.mockResolvedValue("memo-real-9");

      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox();

      // The take's real id gets the blob cached for instant first playback...
      expect(mockAudioCache.set).toHaveBeenCalledWith("memo-real-9", expect.any(Blob));
      // ...the outbox copy + job are cleared...
      expect(mockAudioCache.delete).toHaveBeenCalledWith(outboxId);
      expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false);
      expect(pendingCount()).toBe(0);
      // ...and a success event names the real memo id for the UI to swap in.
      expect(events).toContainEqual(
        expect.objectContaining({ type: "success", outboxId, memoId: "memo-real-9" }),
      );
    });
  });

  describe("failure path — retain, never discard", () => {
    it("keeps the take + job and the cached blob when the upload fails, and emits willRetry", async () => {
      const events: OutboxEvent[] = [];
      subscribeOutbox((e) => events.push(e));
      mockUpload.mockRejectedValue(new Error("network unreachable"));

      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox();

      // The idea is STILL SAFE: job retained, cache never deleted.
      const job = readRawIndex().find((j) => j.id === outboxId);
      expect(job).toBeDefined();
      expect(job!.status).toBe("failed");
      expect(job!.attempts).toBeGreaterThanOrEqual(1);
      expect(mockAudioCache.delete).not.toHaveBeenCalledWith(outboxId);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "failed", outboxId, willRetry: true }),
      );
    });

    it("recovers automatically: a queued take uploads cleanly once the network returns", async () => {
      mockUpload.mockRejectedValueOnce(new Error("offline"));
      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox(); // first attempt fails
      expect(readRawIndex().find((j) => j.id === outboxId)!.status).toBe("failed");

      mockUpload.mockResolvedValueOnce("memo-recovered");
      await retryOutbox();

      expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false);
      expect(mockUpload).toHaveBeenLastCalledWith(expect.objectContaining({ songId: "song-1" }));
    });
  });

  describe("storage full — retain and retry, exactly like offline", () => {
    it("keeps the take QUEUED without burning an attempt, and signals quota_storage so the UI can prompt 'Add storage'", async () => {
      const events: OutboxEvent[] = [];
      subscribeOutbox((e) => events.push(e));
      // The seam throws a CogError-shaped object with the storage-quota code.
      mockUpload.mockRejectedValue(
        Object.assign(new Error("QUOTA_EXCEEDED_STORAGE"), { code: "QUOTA_EXCEEDED_STORAGE" }),
      );

      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox();

      const job = readRawIndex().find((j) => j.id === outboxId);
      // The idea is SAFE: retained, blob never deleted...
      expect(job).toBeDefined();
      expect(mockAudioCache.delete).not.toHaveBeenCalledWith(outboxId);
      expect(pendingCount()).toBe(1);
      // ...and — unlike a normal upload failure — it stays QUEUED and does NOT
      // burn an attempt toward parking (storage-full isn't a transient error).
      expect(job!.status).toBe("queued");
      expect(job!.attempts).toBe(0);
      // The failed event carries the quota reason + willRetry, so the surface can
      // show "Saved · will sync" and an "Add storage" prompt instead of an alarm.
      expect(events).toContainEqual(
        expect.objectContaining({ type: "failed", outboxId, willRetry: true, reason: "quota_storage" }),
      );
    });

    it("syncs the retained take automatically once storage is added (no data loss, no manual re-record)", async () => {
      mockUpload.mockRejectedValueOnce(
        Object.assign(new Error("storage_limit_reached"), { code: "QUOTA_EXCEEDED_STORAGE" }),
      );
      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox(); // storage full → retained, queued
      expect(readRawIndex().find((j) => j.id === outboxId)!.status).toBe("queued");

      // User frees/adds storage; the next heartbeat/online sweep succeeds.
      mockUpload.mockResolvedValueOnce("memo-after-storage");
      await processOutbox();

      expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false);
      expect(mockUpload).toHaveBeenLastCalledWith(expect.objectContaining({ songId: "song-1" }));
    });
  });

  describe("offline at save time", () => {
    it("keeps the take queued without attempting an upload, and never loses it", async () => {
      setOnline(false);

      const { outboxId } = await enqueueCaptureUpload(baseParams());
      await processOutbox();

      // No network was attempted while offline...
      expect(mockUpload).not.toHaveBeenCalled();
      // ...but the take is durably queued, ready to sync when back online.
      expect(pendingCount()).toBe(1);
      expect(readRawIndex().find((j) => j.id === outboxId)!.status).toBe("queued");
    });
  });

  describe("orphan safety", () => {
    it("drops a job whose cached blob has vanished instead of looping forever", async () => {
      const { outboxId } = await enqueueCaptureUpload(baseParams());
      // Simulate the blob being gone (claimed elsewhere / cache cleared).
      mockAudioCache.get.mockResolvedValue(null);

      await processOutbox();

      expect(mockUpload).not.toHaveBeenCalled();
      expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false);
    });
  });

  describe("change events — the sync pill's contract", () => {
    it("reports the pending count rising on enqueue and falling to zero on success", async () => {
      const counts: number[] = [];
      subscribeOutbox((e) => {
        if (e.type === "change") counts.push(e.pending);
      });

      await enqueueCaptureUpload(baseParams()); // queued → pending 1
      await enqueueCaptureUpload(baseParams({ title: "Second" })); // queued → pending 2
      expect(pendingCount()).toBe(2);

      await processOutbox(); // both upload successfully → pending 0

      // The pill is driven entirely by these change events; the last one must
      // reach 0 so the pill disappears when everything has synced.
      expect(counts[0]).toBe(1);
      expect(counts).toContain(2);
      expect(counts[counts.length - 1]).toBe(0);
      expect(pendingCount()).toBe(0);
    });

    it("keeps a non-zero pending count while a take is still failing to sync", async () => {
      mockUpload.mockRejectedValue(new Error("network unreachable"));
      let lastPending = -1;
      subscribeOutbox((e) => {
        if (e.type === "change") lastPending = e.pending;
      });

      await enqueueCaptureUpload(baseParams());
      await processOutbox(); // fails, but the take is retained

      // The pill must keep showing the unsynced take — it is safe but not yet sent.
      expect(pendingCount()).toBe(1);
      expect(lastPending).toBe(1);
    });
  });

  describe("pluggable uploader registry — every pipeline gets the same safety", () => {
    it("routes a take to a registered custom uploader by key, passing its extras", async () => {
      // Typed params so mock.calls[0] is [OutboxJob, Blob], not an empty tuple.
      const memosUploader = vi.fn(
        (_job: OutboxJob, _blob: Blob): Promise<string> => Promise.resolve("memo-from-brainstorm"),
      );
      registerOutboxUploader("memos", memosUploader);

      const blob = makeBlob("brainstorm idea");
      mockAudioCache.get.mockResolvedValue(blob);

      const { outboxId } = await enqueueCaptureUpload({
        ...baseParams({ blob }),
        uploaderKey: "memos",
        extra: { waveformPeaks: [0.1, 0.9, 0.4] },
      });
      await processOutbox();

      // The custom pipeline — not the default voiceApi one — sent the take, with
      // its pipeline-specific extras intact and the real blob.
      expect(memosUploader).toHaveBeenCalledTimes(1);
      const [job, sentBlob] = memosUploader.mock.calls[0];
      expect(job.extra?.waveformPeaks).toEqual([0.1, 0.9, 0.4]);
      expect(sentBlob).toBe(blob);
      expect(mockUpload).not.toHaveBeenCalled(); // default uploader untouched
      expect(readRawIndex().some((j) => j.id === outboxId)).toBe(false); // synced + cleared
    });

    it("keeps a take safe (never loops, never lost) when its uploader isn't registered yet", async () => {
      const { outboxId } = await enqueueCaptureUpload({
        ...baseParams(),
        uploaderKey: "not-registered-this-session",
      });
      await processOutbox();

      // No crash, no upload, but the take is RETAINED in the queue + cache so it
      // can sync once its pipeline registers (e.g. that surface mounts).
      expect(mockUpload).not.toHaveBeenCalled();
      expect(pendingCount()).toBe(1);
      expect(readRawIndex().find((j) => j.id === outboxId)!.status).toBe("queued");
      expect(mockAudioCache.delete).not.toHaveBeenCalledWith(outboxId);
    });
  });
});
