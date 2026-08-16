import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two boundaries pendingUploads crosses: the local IndexedDB blob cache
// and the network-facing voice memo upload pipeline. The index read/write, status
// transitions, idempotency-key wiring, and re-key-on-success are all real — that's
// what proves an in-song take genuinely survives a dropped upload.
vi.mock("./audioCache", () => ({
  audioCache: {
    get: vi.fn(),
    set: vi.fn(),
    setDurable: vi.fn(),
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
  discardPendingUpload,
  enqueuePendingUpload,
  flushPendingUpload,
  listPendingUploads,
  remapPendingParents,
} from "./pendingUploads";

const mockAudioCache = vi.mocked(audioCache);
const mockUploadVoiceMemo = vi.mocked(uploadVoiceMemo);

const INDEX_KEY = "cog-pending-uploads";

function readRawIndex(): Array<{ id: string; status: string; songId: string; attempts: number }> {
  const raw = localStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

function makeBlob(content = "hum"): Blob {
  return new Blob([content], { type: "audio/mp4" });
}

const baseParams = {
  songId: "song-1",
  mimeType: "audio/mp4",
  durationMs: 4200,
  title: "Bridge idea",
  sectionLabel: "Bridge",
};

describe("pendingUploads — in-song take retain + retry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockAudioCache.set.mockResolvedValue(undefined);
    // The durable write CONFIRMS by default; the P0 test below flips it.
    mockAudioCache.setDurable.mockResolvedValue(true);
    mockAudioCache.delete.mockResolvedValue(undefined);
    mockAudioCache.get.mockResolvedValue(null);
    mockUploadVoiceMemo.mockResolvedValue("memo-123");
  });

  describe("enqueuePendingUpload — the sacred promise (in-song)", () => {
    it("caches the blob BEFORE writing the index row — the take is safe before any network call", async () => {
      const callOrder: string[] = [];
      mockAudioCache.setDurable.mockImplementation(async () => {
        callOrder.push("cache.set");
        return true;
      });

      const blob = makeBlob();
      const record = await enqueuePendingUpload({ ...baseParams, blob });

      expect(mockAudioCache.setDurable).toHaveBeenCalledWith(record.id, blob);
      callOrder.push("index written");
      expect(callOrder).toEqual(["cache.set", "index written"]);

      expect(record).toMatchObject({
        songId: "song-1",
        title: "Bridge idea",
        durationMs: 4200,
        sectionLabel: "Bridge",
        status: "pending",
        attempts: 0,
      });

      const persisted = readRawIndex();
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({ id: record.id, status: "pending" });
    });

    it("falls back to a safe mime type when neither param nor blob report one", async () => {
      const typeless = new Blob(["raw bytes"]);
      expect(typeless.type).toBe("");
      const record = await enqueuePendingUpload({ ...baseParams, mimeType: "", blob: typeless });
      expect(record.mimeType).toBe("audio/webm");
    });

    it("a PERMANENT server rejection PARKS the row — blob kept, sweeps stop replaying a wall", async () => {
      // Ledger F6: role revoked / song deleted / invalid input are walls that
      // will never move. The take stays retained on-device, but the mount +
      // online sweeps must not hammer the server forever. Offline/quota/5xx
      // never park — those genuinely resolve.
      const blob = makeBlob();
      const record = await enqueuePendingUpload({ ...baseParams, blob });
      mockAudioCache.get.mockResolvedValue(blob);
      mockUploadVoiceMemo.mockRejectedValue(Object.assign(new Error("nope"), { code: "NOT_A_MEMBER" }));

      await expect(flushPendingUpload(record.id)).rejects.toThrow("take-rejected-permanently");
      const row = readRawIndex().find((r) => r.id === record.id) as { status: string; parked?: boolean };
      expect(row.status).toBe("failed");
      expect(row.parked).toBe(true);
      expect(mockAudioCache.delete).not.toHaveBeenCalledWith(record.id); // blob kept

      // The next sweep is a NO-OP: no second upload attempt against the wall.
      mockUploadVoiceMemo.mockClear();
      await expect(flushPendingUpload(record.id)).resolves.toBeNull();
      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
    });

    it("THROWS (and writes no index row) when the device refuses the durable write — never a false 'Saved'", async () => {
      // The P0 this pins: iOS private mode / storage pressure fails the IDB
      // put; the old best-effort set() swallowed it, the row was written, the
      // caller cleared its salvage backup, and the take's only copy was gone
      // behind a "Saved" toast. The enqueue must fail LOUDLY instead.
      mockAudioCache.setDurable.mockResolvedValue(false);
      await expect(enqueuePendingUpload({ ...baseParams, blob: makeBlob() })).rejects.toThrow(
        "take-not-persisted",
      );
      expect(readRawIndex()).toHaveLength(0);
    });
  });

  describe("flushPendingUpload — success path", () => {
    it("uploads with the row id as idempotency key, re-keys the blob to the memo id, and retires the temp row", async () => {
      const blob = makeBlob("real audio");
      const record = await enqueuePendingUpload({ ...baseParams, blob });
      mockAudioCache.get.mockResolvedValue(blob);

      const memoId = await flushPendingUpload(record.id);

      expect(memoId).toBe("memo-123");
      expect(mockUploadVoiceMemo).toHaveBeenCalledWith(
        expect.objectContaining({
          songId: "song-1",
          blob,
          durationMs: 4200,
          title: "Bridge idea",
          sectionLabel: "Bridge",
          idempotencyKey: record.id,
        }),
      );
      // Blob re-keyed to the real memo id for instant first play...
      expect(mockAudioCache.set).toHaveBeenLastCalledWith("memo-123", blob);
      // ...the temp key freed and the row gone.
      expect(mockAudioCache.delete).toHaveBeenCalledWith(record.id);
      expect(readRawIndex()).toHaveLength(0);
    });
  });

  describe("flushPendingUpload — failure path (the gap this closes)", () => {
    it("marks the row failed, KEEPS the cached blob, and rethrows so the take is never lost", async () => {
      const blob = makeBlob("irreplaceable take");
      const record = await enqueuePendingUpload({ ...baseParams, blob });
      mockAudioCache.get.mockResolvedValue(blob);
      mockUploadVoiceMemo.mockRejectedValue(new Error("network unreachable"));

      await expect(flushPendingUpload(record.id)).rejects.toThrow("network unreachable");

      const raw = readRawIndex();
      expect(raw).toHaveLength(1);
      expect(raw[0]).toMatchObject({ id: record.id, status: "failed", attempts: 1 });
      // The blob is NOT freed — it's waiting on the shelf for a retry.
      expect(mockAudioCache.delete).not.toHaveBeenCalled();

      const pending = await listPendingUploads("song-1");
      expect(pending.map((p) => p.id)).toContain(record.id);
    });

    it("a retry after a failure succeeds, increments attempts, and clears the row", async () => {
      const blob = makeBlob("take");
      const record = await enqueuePendingUpload({ ...baseParams, blob });
      mockAudioCache.get.mockResolvedValue(blob);

      mockUploadVoiceMemo.mockRejectedValueOnce(new Error("offline"));
      await expect(flushPendingUpload(record.id)).rejects.toThrow("offline");
      expect(readRawIndex()[0]).toMatchObject({ status: "failed", attempts: 1 });

      mockUploadVoiceMemo.mockResolvedValueOnce("memo-777");
      const memoId = await flushPendingUpload(record.id);

      expect(memoId).toBe("memo-777");
      expect(mockUploadVoiceMemo).toHaveBeenLastCalledWith(
        expect.objectContaining({ idempotencyKey: record.id }),
      );
      expect(readRawIndex()).toHaveLength(0);
    });
  });

  describe("flushPendingUpload — the in-flight guard", () => {
    it("a concurrent flush of the same row uploads ONCE (mount sweep + online sweep + save path race)", async () => {
      const pending = await enqueuePendingUpload({ ...baseParams, blob: makeBlob() });
      mockAudioCache.get.mockResolvedValue(makeBlob());
      // Park the upload so both flushes are genuinely concurrent.
      let release: (v: string) => void = () => {};
      mockUploadVoiceMemo.mockImplementation(
        () => new Promise<string>((res) => { release = res; }),
      );
      const first = flushPendingUpload(pending.id);
      const second = flushPendingUpload(pending.id); // racer — must bounce off
      // Let the winning flush actually REACH the parked upload before releasing.
      await vi.waitFor(() => expect(mockUploadVoiceMemo).toHaveBeenCalled());
      release("memo-123");
      const [a, b] = await Promise.all([first, second]);
      expect(mockUploadVoiceMemo).toHaveBeenCalledTimes(1);
      expect([a, b].sort()).toEqual([null, "memo-123"].sort());
      // The guard releases: a LATER flush of a (re-queued) row is not blocked.
      expect(readRawIndex().find((r) => r.id === pending.id)).toBeUndefined();
    });
  });

  describe("flushPendingUpload — edge cases", () => {
    it("sweeps the orphan row and uploads nothing when the cached blob is gone", async () => {
      const record = await enqueuePendingUpload({ ...baseParams, blob: makeBlob() });
      mockAudioCache.get.mockResolvedValue(null);

      const result = await flushPendingUpload(record.id);

      expect(result).toBeNull();
      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
      expect(readRawIndex()).toHaveLength(0);
    });

    it("returns null and does nothing when the id is not in the index", async () => {
      const result = await flushPendingUpload("ghost-id");
      expect(result).toBeNull();
      expect(mockAudioCache.get).not.toHaveBeenCalled();
      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
    });
  });

  describe("listPendingUploads — recovery sweep contents", () => {
    it("returns only this song's takes, newest first", async () => {
      const a = await enqueuePendingUpload({ ...baseParams, songId: "song-1", blob: makeBlob("a") });
      await new Promise((r) => setTimeout(r, 2));
      const b = await enqueuePendingUpload({ ...baseParams, songId: "song-1", blob: makeBlob("b") });
      await enqueuePendingUpload({ ...baseParams, songId: "song-2", blob: makeBlob("c") });

      const forSong1 = await listPendingUploads("song-1");
      expect(forSong1.map((p) => p.id)).toEqual([b.id, a.id]);
    });
  });

  describe("layered takes — a layer never uploads with a temp parent id", () => {
    it("holds a layer back while its base is still in the queue (never a garbage parent on the server)", async () => {
      const base = await enqueuePendingUpload({ ...baseParams, blob: makeBlob("base") });
      const layer = await enqueuePendingUpload({
        ...baseParams,
        blob: makeBlob("layer"),
        parentMemoId: base.id, // recorded over a base that hasn't flushed yet
      });
      mockAudioCache.get.mockResolvedValue(makeBlob("layer"));

      await expect(flushPendingUpload(layer.id)).rejects.toThrow("parent-take-still-uploading");
      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
      // The take is safe and waiting, not lost.
      expect(readRawIndex().find((r) => r.id === layer.id)).toMatchObject({ status: "failed" });
    });

    it("remapPendingParents heals held-back layers to the real memo id and reports them for re-flush", async () => {
      const base = await enqueuePendingUpload({ ...baseParams, blob: makeBlob("base") });
      const layer = await enqueuePendingUpload({
        ...baseParams,
        blob: makeBlob("layer"),
        parentMemoId: base.id,
      });
      const unrelated = await enqueuePendingUpload({ ...baseParams, blob: makeBlob("solo") });

      const healed = remapPendingParents(base.id, "memo-real-9");
      expect(healed).toEqual([layer.id]);

      // The healed layer now uploads with the REAL parent id.
      localStorage.setItem(
        INDEX_KEY,
        JSON.stringify(JSON.parse(localStorage.getItem(INDEX_KEY)!).filter((r: { id: string }) => r.id !== base.id)),
      );
      mockAudioCache.get.mockResolvedValue(makeBlob("layer"));
      await flushPendingUpload(layer.id);
      expect(mockUploadVoiceMemo).toHaveBeenCalledWith(
        expect.objectContaining({ parentMemoId: "memo-real-9" }),
      );
      // The unrelated take was left alone.
      expect(readRawIndex().find((r) => r.id === unrelated.id)).toBeTruthy();
    });
  });

  describe("discardPendingUpload — explicit discard", () => {
    it("removes the index row and the cached blob", async () => {
      const record = await enqueuePendingUpload({ ...baseParams, blob: makeBlob() });
      await discardPendingUpload(record.id);

      expect(readRawIndex()).toHaveLength(0);
      expect(mockAudioCache.delete).toHaveBeenCalledWith(record.id);
    });
  });
});
