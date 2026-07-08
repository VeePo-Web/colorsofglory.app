import { createContext, useContext, type ReactNode } from "react";

/**
 * App-wide outbox seam — a place for offline-queued writes to register and
 * retry. Kept intentionally minimal: surfaces that queue their own offline
 * work (e.g. the sheet's localStorage cache) work standalone; this context
 * exists so a future shared outbox can coordinate them without re-plumbing
 * the provider tree.
 */

export interface OutboxState {
  /** True while any registered queue reports unsynced work. */
  pending: boolean;
}

const OutboxContext = createContext<OutboxState>({ pending: false });

export function OutboxProvider({ children }: { children: ReactNode }) {
  return <OutboxContext.Provider value={{ pending: false }}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): OutboxState {
  return useContext(OutboxContext);
}
