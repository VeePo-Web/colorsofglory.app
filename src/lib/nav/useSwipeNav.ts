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
const TRIGGER_PX = 64;      // horizontal travel required to commit
const AXIS_RATIO = 1.6;     // horizontal must dominate vertical by this factor

/**
 * useSwipeNav — spatial paging gesture between peer surfaces.
 *
 * DOM-level touch handlers (zero React re-renders while tracking).
 * Guards: ignores touches starting within 44px of the viewport edges
 * (never fights the browser's edge-back gesture), touches inside
 * horizontal scrollers or elements marked data-no-swipe-nav, and
 * vertical-dominant movement (scrolling). The gesture is an accelerator
 * only — every destination it reaches also has a visible tap affordance.
 */
export function useSwipeNav(ref: RefObject<HTMLElement>, opts: SwipeNavOptions): void {
  const { onSwipeRight, onSwipeLeft, disabled } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

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

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { tracking = false; return; }
      const t = e.touches[0];
      const vw = window.innerWidth;
      if (t.clientX < EDGE_GUARD_PX || t.clientX > vw - EDGE_GUARD_PX) { tracking = false; return; }
      if (insideOptOut(e.target)) { tracking = false; return; }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < TRIGGER_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return; // scroll, not a page
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    };

    const onTouchCancel = () => { tracking = false; };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, onSwipeRight, onSwipeLeft, disabled]);
}
