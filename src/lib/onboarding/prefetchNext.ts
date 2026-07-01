import { useEffect } from "react";

type Loader = () => Promise<unknown>;

/**
 * Idle-time prefetch of the NEXT onboarding screen's lazy chunk.
 *
 * Every onboarding/invite screen is a React.lazy route, so each step pays a
 * chunk download at the moment of the tap — the single most perceptible
 * "not instant" beat on mobile. While the user reads/types on the current
 * screen, the browser is idle; fetching the next chunk then makes the
 * transition render instantly from cache.
 *
 * - Waits for idle (requestIdleCallback; small-timeout fallback on iOS Safari,
 *   which doesn't support it) so it never competes with the current screen's
 *   critical work (autofocus, OTP send, invite preview fetch).
 * - Failures are swallowed: prefetch is an enhancement, never a dependency —
 *   the route's own lazy() import still loads the chunk on navigation.
 * - Vite dedupes module fetches, so prefetch + later navigation costs one fetch.
 */
export function useIdlePrefetch(...loaders: Loader[]): void {
  useEffect(() => {
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      for (const load of loaders) {
        void load().catch(() => { /* enhancement only — route lazy() still works */ });
      }
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let idleId: number | undefined;
    let timer: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(fire, { timeout: 2500 });
    } else {
      // iOS Safari has no requestIdleCallback — a short delay clears the
      // mount-critical window (focus, first paint) before fetching.
      timer = window.setTimeout(fire, 400);
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // Fire once on mount — loaders are static import thunks per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
