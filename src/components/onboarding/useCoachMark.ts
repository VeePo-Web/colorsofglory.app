import { useCallback, useEffect, useState } from "react";
import {
  TOUR_STEPS,
  claimActive,
  isStepPending,
  markSeen,
  onLockReleased,
  releaseActive,
  skipTour,
  type TourStep,
} from "@/lib/onboarding/tour";

const ORIENT_DELAY_MS = 1200;

/**
 * Wires one tour beat to a surface. Host pages add a target ref + one line:
 *
 *   const capture = useCoachMark("tour_capture_seen");
 *   ...
 *   {capture.visible && <CoachMark targetRef={recordBtnRef} onGotIt={capture.gotIt} ... />}
 *
 * Rules enforced here (see first-run-tour-plan.md):
 *  - arms only after the user has oriented (~1.2s on the surface)
 *  - app-wide one-tip-at-a-time lock; waits politely if another tip is up
 *  - never re-arms once seen or after "Skip tour"
 */
export function useCoachMark(step: TourStep, enabled = true) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !isStepPending(step)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const tryArm = () => {
      if (cancelled || !isStepPending(step)) return;
      if (claimActive(step)) {
        setVisible(true);
      } else if (!unsubscribe) {
        // Another tip is up — arm when it releases.
        unsubscribe = onLockReleased(() => {
          if (!cancelled && isStepPending(step) && claimActive(step)) setVisible(true);
        });
      }
    };

    timer = setTimeout(tryArm, ORIENT_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unsubscribe) unsubscribe();
      // If we were the visible tip, free the lock for the next surface.
      releaseActive(step);
    };
  }, [step, enabled]);

  /** Dismiss as understood (tap Got it / tap anywhere). Returns true if this completed the tour. */
  const gotIt = useCallback(() => {
    setVisible(false);
    const completed = markSeen(step);
    releaseActive(step);
    return completed;
  }, [step]);

  /** "Skip tour" — ends every beat, forever, silently. */
  const skip = useCallback(() => {
    setVisible(false);
    skipTour();
  }, []);

  // Is this the last registered beat? Computed against TOUR_STEPS so the
  // completion moment follows whichever beat is currently last — no host
  // changes when the canvas lane registers more beats.
  const isFinal = TOUR_STEPS[TOUR_STEPS.length - 1] === step;

  return { visible, gotIt, skip, isFinal };
}
