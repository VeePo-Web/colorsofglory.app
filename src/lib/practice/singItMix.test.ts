import { beforeEach, describe, expect, it } from "vitest";
import { loadSingItMix, saveSingItMix } from "./singItMix";

describe("singItMix — the Practice Room's per-song mix memory", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a mix so the second practice opens as you mixed it", () => {
    saveSingItMix("song-1", { gains: { a: 0.4, b: 1.2 }, muted: ["b"] });
    expect(loadSingItMix("song-1")).toEqual({ gains: { a: 0.4, b: 1.2 }, muted: ["b"] });
  });

  it("keeps songs separate — one song's mix never bleeds into another", () => {
    saveSingItMix("song-1", { gains: { a: 0.2 }, muted: [] });
    expect(loadSingItMix("song-2")).toEqual({ gains: {}, muted: [] });
  });

  it("clamps stored gains into the mixer's range (a corrupt file can't blast)", () => {
    localStorage.setItem(
      "cog-sing-mix:song-1",
      JSON.stringify({ gains: { a: 99, b: -5, c: "loud" }, muted: ["ok", 7] }),
    );
    const mix = loadSingItMix("song-1");
    expect(mix.gains.a).toBe(1.5); // LAYER_GAIN_MAX
    expect(mix.gains.b).toBe(0);
    expect(mix.gains.c).toBeUndefined(); // non-numeric dropped, never NaN
    expect(mix.muted).toEqual(["ok"]); // non-strings dropped
  });

  it("garbage or absent storage is a calm empty mix, never a throw", () => {
    expect(loadSingItMix("nope")).toEqual({ gains: {}, muted: [] });
    localStorage.setItem("cog-sing-mix:bad", "{not json");
    expect(loadSingItMix("bad")).toEqual({ gains: {}, muted: [] });
    localStorage.setItem("cog-sing-mix:arr", "[1,2,3]");
    expect(loadSingItMix("arr")).toEqual({ gains: {}, muted: [] });
  });
});
