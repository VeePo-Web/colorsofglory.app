import { describe, expect, it } from "vitest";
import { defaultCaptureName } from "./captureNaming";

// Build a Date at a fixed local hour/minute so the part-of-day boundaries are
// tested deterministically regardless of the machine's clock.
function at(hour: number, minute = 0): Date {
  return new Date(2026, 5, 26, hour, minute, 0); // 2026-06-26 local time
}

describe("defaultCaptureName — songwriting-flavored, time-aware", () => {
  it("names the part of day at each boundary", () => {
    expect(defaultCaptureName(at(5)).startsWith("Morning idea")).toBe(true);
    expect(defaultCaptureName(at(11, 59)).startsWith("Morning idea")).toBe(true);
    expect(defaultCaptureName(at(12)).startsWith("Afternoon idea")).toBe(true);
    expect(defaultCaptureName(at(16, 59)).startsWith("Afternoon idea")).toBe(true);
    expect(defaultCaptureName(at(17)).startsWith("Evening idea")).toBe(true);
    expect(defaultCaptureName(at(20, 59)).startsWith("Evening idea")).toBe(true);
    expect(defaultCaptureName(at(21)).startsWith("Late-night idea")).toBe(true);
    expect(defaultCaptureName(at(2)).startsWith("Late-night idea")).toBe(true);
    expect(defaultCaptureName(at(4, 59)).startsWith("Late-night idea")).toBe(true);
  });

  it("never reads like a meeting recorder ('Voice Memo N') and always carries a time", () => {
    const name = defaultCaptureName(at(23, 42));
    expect(name).toContain("idea");
    expect(name).not.toMatch(/voice memo/i);
    // The time separator + a clock time are present for rediscovery.
    expect(name).toContain("·");
  });
});
