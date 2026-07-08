/**
 * Query-key vocabulary — re-export shim.
 *
 * The canonical `qk` factory now lives at `src/hooks/queryKeys.ts` (A3 · data
 * access owns the shared key vocabulary). This module re-exports it so the
 * legacy `@/lib/cache/queryKeys` import path — used by A4's invalidation policy,
 * the optimistic helper, and their tests — keeps resolving to the single source
 * of truth. New code may import from either path.
 */
export { qk } from "@/hooks/queryKeys";
export type { QueryKey } from "@/hooks/queryKeys";
