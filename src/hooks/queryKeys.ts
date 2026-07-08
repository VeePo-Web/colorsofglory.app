/**
 * Canonical query-key factory (A3 · data access).
 *
 * The ONE shared vocabulary for every TanStack Query key in the app. Every query
 * / mutation hook builds its key from `qk` — no hook hand-rolls an inline string
 * array. A4's invalidation policy (`src/lib/cache/invalidation.ts`) references
 * these same builders, so "what to invalidate" and "what to read" can never drift.
 *
 * SHAPE CONTRACT — keys are arrays `[domain, id?, sub?]`. TanStack does prefix
 * (partial) matching, so invalidating a less-specific key invalidates every more
 * specific one under it:
 *   - `qk.song(id)`         → ["song", id]                  (invalidates ALL of a song)
 *   - `qk.songDetail(id)`   → ["song", id, "detail"]
 *   - `qk.songMembers(id)`  → ["song", id, "members"]
 *   - `qk.activity(id)`     → ["song", id, "activity"]      (invalidates the digest too)
 *   - `qk.activityDigest(id)` → ["song", id, "activity", "digest"]
 *   - `qk.admin.root()`     → ["admin"]                     (invalidates the whole admin console)
 *
 * `src/lib/cache/queryKeys.ts` re-exports `qk` + `QueryKey` from here so both the
 * `@/hooks/queryKeys` and legacy `@/lib/cache/queryKeys` import paths resolve to
 * this single source of truth.
 */

export type QueryKey = readonly unknown[];

export const qk = {
  // ── Catalog / song room ──────────────────────────────────────────────
  /** The signed-in user's whole song catalog. */
  songs: () => ["songs"] as const,
  /** Everything under one song — the broad prefix (invalidates all sub-views). */
  song: (id: string) => ["song", id] as const,
  /** A song's detail record (title, sections, counts). */
  songDetail: (id: string) => ["song", id, "detail"] as const,
  /** A song's collaborator roster + roles. */
  songMembers: (id: string) => ["song", id, "members"] as const,
  /** A song's voice-memo list. */
  memos: (songId: string) => ["song", songId, "memos"] as const,
  /** A song's whiteboard canvas (nodes + positions). */
  canvas: (id: string) => ["song", id, "canvas"] as const,
  /** Quick-captures filed into a song. */
  captures: (songId: string) => ["song", songId, "captures"] as const,
  /** A song's notes pad (C5). */
  notes: (songId: string) => ["song", songId, "notes"] as const,
  /** A song's activity feed. */
  activity: (id: string) => ["song", id, "activity"] as const,
  /** The "what changed since you left" recap digest — a leaf under activity. */
  activityDigest: (id: string) => ["song", id, "activity", "digest"] as const,

  /** Captures not yet filed into any song (the global capture inbox). */
  unfiledCaptures: () => ["captures", "unfiled"] as const,

  // ── Account / billing / plan ─────────────────────────────────────────
  /** Billing status + quota for the signed-in user. */
  billing: () => ["billing"] as const,
  /** Storage usage + limit for the signed-in user. */
  storage: () => ["storage"] as const,
  /** The reactive subscription/plan state for a user. */
  subscription: (userId: string | null) => ["subscription", userId] as const,
  /** The current auth user (getUser) — cached so many hooks share one read. */
  authUser: () => ["auth-user"] as const,
  /** A user's onboarding progress. */
  onboarding: (userId: string | undefined) => ["onboarding", userId] as const,

  /**
   * Alias for {@link qk.songMembers} — kept because A4's invalidation policy
   * (`invalidation.ts`) references `qk.members`. Same key shape; prefer
   * `songMembers` in new code.
   */
  members: (id: string) => ["song", id, "members"] as const,

  // ── Admin console ────────────────────────────────────────────────────
  admin: {
    /** The whole admin namespace — invalidate to refresh every admin view. */
    root: () => ["admin"] as const,
    founderSummary: () => ["admin", "founder-summary"] as const,
    allFounderCodes: () => ["admin", "all-founder-codes"] as const,
    allCodesFull: () => ["admin", "all-codes-full"] as const,
    recent: (limit: number) => ["admin", "recent", limit] as const,
    founder: (id: string | undefined) => ["admin", "founder", id] as const,
    financeSummary: () => ["admin", "finance-summary"] as const,
    attention: () => ["admin", "attention"] as const,
    otpStats: () => ["admin", "otp-stats"] as const,
    audit: (filters: unknown, offset: number) => ["admin", "audit", filters, offset] as const,
    referrerLedger: () => ["admin", "referrer-ledger"] as const,
    payouts: (month: string) => ["admin", "payouts", month] as const,
    payoutBatches: () => ["admin", "payout-batches"] as const,
    /** Full key with the filter; call with no arg for the invalidation prefix. */
    billingEvents: (onlyFailed?: boolean): QueryKey =>
      onlyFailed === undefined ? ["admin", "billing-events"] : ["admin", "billing-events", onlyFailed],
    /** Full key with the filter; call with no arg for the invalidation prefix. */
    fraudFlags: (onlyOpen?: boolean): QueryKey =>
      onlyOpen === undefined ? ["admin", "fraud-flags"] : ["admin", "fraud-flags", onlyOpen],
  },
} as const;
