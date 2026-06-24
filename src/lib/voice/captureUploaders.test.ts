import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the boundaries the outbox + the brainstorm uploader cross.
vi.mock("./audioCache", () => ({
  audioCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    prefetch: vi.fn(),
  },
}));
vi.mock("./voiceApi", () => ({ uploadVoiceMemo: vi.fn() }));
vi.mock("@/integrations/cog/memos", () => ({
  uploadVoiceMemo: vi.fn().mockResolvedValue("memo-from-memos"),
}));

// Importing this module is the side effect under test: it registers the
// non-default pipelines (the brainstorm "memos" uploader) at startup.
import "./captureUploaders";

import { audioCache } from "./audioCache";
import { uploadVoiceMemo as memosUpload } from "@/integrations/cog/memos";
import {
  __resetCaptureOutboxForTests,
  __setOutboxAutoProcessForTests,
  enqueueCaptureUpload,
  processOutbox,
} from "./captureOutbox";

const mockAudioCache = vi.mocked(audioCache);
const mockMemosUpload = vi.mocked(memosUpload);

function makeBlob(): Blob {
  return new Blob(["hum"], { type: "audio/webm" });
}

describe("captureUploaders — startup registration closes the retry-after-reload gap", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    __resetCaptureOutboxForTests();
    __setOutboxAutoProcessForTests(false);
    mockAudioCache.set.mockResolvedValue(undefined);
    mockAudioCache.delete.mockResolvedValue(undefined);
    mockAudioCache.get.mockResolvedValue(makeBlob());
    mockMemosUpload.mockResolvedValue("memo-from-memos");
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true });
  });

  it("routes a 'memos' take through the brainstorm pipeline without that page ever mounting", async () => {
    // Note: we never import BrainstormPage here — only captureUploaders. If the
    // gap were open, no uploader would exist for "memos" and the take would just
    // sit queued.
    const blob = makeBlob();
    mockAudioCache.get.mockResolvedValue(blob);

    await enqueueCaptureUpload({
      blob,
      songId: "song-1",
      title: "Brainstorm idea",
      mimeType: "audio/webm",
      durationMs: 3200,
      sectionLabel: "Raw idea",
      uploaderKey: "memos",
      extra: { waveformPeaks: [0.2, 0.7] },
    });
    await processOutbox();

    expect(mockMemosUpload).toHaveBeenCalledTimes(1);
    expect(mockMemosUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        songId: "song-1",
        blob,
        waveformPeaks: [0.2, 0.7],
      }),
    );
  });
});
