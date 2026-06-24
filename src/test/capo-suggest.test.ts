import { describe, it, expect } from "vitest";
import { suggestCapos } from "@/lib/chords/capoSuggest";

describe("suggestCapos — easy-key capo hints", () => {
  it("an already-easy key needs no capo", () => {
    expect(suggestCapos("G")).toEqual([{ capo: 0, playKey: "G" }]);
    expect(suggestCapos("C")).toEqual([{ capo: 0, playKey: "C" }]);
  });

  it("Bb → lowest suggestion is Capo 1 playing A", () => {
    const s = suggestCapos("Bb");
    expect(s[0]).toEqual({ capo: 1, playKey: "A" });
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.every((x) => ["C", "G", "D", "A", "E"].includes(x.playKey))).toBe(true);
  });

  it("F → Capo 1 plays E", () => {
    expect(suggestCapos("F")[0]).toEqual({ capo: 1, playKey: "E" });
  });

  it("Eb → Capo 1 plays D", () => {
    expect(suggestCapos("Eb")[0]).toEqual({ capo: 1, playKey: "D" });
  });

  it("suggestions are ordered by lowest capo", () => {
    const s = suggestCapos("Bb");
    const capos = s.map((x) => x.capo);
    expect([...capos]).toEqual([...capos].sort((a, b) => a - b));
  });

  it("minor mode uses minor easy keys", () => {
    expect(suggestCapos("F", "minor")[0]).toEqual({ capo: 1, playKey: "E" });
  });
});
