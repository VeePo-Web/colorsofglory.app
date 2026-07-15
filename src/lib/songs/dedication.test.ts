import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetDedicationsForTests,
  DEDICATION_MAX,
  flushPendingDedications,
  normalizeDedication,
  rememberServerDedication,
  resolveDedication,
  saveDedicationDurable,
} from "./dedication";
import { creditsToText } from "@/lib/canvas/credits";

const setMock = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/cog/songs", () => ({
  setSongDedication: setMock,
}));

async function settle() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("dedication — pure, unfailing text", () => {
  beforeEach(() => {
    __resetDedicationsForTests();
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
  });

  it("normalizes: trims, collapses whitespace, soft-caps, empty means absent", () => {
    expect(normalizeDedication("  the   youth night  ")).toBe("the youth night");
    expect(normalizeDedication("")).toBeNull();
    expect(normalizeDedication("   ")).toBeNull();
    expect(normalizeDedication(null)).toBeNull();
    expect(normalizeDedication("x".repeat(500))!.length).toBe(DEDICATION_MAX);
  });

  it("saves optimistically — the line exists on this device the instant it's written", async () => {
    saveDedicationDurable("song-1", "the Sunday after Mom's surgery");
    expect(resolveDedication("song-1")).toBe("the Sunday after Mom's surgery");
    await settle();
    expect(setMock).toHaveBeenCalledWith("song-1", "the Sunday after Mom's surgery");
  });

  it("NEVER fails: a rejected sync keeps the text locally and retries later", async () => {
    setMock.mockRejectedValue(new Error("offline / column not live yet"));
    expect(() => saveDedicationDurable("song-2", "the youth night")).not.toThrow();
    await settle();
    expect(resolveDedication("song-2")).toBe("the youth night"); // nothing lost
    // Back online — the queue flushes.
    setMock.mockResolvedValue(undefined);
    flushPendingDedications();
    await settle();
    expect(setMock).toHaveBeenLastCalledWith("song-2", "the youth night");
    expect(resolveDedication("song-2")).toBe("the youth night");
  });

  it("clearing returns the song to invisible", async () => {
    saveDedicationDurable("song-3", "the youth night");
    saveDedicationDurable("song-3", "");
    expect(resolveDedication("song-3")).toBeNull();
    await settle();
    expect(setMock).toHaveBeenLastCalledWith("song-3", null);
  });

  it("remembers server truth for surfaces without their own fetch — but a pending local edit outranks it", async () => {
    rememberServerDedication("song-4", "for the retreat"); // another device set it
    expect(resolveDedication("song-4")).toBe("for the retreat");

    setMock.mockRejectedValue(new Error("offline"));
    saveDedicationDurable("song-4", "the youth night"); // this device edits, offline
    await settle();
    rememberServerDedication("song-4", "for the retreat"); // stale server echo
    expect(resolveDedication("song-4")).toBe("the youth night"); // local edit wins until synced
  });

  it("a collaborator clearing it server-side clears it here too (when not pending)", () => {
    rememberServerDedication("song-5", "the youth night");
    rememberServerDedication("song-5", null);
    expect(resolveDedication("song-5")).toBeNull();
  });
});

describe("creditsToText — the dedicatory top-line in the export", () => {
  it("rides under the title, above the ledger, and is omitted entirely when unset", () => {
    const entries = [{ name: "Parker", contributions: ["Lyrics"] }];
    const withDedication = creditsToText("Morning Mercy", entries, "the youth night");
    expect(withDedication.split("\n").slice(0, 2)).toEqual([
      "Credits — Morning Mercy",
      "for the youth night",
    ]);
    const without = creditsToText("Morning Mercy", entries, null);
    expect(without).not.toContain("for ");
    expect(without.split("\n")[0]).toBe("Credits — Morning Mercy");
  });
});
