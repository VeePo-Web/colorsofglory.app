/**
 * Optimistic-update helper (A4 · client state).
 *
 * One reusable snapshot → apply → rollback-on-error → settle pattern for the
 * UX-critical writes where the app must feel instant: capture commit, canvas
 * card move, rename. A3's mutation hooks wire this into useMutation's
 * onMutate / onError / onSettled.
 *
 * WHEN to use: writes where showing the result immediately is truthful and a
 * rare rollback is acceptable (a moved card snaps back, a rename reverts).
 * WHEN NOT to: writes where a wrong optimistic state would mislead — anything
 * involving money/quota, membership/permission grants, or irreversible deletes.
 * For those, wait for the server and invalidate (see ./invalidation).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { QueryKey } from "./queryKeys";

export interface OptimisticContext<T> {
  key: QueryKey;
  previous: T | undefined;
}

/**
 * onMutate body: cancel in-flight fetches, snapshot the current cache, apply the
 * optimistic value. Returns the context onError uses to roll back.
 */
export async function beginOptimistic<T>(
  client: QueryClient,
  key: QueryKey,
  update: (previous: T | undefined) => T,
): Promise<OptimisticContext<T>> {
  await client.cancelQueries({ queryKey: key });
  const previous = client.getQueryData<T>(key);
  client.setQueryData<T>(key, update(previous));
  return { key, previous };
}

/** onError body: restore the snapshot exactly. */
export function rollbackOptimistic<T>(
  client: QueryClient,
  context: OptimisticContext<T> | undefined,
): void {
  if (!context) return;
  client.setQueryData(context.key, context.previous);
}

/** onSettled body: reconcile with the server regardless of success/failure. */
export function settleOptimistic(client: QueryClient, key: QueryKey): Promise<void> {
  return client.invalidateQueries({ queryKey: key });
}
