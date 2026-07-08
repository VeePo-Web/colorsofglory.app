/**
 * Query-key factory (A4 · client state — SEAM WITH A3).
 *
 * A3 owns the canonical `qk` factory that its query hooks use. Until that lands,
 * this is the minimal, forward-compatible registry the invalidation policy needs.
 * When A3's factory arrives, replace this file's exports with A3's — the shapes
 * below are the contract to keep stable.
 *
 * Keys are arrays: [domain, id?, sub?]. Invalidating a prefix invalidates all
 * more-specific keys under it (TanStack's default partial match).
 */
export const qk = {
  songs: () => ["songs"] as const,
  song: (id: string) => ["song", id] as const,
  songDetail: (id: string) => ["song", id, "detail"] as const,
  canvas: (id: string) => ["song", id, "canvas"] as const,
  activity: (id: string) => ["song", id, "activity"] as const,
  memos: (id: string) => ["song", id, "memos"] as const,
  captures: (id: string) => ["song", id, "captures"] as const,
  members: (id: string) => ["song", id, "members"] as const,
  billing: () => ["billing"] as const,
  onboarding: (userId: string) => ["onboarding", userId] as const,
} as const;

export type QueryKey = readonly unknown[];
