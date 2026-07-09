import { describe, expect, it } from "vitest";
import { layoutFinalWords } from "@/hooks/useLiveTranscript";

/**
 * F12 Step 3 support — the live path's synthetic word timing must leave real
 * pauses visible as GAPS (the prosody signal the marker confidence uses),
 * instead of smearing silence evenly across the words.
 */

describe("layoutFinalWords — right-aligned synthetic timing", () => {
  it("dense speech fills its window evenly (unchanged behavior)", () => {
    const words = layoutFinalWords(["grace", "upon", "grace", "again", "amen"], 0, 1000);
    expect(words).toHaveLength(5);
    expect(words[0].startMs).toBe(0);
    expect(words[4].endMs).toBe(1000);
    // Contiguous — no artificial gaps inside continuous speech.
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i].startMs).toBe(words[i - 1].endMs);
    }
  });

  it("a long-silence window right-aligns its words, leaving a leading gap", () => {
    // 5s window, 2 words: the singer was quiet, then said "chorus now".
    const words = layoutFinalWords(["chorus", "now"], 0, 5000);
    expect(words).toHaveLength(2);
    expect(words[1].endMs).toBe(5000);
    // The silence shows up BEFORE the words, not inside them.
    expect(words[0].startMs).toBeGreaterThan(4000);
    expect(words[0].endMs - words[0].startMs).toBeLessThanOrEqual(320);
  });

  it("never emits words outside the window or out of order", () => {
    const words = layoutFinalWords(["a", "b", "c"], 2000, 2100);
    expect(words[0].startMs).toBeGreaterThanOrEqual(2000 - 1);
    expect(words[2].endMs).toBeLessThanOrEqual(2100);
    for (let i = 1; i < words.length; i += 1) {
      expect(words[i].startMs).toBeGreaterThanOrEqual(words[i - 1].startMs);
    }
  });

  it("returns nothing for an empty token list", () => {
    expect(layoutFinalWords([], 0, 1000)).toEqual([]);
  });
});
