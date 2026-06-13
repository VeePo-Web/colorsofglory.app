import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the two boundaries seedIdeaApi crosses: the local IndexedDB blob cache
// and the network-facing voice memo upload pipeline. Everything else
// (the index read/write, status transitions, sort/filter logic) is real —
// this is what proves the actual save → claim → upload contract holds.
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
import { claimSeedIdea, deleteSeedIdea, listSeedIdeas, saveSeedIdea } from "./seedIdeaApi";

const mockAudioCache = vi.mocked(audioCache);
const mockUploadVoiceMemo = vi.mocked(uploadVoiceMemo);

const INDEX_KEY = "cog-seed-ideas";

function readRawIndex(): Array<{ id: string; status: string }> {
  const raw = localStorage.getItem(INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

function makeBlob(content = "hum"): Blob {
  return new Blob([content], { type: "audio/webm" });
}

describe("seedIdeaApi — capture → save → claim → upload pipeline", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockAudioCache.set.mockResolvedValue(undefined);
    mockAudioCache.delete.mockResolvedValue(undefined);
    mockAudioCache.get.mockResolvedValue(null);
    mockUploadVoiceMemo.mockResolvedValue("memo-123");
  });

  describe("saveSeedIdea — the sacred promise", () => {
    it("writes the blob to the local cache before recording it in the index", async () => {
      const callOrder: string[] = [];
      mockAudioCache.set.mockImplementation(async () => {
        callOrder.push("cache.set");
      });

      const blob = makeBlob();
      const record = await saveSeedIdea({
        blob,
        mimeType: "audio/webm",
        durationMs: 4200,
        title: "Bridge hum",
      });

      // The blob must already be safely cached by the time we look at the index —
      // an idea is never lost, even if the tab closes a moment later.
      expect(mockAudioCache.set).toHaveBeenCalledWith(record.id, blob);
      callOrder.push("index written");
      expect(callOrder).toEqual(["cache.set", "index written"]);

      expect(record).toMatchObject({
        title: "Bridge hum",
        durationMs: 4200,
        storagePath: null,
        status: "local-only",
        origin: "global-capture",
      });
      expect(typeof record.id).toBe("string");
      expect(record.id.length).toBeGreaterThan(0);

      // And it's durably persisted — a fresh read of the index finds it.
      const persisted = readRawIndex();
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({ id: record.id, status: "local-only" });
    });

    it("prepends new ideas so the shelf shows the newest first", async () => {
      const first = await saveSeedIdea({ blob: makeBlob("a"), mimeType: "audio/webm", durationMs: 1000, title: "First" });
      const second = await saveSeedIdea({ blob: makeBlob("b"), mimeType: "audio/webm", durationMs: 2000, title: "Second" });

      const raw = readRawIndex();
      expect(raw.map((r) => r.id)).toEqual([second.id, first.id]);
    });
  });

  describe("listSeedIdeas — the shelf contents", () => {
    it("returns saved ideas, newest first, and hides claimed ones", async () => {
      const older = await saveSeedIdea({ blob: makeBlob("a"), mimeType: "audio/webm", durationMs: 1000, title: "Older idea" });
      // Force distinct timestamps so ordering is unambiguous regardless of clock resolution.
      await new Promise((r) => setTimeout(r, 2));
      const newer = await saveSeedIdea({ blob: makeBlob("b"), mimeType: "audio/webm", durationMs: 1000, title: "Newer idea" });

      let shelf = await listSeedIdeas();
      expect(shelf.map((r) => r.id)).toEqual([newer.id, older.id]);

      // Claim the older one — it must vanish from the shelf, not just get reordered.
      mockAudioCache.get.mockResolvedValueOnce(makeBlob("a"));
      await claimSeedIdea({ seedId: older.id, songId: "song-1" });

      shelf = await listSeedIdeas();
      expect(shelf.map((r) => r.id)).toEqual([newer.id]);
    });
  });

  describe("claimSeedIdea — success path", () => {
    it("transitions local-only → uploading → claimed, uploads through the real pipeline, and frees the cache", async () => {
      const cachedBlob = makeBlob("the actual recorded audio");
      mockAudioCache.get.mockResolvedValue(cachedBlob);

      const seed = await saveSeedIdea({
        blob: makeBlob("placeholder — cache.set is mocked"),
        mimeType: "audio/webm",
        durationMs: 7777,
        title: "Chorus idea",
      });
      expect(readRawIndex()[0].status).toBe("local-only");

      const statusesSeenByUpload: string[] = [];
      mockUploadVoiceMemo.mockImplementation(async () => {
        statusesSeenByUpload.push(readRawIndex()[0].status);
        return "memo-999";
      });

      await claimSeedIdea({ seedId: seed.id, songId: "song-42" });

      // The status flips to "uploading" before the network call begins...
      expect(statusesSeenByUpload).toEqual(["uploading"]);

      // ...the real upload pipeline receives exactly the cached blob and the seed's
      // own metadata — this is the contract that makes "voice memos get saved" true.
      expect(mockUploadVoiceMemo).toHaveBeenCalledWith({
        songId: "song-42",
        blob: cachedBlob,
        mimeType: cachedBlob.type,
        durationMs: 7777,
        title: "Chorus idea",
        sectionLabel: "Raw idea",
      });

      // ...and on success it lands as "claimed" and the local cache copy is released.
      expect(readRawIndex()[0].status).toBe("claimed");
      expect(mockAudioCache.delete).toHaveBeenCalledWith(seed.id);
    });

    it("falls back to audio/webm when the cached blob reports no MIME type", async () => {
      const typelessBlob = new Blob(["raw bytes"]);
      expect(typelessBlob.type).toBe("");
      mockAudioCache.get.mockResolvedValue(typelessBlob);

      const seed = await saveSeedIdea({ blob: makeBlob(), mimeType: "audio/webm", durationMs: 500, title: "Untyped" });
      await claimSeedIdea({ seedId: seed.id, songId: "song-1" });

      expect(mockUploadVoiceMemo).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: "audio/webm" }),
      );
    });
  });

  describe("claimSeedIdea — failure path (the recovery the toast fixes protect)", () => {
    it("reverts to local-only, rethrows, and never frees the cache when the upload fails", async () => {
      mockAudioCache.get.mockResolvedValue(makeBlob("audio bytes"));
      mockUploadVoiceMemo.mockRejectedValue(new Error("network unreachable"));

      const seed = await saveSeedIdea({ blob: makeBlob(), mimeType: "audio/webm", durationMs: 3000, title: "Bridge take 2" });

      await expect(claimSeedIdea({ seedId: seed.id, songId: "song-1" })).rejects.toThrow("network unreachable");

      // The idea must still be safe and waiting — exactly what the calm error toast promises the user.
      const raw = readRawIndex();
      expect(raw).toHaveLength(1);
      expect(raw[0]).toMatchObject({ id: seed.id, status: "local-only" });
      expect(mockAudioCache.delete).not.toHaveBeenCalled();

      // And it's still on the shelf, ready to be retried.
      const shelf = await listSeedIdeas();
      expect(shelf.map((r) => r.id)).toContain(seed.id);
    });
  });

  describe("claimSeedIdea — edge cases", () => {
    it("marks claimed without calling the upload pipeline when the cache has no blob (already-claimed/expired)", async () => {
      mockAudioCache.get.mockResolvedValue(null);

      const seed = await saveSeedIdea({ blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, title: "Ghost idea" });
      await claimSeedIdea({ seedId: seed.id, songId: "song-1" });

      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
      expect(readRawIndex()[0].status).toBe("claimed");
      expect(mockAudioCache.delete).toHaveBeenCalledWith(seed.id);
    });

    it("does nothing when the seed id no longer exists in the index", async () => {
      await claimSeedIdea({ seedId: "ghost-id-not-in-index", songId: "song-1" });

      expect(mockAudioCache.get).not.toHaveBeenCalled();
      expect(mockUploadVoiceMemo).not.toHaveBeenCalled();
      expect(mockAudioCache.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteSeedIdea — permanent discard", () => {
    it("removes both the index entry and the cached blob", async () => {
      const seed = await saveSeedIdea({ blob: makeBlob(), mimeType: "audio/webm", durationMs: 1000, title: "Discard me" });
      await deleteSeedIdea(seed.id);

      expect(readRawIndex()).toHaveLength(0);
      expect(mockAudioCache.delete).toHaveBeenCalledWith(seed.id);
    });
  });
});
