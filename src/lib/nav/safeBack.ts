import type { NavigateFunction } from "react-router-dom";

/**
 * goBackOr — a back gesture that is never a dead-end.
 *
 * `navigate(-1)` is perfect when the songwriter arrived from inside the app,
 * but on a cold load or a shared deep link there is no in-app history to pop —
 * so the back button silently does nothing, or worse, walks out of the app.
 * React Router stamps the very first entry of a session with key "default"
 * (no push has happened yet); when we see it, we route to a real fallback
 * surface instead of popping into the void.
 */
export function goBackOr(
  navigate: NavigateFunction,
  locationKey: string | undefined,
  fallback: string,
): void {
  if (locationKey && locationKey !== "default") {
    navigate(-1);
  } else {
    navigate(fallback, { replace: true });
  }
}
