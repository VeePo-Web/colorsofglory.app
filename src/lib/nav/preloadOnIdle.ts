/**
 * preloadOnIdle — warm adjacent surfaces while the songwriter is still here.
 *
 * Spatial nav promises the neighbor is "right there," so its lazy chunk must
 * already be in memory before the first swipe — a Suspense skeleton mid-slide
 * breaks the geography. Runs after idle so it never competes with the
 * surface's own first paint or an active recording.
 */
export function preloadOnIdle(...loaders: Array<() => Promise<unknown>>): void {
  const run = () => {
    for (const load of loaders) {
      load().catch(() => {
        /* offline or flaky network — the route still loads on demand */
      });
    }
  };
  if (typeof window === "undefined") return;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(run, { timeout: 2500 });
  } else {
    w.setTimeout(run, 1200);
  }
}
