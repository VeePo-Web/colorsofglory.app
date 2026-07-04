import { describe, it, expect } from "vitest";
import { coordFor, directionBetween } from "./navDirection";

// The spatial model: Songs is the library, one lane LEFT of the mic (x = -1).
// Capture (home) and its peers sit at x = 0, depth 0. A song's own surfaces
// (room, canvas, sheet, brainstorm, memory…) sit "inside" the song at depth 1.
describe("coordFor — the spatial map", () => {
  it("puts the library one lane to the left of the mic", () => {
    expect(coordFor("/songs")).toEqual({ x: -1, depth: 0 });
  });
  it("puts Capture (home) and its peers at the origin", () => {
    expect(coordFor("/")).toEqual({ x: 0, depth: 0 });
    expect(coordFor("/capture")).toEqual({ x: 0, depth: 0 });
    expect(coordFor("/settings")).toEqual({ x: 0, depth: 0 });
  });
  it("puts every surface of a song one level deep", () => {
    expect(coordFor("/songs/123/room")).toEqual({ x: 0, depth: 1 });
    expect(coordFor("/songs/123/canvas")).toEqual({ x: 0, depth: 1 });
    expect(coordFor("/songs/123/sheet")).toEqual({ x: 0, depth: 1 });
    expect(coordFor("/songs/123/brainstorm")).toEqual({ x: 0, depth: 1 });
    // The bare song route (song-bound capture) is also inside the song.
    expect(coordFor("/songs/123")).toEqual({ x: 0, depth: 1 });
  });
});

describe("directionBetween — forward peer moves (mic ⇄ library)", () => {
  it("Capture → Songs slides in from the left (library lives left)", () => {
    expect(directionBetween("/", "/songs")).toBe("left");
  });
  it("Songs → Capture slides in from the right", () => {
    expect(directionBetween("/songs", "/")).toBe("right");
  });
});

describe("directionBetween — depth (open a song / come back out)", () => {
  it("opening a song rises (deepening)", () => {
    expect(directionBetween("/", "/songs/1/brainstorm")).toBe("up");
    expect(directionBetween("/songs", "/songs/1/canvas")).toBe("up");
  });
  it("backing out of a song to the library slides in from the left (the pass-8/concurrent branch)", () => {
    // Hardware/browser back from a song surface to the library: lane changes
    // left, so it must match the in-app back (Songs enters from the left),
    // not a dead cut.
    expect(directionBetween("/songs/1/canvas", "/songs")).toBe("left");
  });
  it("backing out of a song to the mic slides in from... the same lane → calm fade", () => {
    // Song surface (x0,depth1) → Capture (x0,depth0): depth drops, no lane
    // change, so there is no honest sideways entrance — stays calm (none).
    expect(directionBetween("/songs/1/canvas", "/")).toBe("none");
  });
});

describe("directionBetween — no false motion", () => {
  it("a cold load / deep link (no known previous surface) does not animate", () => {
    expect(directionBetween(null, "/songs")).toBe("none");
  });
  it("re-rendering the same surface does not animate", () => {
    expect(directionBetween("/songs", "/songs")).toBe("none");
  });
  it("moving between two surfaces of the same song stays calm (same coordinate)", () => {
    expect(directionBetween("/songs/1/room", "/songs/1/canvas")).toBe("none");
  });
});
