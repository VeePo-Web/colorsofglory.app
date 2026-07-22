import { useEffect, useRef, type RefObject } from "react";
import { decideLift, LIFT } from "./liftDecision";

/**
 * useLiftGesture — the handle-anchored vertical drag (docs/FLOW-ACCESS-CONTRACT.md),
 * the vertical sibling of useSwipeNav: same constants (liftDecision mirrors
 * swipeDecision), same armed haptic, same velocity-responsive commit
 * fly-out — ONE gesture family, one feel.
 *
 * Anchoring: listeners attach to the handle/grabber element itself, so the
 * gesture structurally cannot fight canvas pan, list scroll, or the
 * horizontal pager (those live in the content, not on the handle).
 *
 * `visualTarget` is what follows the finger — defaults to the handle, but
 * a full-screen set-down passes the page wrapper so the WHOLE surface
 * rides the drag (the Apple-Music sheet dismissal). Reduced motion skips
 * every visual and commits instantly at the same thresholds; every
 * consumer keeps a tap path — the gesture is an enhancement.
 */

export { LIFT } from "./liftDecision";

interface LiftGestureOptions {
  /** Commit when dragged UP past the threshold (the lift). */
  onLiftUp?: () => void;
  /** Commit when dragged DOWN past the threshold (the set-down). */
  onPullDown?: () => void;
  /** The element that visually follows the finger (default: the handle). */
  visualTarget?: RefObject<HTMLElement>;
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
    let armed = false; // past the commit line this gesture (haptic once)
    let commitTimer = 0;
    let springTimer = 0;
    const history: { y: number; t: number }[] = [];

    const target = (): HTMLElement => cbRef.current.visualTarget?.current ?? el;

    const now = () =>
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

    const damp = (dy: number): number => {
      const hasDest = dy < 0 ? !!cbRef.current.onLiftUp : !!cbRef.current.onPullDown;
      const scaled = hasDest ? dy : dy * LIFT.RESIST;
      return Math.max(-LIFT.MAX_TRACK_PX, Math.min(LIFT.MAX_TRACK_PX, scaled));
    };

    const paint = () => {
      raf = 0;
      if (!locked) return;
      const t = target();
      t.style.transform = `translateY(${damp(lastDy)}px)`;
      // Commit-point feedback — the same soft tick as the horizontal pager,
      // so crossing the line FEELS identical in both axes.
      const canGo = lastDy < 0 ? !!cbRef.current.onLiftUp : !!cbRef.current.onPullDown;
      const nowArmed = canGo && Math.abs(lastDy) >= LIFT.TRIGGER_PX;
      if (nowArmed !== armed) {
        armed = nowArmed;
        if (armed) {
          try { navigator.vibrate?.(5); } catch { /* nicety only */ }
        }
      }
    };

    const clearVisual = (t: HTMLElement) => {
      t.style.transform = "";
      t.style.transition = "";
      t.style.willChange = "";
      t.style.opacity = "";
    };

    const settle = (springBack: boolean) => {
      if (!locked) return;
      locked = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const t = target();
      if (springBack) {
        t.style.transition = "transform 220ms var(--cog-ease, cubic-bezier(0.25,0.46,0.45,0.94))";
        t.style.transform = "translateY(0)";
        springTimer = window.setTimeout(() => {
          springTimer = 0;
          clearVisual(t);
        }, 240);
      } else {
        clearVisual(t);
      }
    };

    const onStart = (e: TouchEvent) => {
      // Re-grabbing during a spring-back: settle at rest NOW so the stale
      // timer can't clear will-change mid new drag.
      if (springTimer) {
        clearTimeout(springTimer);
        springTimer = 0;
        clearVisual(target());
      }
      if (e.touches.length !== 1) { tracking = false; settle(true); return; }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      locked = false;
      lastDy = 0;
      armed = false;
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
          tracking = false; // horizontal-dominant — the pager/pan wins
          return;
        }
        if (Math.abs(dy) < LIFT.INTENT_PX) return;
        locked = true;
        if (!reducedMotion) {
          const vt = target();
          vt.style.transition = "none";
          vt.style.willChange = "transform";
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
      if (!was || !locked) { settle(true); return; }
      const t = e.changedTouches[0];
      const dy = t ? t.clientY - startY : lastDy;
      const dx = t ? t.clientX - startX : 0;
      const ref0 = history[0];
      const dt = ref0 ? now() - ref0.t : 0;
      const velocity = ref0 && dt > 0 && dt < 200 ? (t.clientY - ref0.y) / dt : 0;

      const dir = decideLift({
        dy, dx, velocity,
        hasUp: !!cbRef.current.onLiftUp,
        hasDown: !!cbRef.current.onPullDown,
      });
      if (!dir) { settle(true); return; }

      // COMMIT — the same choreography as the horizontal pager: fly the
      // visual the rest of the way in the drag direction AND fade it, with
      // velocity-responsive timing (a flick snaps, a slow drag glides),
      // then fire the callback into the fade.
      locked = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      try { navigator.vibrate?.(8); } catch { /* nicety only */ }

      const vt = target();
      if (reducedMotion) {
        clearVisual(vt);
        if (dir === "up") cbRef.current.onLiftUp?.();
        else cbRef.current.onPullDown?.();
        return;
      }
      const fast = Math.abs(velocity) >= LIFT.FLICK_VELOCITY;
      const flyMs = fast ? 150 : 220;
      const cbMs = fast ? 90 : 150;
      const isHandleSized = vt === el;
      const outY = isHandleSized
        ? (dir === "up" ? -LIFT.MAX_TRACK_PX : LIFT.MAX_TRACK_PX)
        : Math.round(window.innerHeight * (dir === "up" ? -0.5 : 0.5));
      vt.style.transition = `transform ${flyMs}ms cubic-bezier(0.4,0,1,1), opacity ${flyMs - 20}ms ease-out`;
      vt.style.transform = `translateY(${outY}px)`;
      vt.style.opacity = "0";
      commitTimer = window.setTimeout(() => {
        commitTimer = 0;
        if (dir === "up") cbRef.current.onLiftUp?.();
        else cbRef.current.onPullDown?.();
      }, cbMs);
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
      // A commit fly-out is mid-flight and we're torn down for another
      // reason — cancel the pending callback and restore the visual so it
      // can never be stranded faded/offset.
      if (commitTimer) {
        clearTimeout(commitTimer);
        commitTimer = 0;
        clearVisual(target());
      }
      if (springTimer) clearTimeout(springTimer);
      if (locked) clearVisual(target());
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
    // Callbacks latched via cbRef; only disabled/ref re-run the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, disabled]);
}
