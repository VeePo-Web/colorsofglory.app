import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * canvasAudio is the ONE audio voice for Listen Path + Compare. The canvas
 * never-bleed guarantee (handleStartRecording calls stopCanvasAudio() before
 * arming the mic) rests entirely on this primitive being a TRUE hard stop:
 *   - it must clear the "what is sounding" state, and
 *   - it must invalidate an in-flight play, so a voice-memo URL that resolves
 *     AFTER the mic armed can't resurrect sound into the take.
 * The second is the subtle one: the bleed source isn't just an element that's
 * already playing — it's a play() that's mid-fetch when Record is tapped.
 */

const memosMock = vi.hoisted(() => {
  const deferred: Array<() => void> = [];
  return {
    // Each call parks its resolver so a test can decide WHEN the URL lands.
    getPlaybackUrl: vi.fn(
      (id: string) => new Promise<string>((res) => { deferred.push(() => res(`blob:${id}`)); }),
    ),
    flush: () => { deferred.forEach((r) => r()); deferred.length = 0; },
  };
});

vi.mock("@/integrations/cog/memos", () => ({ getPlaybackUrl: memosMock.getPlaybackUrl }));

import { playMemoOnCanvas, stopCanvasAudio, getCanvasPlayback } from "./canvasAudio";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("canvasAudio — the shared voice honours a hard stop (never-bleed mechanism)", () => {
  beforeEach(() => {
    // jsdom doesn't implement media playback — stub the element verbs the pool drives.
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    stopCanvasAudio();
  });
  afterEach(() => {
    stopCanvasAudio();
    vi.restoreAllMocks();
  });

  it("marks a memo as sounding, then stopCanvasAudio() clears it", async () => {
    const p = playMemoOnCanvas(A);
    memosMock.flush();
    await p;
    expect(getCanvasPlayback().memoId).toBe(A);

    stopCanvasAudio();
    expect(getCanvasPlayback().memoId).toBeNull();
  });

  it("invalidates an in-flight play: a URL landing AFTER the stop can't resurrect sound", async () => {
    // Record is tapped while a memo's signed URL is still being fetched.
    const p = playMemoOnCanvas(B);
    stopCanvasAudio();      // ← the mic-arm choke point runs this
    memosMock.flush();      // the fetch finally resolves, too late
    const ok = await p;
    expect(ok).toBe(false); // the stale play reports it never took the voice
    expect(getCanvasPlayback().memoId).toBeNull(); // and nothing is sounding
  });
});
