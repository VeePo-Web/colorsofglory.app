import { useEffect, type RefObject } from "react";

interface SwipeNavOptions {
  /** Finger moved right (revealing the surface to the LEFT). */
  onSwipeRight?: () => void;
  /** Finger moved left (revealing the surface to the RIGHT). */
  onSwipeLeft?: () => void;
  /** Disable entirely (e.g. while recording). */
  disabled?: boolean;
}

const EDGE_GUARD_PX = 44;   // leave the screen edges to iOS Safari's own back/forward swipe
const INTENT_PX = 14;       // horizontal travel before the drag "locks" and starts tracking
const TRIGGER_PX = 64;      // horizontal travel required to commit on a slow drag
const MIN_FLICK_PX = 24;    // a fast flick still needs this much travel (vs a tap jitter)
const FLICK_VELOCITY = 0.4; // px/ms at release that commits a short quick flick (~native)
const AXIS_RATIO = 1.6;     // horizontal must dominate vertical by this factor
const RESIST = 0.22;        // damping when dragging toward a direction with no destination

/**
 * useSwipeNav — spatial paging gesture between peer surfaces.
 *
 * Finger-tracking: once horizontal intent locks, the surface translates 1:1
 * under the thumb (Snapchat/Apple Camera physicality), commits past the
 * threshold on release, and springs back on cancel. Directions without a
 * destination resist heavily instead of moving freely, so the geography
 * never lies. All motion is direct DOM transform — zero React re-renders.
 *
 * Guards: ignores touches starting within 44px of the viewport edges
 * (never fights the browser's edge-back gesture), touches inside
 * horizontal scrollers or elements marked data-no-swipe-nav, and
 * vertical-dominant movement (scrolling). Honors prefers-reduced-motion
 * by skipping the visual tracking while keeping the release commit.
 * The gesture is an accelerator only — every destination it reaches also
 * has a visible tap affordance.
 */
export function useSwipeNav(ref: RefObject<HTMLElement>, opts: SwipeNavOptions): void {
  const { onSwipeRight, onSwipeLeft, disabled } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let startX = 0;
    let startY = 0;
    let tracking = false;   // touch is eligible for the gesture
    let locked = false;     // horizontal intent confirmed — surface follows the finger
    let raf = 0;
    let lastDx = 0;
    let lastX = 0;          // for release-velocity (flick) detection
    let lastT = 0;

    const now = () =>
      (typeof performance !== "undefined" && performance.now) ? performance.now() : new Date().getTime();

    const insideOptOut = (target: EventTarget | null): boolean => {
      let node = target instanceof Element ? target : null;
      while (node && node !== el) {
        if (node instanceof HTMLElement) {
          if (node.dataset.noSwipeNav !== undefined) return true;
          const { overflowX } = getComputedStyle(node);
          if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) {
            return true;
          }
        }
        node = node.parentElement;
      }
      return false;
    };

    const dampen = (dx: number): number => {
      // Full travel only toward a real destination; heavy resistance otherwise.
      if (dx > 0) return onSwipeRight ? dx : dx * RESIST;
      return onSwipeLeft ? dx : dx * RESIST;
    };

    const paint = () => {
      raf = 0;
      if (!locked) return;
      el.style.transform = `translateX(${dampen(lastDx)}px)`;
    };

    const releaseVisual = (springBack: boolean) => {
      if (!locked) return;
      locked = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (springBack) {
        el.style.transition = "transform 250ms var(--cog-ease)";
        el.style.transform = "translateX(0)";
        window.setTimeout(() => {
          el.style.transition = "";
          el.style.transform = "";
          el.style.willChange = "";
        }, 280);
      } else {
        // Committing — the route change unmounts this surface; the destination's
        // directional entrance continues the motion.
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { tracking = false; releaseVisual(true); return; }
      const t = e.touches[0];
      const vw = window.innerWidth;
      if (t.clientX < EDGE_GUARD_PX || t.clientX > vw - EDGE_GUARD_PX) { tracking = false; return; }
      if (insideOptOut(e.target)) { tracking = false; return; }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      locked = false;
      lastDx = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || reducedMotion) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!locked) {
        if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > INTENT_PX) {
          // Vertical intent — this is a scroll; stand down for the rest of the touch.
          tracking = false;
          return;
        }
        if (Math.abs(dx) < INTENT_PX || Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;
        locked = true;
        el.style.animation = "none"; // a lingering entrance keyframe must not pin the transform
        el.style.transition = "none";
        el.style.willChange = "transform";
      }
      lastDx = dx;
      lastX = t.clientX;
      lastT = now();
      if (!raf) raf = requestAnimationFrame(paint);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const wasTracking = tracking;
      tracking = false;
      if (!wasTracking) return;
      const t = e.changedTouches[0];
      if (!t) { releaseVisual(true); return; }
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // Release velocity (px/ms) over the final move → commit a fast flick even
      // under the distance threshold, the way native pagers do. A finger held
      // still before release has a stale lastT, so velocity decays to ~0 and we
      // fall back to pure distance — a deliberate hold never false-commits.
      const dt = now() - lastT;
      const velocity = dt > 0 && dt < 120 ? (t.clientX - lastX) / dt : 0;
      const axisOk = Math.abs(dx) >= Math.abs(dy) * AXIS_RATIO;
      const farEnough = Math.abs(dx) >= TRIGGER_PX;
      const flicked = Math.abs(dx) >= MIN_FLICK_PX && Math.abs(velocity) >= FLICK_VELOCITY
        && Math.sign(velocity) === Math.sign(dx);
      const valid =
        (farEnough || flicked) &&
        axisOk &&
        (dx > 0 ? !!onSwipeRight : !!onSwipeLeft);
      releaseVisual(!valid);
      if (!valid) return;
      // A single soft tick confirms the page turn (Android-only enhancement —
      // iOS has no vibrate API; the visual slide carries the confirmation).
      try { navigator.vibrate?.(8); } catch { /* never let a nicety throw */ }
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    };

    const onTouchCancel = () => {
      tracking = false;
      releaseVisual(true);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      // If we're torn down mid-drag (disabled flipped, a sheet opened, the
      // callbacks changed identity), never leave the surface frozen offset —
      // reset the inline styles we applied. Only when actually locked, so an
      // idle re-run never clobbers the className entrance animation.
      if (locked) {
        el.style.transform = "";
        el.style.transition = "";
        el.style.willChange = "";
        el.style.animation = "";
      }
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, onSwipeRight, onSwipeLeft, disabled]);
}
