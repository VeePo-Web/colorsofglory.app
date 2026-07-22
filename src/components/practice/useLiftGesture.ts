import { useEffect, useRef, type RefObject } from "react";

/**
 * useLiftGesture â€” the handle-anchored vertical drag (docs/FLOW-ACCESS-CONTRACT.md).
 *
 * The Apple-Music/Spotify now-playing grammar: the drag zone IS the element
 * (listeners attach to the handle/grabber itself), so it can never fight
 * canvas pan, list scroll, or the top-level horizontal pager â€” those live in
 * the content, not on the handle. Vertical-dominant movement in the armed
 * direction tracks the finger 1:1 (capped), commits past a distance
 * threshold OR a flick, and springs back on cancel. Horizontal-dominant
 * movement stands down immediately.
 *
 * Reduced motion: the visual tracking is skipped; the commit threshold
 * still works, and every consumer keeps a tap path â€” the gesture is an
 * enhancement, never the only way.
 */

export const LIFT = {
  /** Movement before we decide the touch is a drag at all. */
  INTENT_PX: 8,
  /** Distance that commits the lift/dismiss on release. */
  TRIGGER_PX: 56,
  /** Release velocity (px/ms over the last ~100ms) that commits early. */
  FLICK_VELOCITY: 0.55,
  /** Max visual travel while dragging (the bar follows, then resists). */
  MAX_TRACK_PX: 96,
} as const;

interface LiftGestureOptions {
  /** Commit when dragged UP past the threshold (the lift). */
  onLiftUp?: () => void;
  /** Commit when dragged DOWN past the threshold (the set-down). */
  onPullDown?: () => void;
  disabled?: boolean;
}

export function useLiftGesture(ref: RefObject<HTMLElement>, opts: LiftGestureOptions): void {
  const { disabled } = opts;

  // Latch the latest callbacks OUTSIDE the effect (the useSwipeNav lesson):
  // listeners attach once; a re-render mid-drag never drops the gesture and
  // inline handlers never go stale.
  const cbRef = useRef(opts);
  cbRef.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let locked = false;
    let lastDy = 0;
    let raf = 0;
    const history: { y: number; t: number }[] = [];

    const now = () =>
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

    const damp = (dy: number): number => {
      // Full travel only toward a real destination; heavy resistance otherwise.
      const armed = dy < 0 ? !!cbRef.current.onLiftUp : !!cbRef.current.onPullDown;
      const scaled = armed ? dy : dy * 0.25;
      return Math.max(-LIFT.MAX_TRACK_PX, Math.min(LIFT.MAX_TRACK_PX, scaled));
    };

    const paint = () => {
      raf = 0;
      if (!locked) return;
      el.style.transform = `translateY(${damp(lastDy)}px)`;
    };

    const settle = (springBack: boolean) => {
      if (!locked) return;
      locked = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      if (springBack) {
        el.style.transition = "transform 220ms var(--cog-ease, cubic-bezier(0.25,0.46,0.45,0.94))";
        el.style.transform = "translateY(0)";
        window.setTimeout(() => {
          el.style.transition = "";
          el.style.transform = "";
          el.style.willChange = "";
        }, 240);
      } else {
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        settle(true);
        return;
      }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      locked = false;
      lastDy = 0;
      history.length = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!t) return;
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (!locked) {
        if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > LIFT.INTENT_PX) {
          tracking = false; // horizontal-dominant â€” not ours
          return;
        }
        if (Math.abs(dy) < LIFT.INTENT_PX) return;
        locked = true;
        if (!reducedMotion) {
          el.style.transition = "none";
          el.style.willChange = "transform";
        }
      }
      lastDy = dy;
      const tNow = now();
      history.push({ y: t.clientY, t: tNow });
      while (history.length > 1 && tNow - history[0].t > 100) history.shift();
      if (!reducedMotion && !raf) raf = requestAnimationFrame(paint);
    };

    const onEnd = (e: TouchEvent) => {
      const was = tracking;
      tracking = false;
      if (!was || !locked) {
        settle(true);
        return;
      }
      const t = e.changedTouches[0];
      const dy = t ? t.clientY - startY : lastDy;
      const ref0 = history[0];
      const dt = ref0 ? now() - ref0.t : 0;
      const velocity = ref0 && dt > 0 && dt < 200 ? (t.clientY - ref0.y) / dt : 0;

      const commitUp =
        !!cbRef.current.onLiftUp && (dy <= -LIFT.TRIGGER_PX || velocity <= -LIFT.FLICK_VELOCITY);
      const commitDown =
        !!cbRef.current.onPullDown && (dy >= LIFT.TRIGGER_PX || velocity >= LIFT.FLICK_VELOCITY);

      if (commitUp) {
        settle(false);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* nicety only */
        }
        cbRef.current.onLiftUp?.();
      } else if (commitDown) {
        settle(false);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* nicety only */
        }
        cbRef.current.onPullDown?.();
      } else {
        settle(true);
      }
    };

    const onCancel = () => {
      tracking = false;
      settle(true);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (locked) {
        el.style.transform = "";
        el.style.transition = "";
        el.style.willChange = "";
      }
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
    // Callbacks are latched via cb; only disabled/ref re-run the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, disabled]);
}

