// User control for Memory — hide a cluster you don't want surfaced, restore it
// anytime. F33 MVP requires manual hide/restore, and its #1 failure risk is the
// feature "feeling like surveillance"; giving the user a reversible hide is the
// direct antidote ("Must feel safe: hiding an item"). Stored in localStorage —
// private to the device, no backend, ~$0. Pure helpers below are unit-tested.

const KEY = "cog.memory.hidden.v1";

/** Remove hidden clusters from a list. Pure. */
export function applyHidden<T extends { id: string }>(clusters: T[], hidden: readonly string[]): T[] {
  if (hidden.length === 0) return clusters;
  const set = new Set(hidden);
  return clusters.filter((c) => !set.has(c.id));
}

/** Toggle an id in the hidden set. Pure — returns a new array. */
export function toggleHidden(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
}

/** Read hidden cluster ids from localStorage (safe on SSR / blocked storage). */
export function loadHiddenIds(): string[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Persist hidden cluster ids. Never throws. */
export function saveHiddenIds(ids: readonly string[]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked/full — hiding is a soft preference, safe to drop */
  }
}
