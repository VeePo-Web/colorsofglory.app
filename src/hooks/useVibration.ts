import { useCallback } from "react";

export interface UseVibrationReturn {
  vibrate: (pattern: number | number[]) => void;
  supported: boolean;
}

/**
 * Feature-detected haptic pulse. iOS Safari has no Vibration API —
 * `supported` is false there and `vibrate` becomes a safe no-op.
 */
export function useVibration(): UseVibrationReturn {
  const supported = typeof navigator !== "undefined" && "vibrate" in navigator;

  const vibrate = useCallback(
    (pattern: number | number[]) => {
      if (!supported) return;
      try {
        navigator.vibrate(pattern);
      } catch {
        // non-fatal — some browsers throw when called outside a user gesture
      }
    },
    [supported]
  );

  return { vibrate, supported };
}
