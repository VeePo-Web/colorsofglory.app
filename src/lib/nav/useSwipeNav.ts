import { useEffect, useRef, type RefObject } from "react";
import { SWIPE, decideSwipe } from "./swipeDecision";

/**
 * Should a touch that started on `target` be left alone by the page-swipe
 * gesture? True for: horizontal drag controls (an `<input type="range">` or any
 * `role="slider"` — e.g. the Pad volume + the audio scrubber, whose whole job
 * is a left/right drag), anything opted out with `data-no-swipe-nav`, and any
 * real horizontal scroller. Walks up to (but not including) `container`.
 *
 * Pure + exported so the slider-vs-swipe rule is unit-tested without a gesture.
 */
export function isSwipeOptOut(target: EventTarget | null, container: Element): boolean {
  let node: Element | null = target instanceof Element ? target : null;
  while (node && node !== container) {
    // A range slider / ARIA slider IS a horizontal drag — the page must never
    // steal it (dragging the Pad volume must not page over to Songs/Circle).
    if (node instanceof HTMLInputElement && node.type === "range") return true;
    if (node.getAttribute("role") === "slider") return true;
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
}

interface SwipeNavOptions {
  /** Finger moved right (revealing the surface to the LEFT). */
  onSwipeRight?: () => void;
  /** Finger moved left (revealing the surface to the RIGHT). */
  onSwipeLeft?: () => void;
  /** Disable entirely (e.g. while recording). */
  disabled?: boolean;
}

// Single source of truth for the tuning constants (shared with the tested
// decision logic in swipeDecision.ts).
const { EDGE_GUARD_PX, INTENT_PX, TRIGGER_PX, AXIS_RATIO, RESIST } = SWIPE;

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
  const { disabled } = opts;

  // Latch the latest callbacks in a ref so the touch listeners attach ONCE and
  // never re-subscribe when a caller passes inline (non-memoized) handlers.
  // Otherwise a re-render mid-drag (the data-heavy Songs list re-renders on
  // load / tour / filter) would tear down the listeners and silently drop the
  // in-flight swipe. Only `disabled` re-runs the effect — it must detach.
  const cbRef = useRef(opts);
  cbRef.current = opts;

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
    let armed = false;      // drag has passed the commit threshold this gesture
    let commitTimer = 0;    // pending navigate after the fly-out animation
    let springTimer = 0;    // pending spring-back cleanup (cancel on re-grab/teardown)
    // Rolling ~100ms position history for release-velocity (flick) detection.
    // Measuring only the last move→lift gap gives a near-zero window and misses
    // fast flicks; a short window over recent samples captures true flick speed.
    const history: { x: number; t: number }[] = [];

    const now = () =>
      (typeof performance !== "undefined" && performance.now) ? performance.now() : new Date().getTime();

    const dampen = (dx: number): number => {
      // Full travel only toward a real destination; heavy resistance otherwise.
      if (dx > 0) return cbRef.current.onSwipeRight ? dx : dx * RESIST;
      return cbRef.current.onSwipeLeft ? dx : dx * RESIST;
    };

    const paint = () => {
      raf = 0;
      if (!locked) return;
      el.style.transform = `translateX(${dampen(lastDx)}px)`;
      // Commit-point feedback: the moment the drag passes the release threshold
      // toward a real destination, the card lifts a little higher (and Android
      // gives one soft tick) so you KNOW letting go will turn the page — the
      // native "armed" cue. Drag back under the line and it relaxes.
      const canGo = lastDx > 0 ? !!cbRef.current.onSwipeRight : !!cbRef.current.onSwipeLeft;
      const nowArmed = canGo && Math.abs(lastDx) >= TRIGGER_PX;
      if (nowArmed !== armed) {
        armed = nowArmed;
        el.style.boxShadow = armed
          ? "0 0 64px rgba(28,26,23,0.26)"
          : "0 0 44px rgba(28,26,23,0.16)";
        if (armed) { try { navigator.vibrate?.(5); } catch { /* never let a nicety throw */ } }
      }
    };

    const releaseVisual = (springBack: boolean) => {
      if (!locked) return;
      locked = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (springBack) {
        el.style.transition = "transform 250ms var(--cog-ease)";
        el.style.transform = "translateX(0)";
        el.style.boxShadow = "";
        springTimer = window.setTimeout(() => {
          springTimer = 0;
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
        el.style.boxShadow = "";
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      // Re-grabbing during a spring-back: cancel its pending cleanup and settle
      // the surface at rest NOW, so the stale timer can't clear will-change mid
      // new drag (which would de-promote the layer and jank the rest of it).
      if (springTimer) {
        clearTimeout(springTimer);
        springTimer = 0;
        el.style.transition = "";
        el.style.transform = "";
        el.style.willChange = "";
      }
      if (e.touches.length !== 1) { tracking = false; releaseVisual(true); return; }
      const t = e.touches[0];
      const vw = window.innerWidth;
      if (t.clientX < EDGE_GUARD_PX || t.clientX > vw - EDGE_GUARD_PX) { tracking = false; return; }
      if (isSwipeOptOut(e.target, el)) { tracking = false; return; }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      locked = false;
      lastDx = 0;
      armed = false;
      history.length = 0;
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
        // Depth cue: the surface lifts as a card over the room beneath, so the
        // drag reads as layered paging, not a slide over empty background. The
        // shadow rides the promoted (will-change) layer with the transform, so
        // it's composited — no per-frame repaint.
        el.style.boxShadow = "0 0 44px rgba(28,26,23,0.16)";
      }
      lastDx = dx;
      const tNow = now();
      history.push({ x: t.clientX, t: tNow });
      while (history.length > 1 && tNow - history[0].t > 100) history.shift();
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
      // Release velocity (px/ms) over the last ~100ms of movement → commit a
      // fast flick even under the distance threshold, the way native pagers do.
      // A finger held still before release stops adding history, so the oldest
      // sample ages past the window and velocity decays to ~0 — falling back to
      // pure distance, so a deliberate hold-and-release never false-commits.
      const ref = history[0];
      const dt = ref ? now() - ref.t : 0;
      const velocity = ref && dt > 0 && dt < 200 ? (t.clientX - ref.x) / dt : 0;
      // Commit decision lives in swipeDecision.ts (pure + unit-tested).
      const dir = decideSwipe({
        dx, dy, velocity,
        hasLeft: !!cbRef.current.onSwipeLeft,
        hasRight: !!cbRef.current.onSwipeRight,
      });
      if (!dir) { releaseVisual(true); return; }

      // COMMIT — a real page turn. Instead of snapping the surface back to
      // centre and blinking it out (which read as "a screen got replaced"),
      // fling it the rest of the way off in the drag direction AND fade it,
      // then change the route into that fade. The opacity cross-fade masks
      // the single-surface mount swap; the incoming page slides in from its
      // spatial side to complete the motion.
      locked = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      try { navigator.vibrate?.(8); } catch { /* never let a nicety throw */ }
      // Velocity-responsive timing: a fast flick snaps through quickly (feels
      // instant), a slow deliberate drag gets the fuller, calmer fly-out — the
      // way native pagers behave. The faster the flick, the sooner the route
      // changes and the quicker the surface clears.
      const fast = Math.abs(velocity) >= SWIPE.FLICK_VELOCITY;
      const flyMs = fast ? 150 : 220;
      const navMs = fast ? 90 : 150;
      const outX = Math.round(window.innerWidth * (dir === "right" ? 0.5 : -0.5));
      el.style.transition = `transform ${flyMs}ms cubic-bezier(0.4,0,1,1), opacity ${flyMs - 20}ms ease-out`;
      el.style.transform = `translateX(${outX}px)`;
      el.style.opacity = "0";
      commitTimer = window.setTimeout(() => {
        commitTimer = 0;
        if (dir === "right") cbRef.current.onSwipeRight?.();
        else cbRef.current.onSwipeLeft?.();
      }, navMs);
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
      // A commit fly-out is mid-flight and the surface is about to be torn down
      // for a reason other than our own navigate — cancel the pending route
      // change and restore the surface so it can never be stranded faded/offset.
      if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = 0;
        el.style.transform = "";
        el.style.transition = "";
        el.style.opacity = "";
        el.style.willChange = "";
        el.style.boxShadow = "";
      }
      if (springTimer) clearTimeout(springTimer);
      // If we're torn down mid-drag (disabled flipped, a sheet opened, the
      // callbacks changed identity), never leave the surface frozen offset —
      // reset the inline styles we applied. Only when actually locked, so an
      // idle re-run never clobbers the className entrance animation.
      if (locked) {
        el.style.transform = "";
        el.style.transition = "";
        el.style.willChange = "";
        el.style.animation = "";
        el.style.boxShadow = "";
      }
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [ref, disabled]);
}
