import { describe, expect, it } from "vitest";
import { detectMusicCues } from "@/lib/capture/musicCues";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/** 1 word per second from 0, casing preserved. */
function words(spoken: string): TranscriptWord[] {
  return spoken.split(/\s+/).map((text, i) => ({
    text,
    startMs: i * 1000,
    endMs: i * 1000 + 800,
  }));
}

describe("detectMusicCues — key", () => {
  it("reads 'key of G'", () => {
    expect(detectMusicCues(words("key of G here we go")).key?.key).toBe("G");
  });
  it("reads 'in the key of E flat minor'", () => {
    expect(detectMusicCues(words("in the key of E flat minor")).key?.key).toBe("Eb minor");
  });
  it("reads 'in G major' (quality required after 'in')", () => {
    expect(detectMusicCues(words("in G major we sing")).key?.key).toBe("G major");
  });
  it("does NOT treat 'in my heart' as a key", () => {
    expect(detectMusicCues(words("in my heart i believe")).key).toBeUndefined();
  });
  it("does NOT treat plain 'in a moment' as a key", () => {
    expect(detectMusicCues(words("in a moment everything changed")).key).toBeUndefined();
  });
});

describe("detectMusicCues — tempo", () => {
  it("reads numeric '120 BPM'", () => {
    expect(detectMusicCues(words("about 120 BPM")).tempo?.bpm).toBe(120);
  });
  it("reads 'tempo is 90'", () => {
    expect(detectMusicCues(words("tempo is 90")).tempo?.bpm).toBe(90);
  });
  it("reads spelled 'one hundred and twenty beats per minute'", () => {
    expect(detectMusicCues(words("one hundred and twenty beats per minute")).tempo?.bpm).toBe(120);
  });
  it("reads 'a hundred and ten bpm'", () => {
    expect(detectMusicCues(words("a hundred and ten bpm")).tempo?.bpm).toBe(110);
  });
  it("reads bare 'ninety bpm'", () => {
    expect(detectMusicCues(words("ninety bpm")).tempo?.bpm).toBe(90);
  });
  it("ignores a number with no tempo unit ('I have 100 reasons')", () => {
    expect(detectMusicCues(words("I have 100 reasons to praise")).tempo).toBeUndefined();
  });
  it("clamps out-of-range ('400 bpm' is ignored)", () => {
    expect(detectMusicCues(words("400 bpm")).tempo).toBeUndefined();
  });
});

describe("detectMusicCues — chords (explicit cue)", () => {
  it("reads 'chords are G C D'", () => {
    const cues = detectMusicCues(words("the chords are G C D"));
    expect(cues.chords.map((c) => c.chord)).toEqual(["G", "C", "D"]);
  });
  it("reads a progression with minor + extensions", () => {
    const cues = detectMusicCues(words("progression is G D Em C"));
    expect(cues.chords.map((c) => c.chord)).toEqual(["G", "D", "Em", "C"]);
  });
  it("stops the cue run at lyrics", () => {
    const cues = detectMusicCues(words("chords G C D and then we sing loud forever"));
    // "and then" are connectors; "we sing loud" ends the run after 2 misses.
    expect(cues.chords.map((c) => c.chord)).toEqual(["G", "C", "D"]);
  });
});

describe("detectMusicCues — chords (qualified, anywhere)", () => {
  it("captures a clearly-qualified chord like 'C#m7'", () => {
    expect(detectMusicCues(words("then C#m7 lands")).chords.map((c) => c.chord)).toEqual(["C#m7"]);
  });
  it("captures a slash chord 'G/B'", () => {
    expect(detectMusicCues(words("walk down G/B now")).chords.map((c) => c.chord)).toEqual(["G/B"]);
  });
  it("does NOT capture bare 'a be' as chords (lyrics)", () => {
    expect(detectMusicCues(words("a be still my soul")).chords).toEqual([]);
  });
  it("does NOT capture lower-case 'am' (the verb) as A minor", () => {
    expect(detectMusicCues(words("i am holding on")).chords).toEqual([]);
  });
  it("does NOT capture a bare upper-case 'G' outside a cue", () => {
    expect(detectMusicCues(words("Glory to God")).chords).toEqual([]);
  });
});

describe("detectMusicCues — combined", () => {
  it("pulls key, tempo, and chords from one spoken sketch", () => {
    const cues = detectMusicCues(
      words("key of G about 120 bpm chords are G C D verse one here we go"),
    );
    expect(cues.key?.key).toBe("G");
    expect(cues.tempo?.bpm).toBe(120);
    expect(cues.chords.map((c) => c.chord)).toEqual(["G", "C", "D"]);
  });
  it("returns empty cues for plain lyrics", () => {
    const cues = detectMusicCues(words("you are my rock and my shelter forever"));
    expect(cues.key).toBeUndefined();
    expect(cues.tempo).toBeUndefined();
    expect(cues.chords).toEqual([]);
  });
});
