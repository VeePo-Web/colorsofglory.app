import { describe, it, expect, beforeEach, vi } from "vitest";
import { maybeDetectSongTempoKey } from "./tempoKeyRunner";
import { readDetection, __clearAllDetectionsForTests } from "./detectedTempoKeyStore";

/**
 * The runner's invariants, isolated from DSP and DB:
 *  - SILENT WHEN UNSURE: sub-floor confidence → no fill, no suggestion.
 *  - fills route ONLY through fillSongMusicIfEmpty (the atomic `.is(null)`
 *    guard in cog/songs is what makes overwriting a user value impossible).
 *  - NEVER THROWS / NEVER BLOCKS: a failing fill still yields the suggestion;
 *    a failing detection yields silence; no songId yields nothing.
 */

const detectMock = vi.hoisted(() => vi.fn());
const fillMock = vi.hoisted(() => vi.fn());

vi.mock("./tempoKey", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tempoKey")>();
  return { ...actual, detectTempoKeyFromBlob: detectMock };
});

vi.mock("@/integrations/cog/songs", () => ({
  fillSongMusicIfEmpty: fillMock,
}));

const blob = new Blob([new Uint8Array(64)], { type: "audio/webm" });

async function settle() {
  // The runner is fire-and-forget; let its microtask chain drain.
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("tempoKeyRunner — the magic-or-silent orchestration", () => {
  beforeEach(() => {
    __clearAllDetectionsForTests();
    detectMock.mockReset();
    fillMock.mockReset();
    fillMock.mockResolvedValue({ filledBpm: false, filledKey: false });
  });

  it("stays completely silent below the confidence floors (rambly take)", async () => {
    detectMock.mockResolvedValue({
      tempo: { bpm: 123, confidence: 0.1 },
      key: { tonic: "C", mode: "major", confidence: 0.1 },
    });
    maybeDetectSongTempoKey(blob, "song-1");
    await settle();
    expect(fillMock).not.toHaveBeenCalled();
    expect(readDetection("song-1")).toBeNull();
  });

  it("fills ONLY the confident values, through the fill-if-empty seam", async () => {
    detectMock.mockResolvedValue({
      tempo: { bpm: 94, confidence: 0.9 },
      key: { tonic: "G", mode: "major", confidence: 0.05 }, // key unsure → omitted
    });
    fillMock.mockResolvedValue({ filledBpm: true, filledKey: false });
    maybeDetectSongTempoKey(blob, "song-2");
    await settle();
    expect(fillMock).toHaveBeenCalledWith("song-2", { tempo_bpm: 94, key_signature: undefined });
    const rec = readDetection("song-2");
    expect(rec?.bpm).toBe(94);
    expect(rec?.keySignature).toBeUndefined();
    expect(rec?.filledBpm).toBe(true);
  });

  it("records the suggestion (minor keys in app format) even when the fill was declined", async () => {
    detectMock.mockResolvedValue({
      tempo: null,
      key: { tonic: "E", mode: "minor", confidence: 0.8 },
    });
    fillMock.mockRejectedValue(new Error("RLS says no"));
    maybeDetectSongTempoKey(blob, "song-3");
    await settle();
    const rec = readDetection("song-3");
    expect(rec?.keySignature).toBe("Em");
    expect(rec?.filledKey).toBe(false); // honest: nothing was written
  });

  it("does nothing without a song (global capture) and never throws on detector failure", async () => {
    maybeDetectSongTempoKey(blob, undefined);
    detectMock.mockRejectedValue(new Error("decode exploded"));
    expect(() => maybeDetectSongTempoKey(blob, "song-4")).not.toThrow();
    await settle();
    expect(fillMock).not.toHaveBeenCalled();
    expect(readDetection("song-4")).toBeNull();
  });
});
