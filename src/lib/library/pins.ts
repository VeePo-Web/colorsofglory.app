/**
 * Song pinning — the Apple Notes pattern: up to three songs held at the top
 * of the Owned library, whatever the sort. localStorage only; a pin is a
 * reference and never changes the song itself.
 */
export const MAX_PINS = 3;

const KEY = "cog:library-pins";

export function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export interface TogglePinResult {
  pins: string[];
  /** True when the toggle was rejected because MAX_PINS are already pinned. */
  limited: boolean;
}

export function togglePin(songId: string): TogglePinResult {
  const pins = loadPins();
  let next: string[];
  let limited = false;
  if (pins.includes(songId)) {
    next = pins.filter((id) => id !== songId);
  } else if (pins.length >= MAX_PINS) {
    next = pins;
    limited = true;
  } else {
    next = [...pins, songId];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode — pins simply don't persist.
  }
  return { pins: next, limited };
}
