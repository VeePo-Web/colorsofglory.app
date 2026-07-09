import { useRef, useCallback, useEffect } from "react";

export interface GestureState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface UseGestureOptions {
  minZoom?: number;
  maxZoom?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  /** Called on every frame during gesture — write to DOM directly for 60fps */
  onTransform: (panX: number, panY: number, zoom: number) => void;
  /** Called when gesture ends — update React state once */
  onTransformEnd: (panX: number, panY: number, zoom: number) => void;
  /** Optional: broadcast cursor position to collaborators (throttled) */
  onCursorMove?: (canvasX: number, canvasY: number) => void;
}

const CURSOR_BROADCAST_INTERVAL = 100; // ms

/** Imperative reduced-motion check for the animation paths (panTo/fitTo jump). */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * True when a pointerdown lands on something that should handle its own press
 * rather than pan the canvas: any card, or any button/link/tab/slider in the
 * overlay. Mark bespoke non-pan surfaces with `data-canvas-nopan`.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return !!el.closest(
    'button, a, input, select, textarea, [role="button"], [role="tab"], [role="slider"], [data-canvas-card], [data-canvas-nopan]',
  );
}

/**
 * useGesture — isolated touch gesture logic for the canvas viewport.
 *
 * Handles:
 *  - Single-finger / mouse drag → pan
 *  - Two-finger drag → pan
 *  - Two-finger pinch → zoom centered on pinch midpoint
 *  - Mouse wheel → zoom centered on cursor
 *
 * CRITICAL: All state during active gestures is stored in refs (not useState).
 * onTransform() is called via rAF — never triggers a React re-render during pan.
 * onTransformEnd() is called once per gesture to sync React state.
 */
export function useGesture(
  containerRef: React.RefObject<HTMLElement>,
  initialState: GestureState,
  options: UseGestureOptions
) {
  const {
    minZoom = 0.4,
    maxZoom = 2.5,
    canvasWidth = 2400,
    canvasHeight = 3200,
    onTransform,
    onTransformEnd,
    onCursorMove,
  } = options;

  // Live gesture state — refs to avoid React re-renders during pan
  const pan = useRef({ x: initialState.panX, y: initialState.panY });
  const zoom = useRef(initialState.zoom);
  const rafId = useRef<number>(0);
  const isDirty = useRef(false);
  // Active panTo() animation frame, tracked so a new gesture (or a new panTo, or
  // unmount) can cancel it — otherwise two rAF loops fight over pan.current.
  const panToRaf = useRef<number>(0);

  // Pointer tracking
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const prevPinchDist = useRef<number | null>(null);
  const prevPinchMid = useRef<{ x: number; y: number } | null>(null);

  // The container's screen offset, captured once per gesture (on pointerdown).
  // `pan` lives in CONTAINER-relative space (the transformed layer sits at the
  // container's 0,0), so any absolute screen point — the pinch focal midpoint, a
  // broadcast cursor — MUST be made container-relative before it touches pan math.
  // Cached here so the 60fps move path never forces a layout read.
  const containerOffset = useRef<{ left: number; top: number }>({ left: 0, top: 0 });

  // Recent single-pointer pan movement (screen px + timestamps) for release
  // inertia. Cleared on every pointerdown and on pinch.
  const velocitySamples = useRef<Array<{ dx: number; dy: number; t: number }>>([]);

  // Cursor broadcast throttle
  const lastCursorBroadcast = useRef(0);

  // ── Transform helpers ─────────────────────────────────────────────────────

  function clamp(v: number, lo: number, hi: number) {
    return Math.min(hi, Math.max(lo, v));
  }

  function clampPan(x: number, y: number, z: number, viewW: number, viewH: number) {
    const margin = 120;
    // When the zoomed canvas is smaller than the viewport on an axis, center it
    // instead of pinning to a corner (lo > hi would otherwise snap to `hi`).
    const loX = viewW - canvasWidth * z - margin;
    const loY = viewH - canvasHeight * z - margin;
    return {
      x: loX > margin ? (viewW - canvasWidth * z) / 2 : clamp(x, loX, margin),
      y: loY > margin ? (viewH - canvasHeight * z) / 2 : clamp(y, loY, margin),
    };
  }

  function scheduleApply() {
    isDirty.current = true;
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      if (!isDirty.current) return;
      isDirty.current = false;
      onTransform(pan.current.x, pan.current.y, zoom.current);
    });
  }

  function applyZoomAt(scaleDelta: number, screenX: number, screenY: number) {
    const newZoom = clamp(zoom.current * scaleDelta, minZoom, maxZoom);
    if (newZoom === zoom.current) return;

    // Keep the canvas point under the pinch/cursor fixed
    const canvasX = (screenX - pan.current.x) / zoom.current;
    const canvasY = (screenY - pan.current.y) / zoom.current;
    pan.current.x = screenX - canvasX * newZoom;
    pan.current.y = screenY - canvasY * newZoom;
    zoom.current = newZoom;
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: PointerEvent) => {
    // Only respond to touch or left-button drag
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A press on an interactive control (card, quick-nav pill, dock button)
    // never starts a ONE-finger pan — the control runs its own handlers and
    // the canvas steps aside. BUT if another pointer is already panning, this
    // second finger joins the gesture regardless of what it landed on, so a
    // pinch that begins with one finger on a card still zooms instead of
    // half-panning (the card side aborts its own drag on the same signal —
    // see CanvasCard's second-pointer guard).
    const interactive = isInteractiveTarget(e.target);
    if (interactive && pointers.current.size === 0) return;
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // A direct touch always wins over an in-flight panTo/inertia animation —
    // cancel it so the finger and the easing curve don't fight over pan.current.
    if (panToRaf.current) {
      cancelAnimationFrame(panToRaf.current);
      panToRaf.current = 0;
    }
    // Refresh the container offset at the start of each gesture — it can change
    // between gestures (scroll, rotate, keyboard) but is stable during one.
    const el = containerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      containerOffset.current = { left: r.left, top: r.top };
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    velocitySamples.current.length = 0;
  }, [containerRef]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) {
      // Adopt an untracked TOUCH pointer mid-gesture: when a pinch begins with
      // one finger on a card, the card aborts its drag and releases capture —
      // that finger's moves then bubble here and join the tracked finger so
      // the pinch works. Touch-only (mouse hover also fires pointermove).
      if (e.pointerType === "touch" && pointers.current.size >= 1) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        prevPinchMid.current = null;
        prevPinchDist.current = null;
        velocitySamples.current.length = 0;
      }
      return;
    }

    const viewEl = containerRef.current;
    if (!viewEl) return;
    const viewW = viewEl.clientWidth;
    const viewH = viewEl.clientHeight;

    const prev = pointers.current.get(e.pointerId)!;
    const curr = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, curr);

    const pts = Array.from(pointers.current.values());

    if (pts.length === 1) {
      // Single pointer: pan
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      pan.current.x += dx;
      pan.current.y += dy;
      const clamped = clampPan(pan.current.x, pan.current.y, zoom.current, viewW, viewH);
      pan.current = clamped;
      // Keep a short velocity window for release inertia (touch only).
      if (e.pointerType === "touch") {
        const now = performance.now();
        velocitySamples.current.push({ dx, dy, t: now });
        while (velocitySamples.current.length > 5) velocitySamples.current.shift();
      }
    } else if (pts.length >= 2) {
      // Two fingers: pinch-zoom + pan
      const [a, b] = pts;
      const newMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const newDist = Math.hypot(b.x - a.x, b.y - a.y);

      if (prevPinchMid.current && prevPinchDist.current !== null) {
        // Pan by midpoint delta
        pan.current.x += newMid.x - prevPinchMid.current.x;
        pan.current.y += newMid.y - prevPinchMid.current.y;

        // Zoom centered on the pinch midpoint. The midpoint is in viewport
        // (clientX/Y) space — convert to container-relative so the canvas point
        // under the fingers stays locked as it scales (matching the wheel path).
        // Without this the focal point drifts by the container's screen offset
        // (e.g. the header height), making pinch-zoom "swim" on mobile.
        if (prevPinchDist.current > 0) {
          const scaleDelta = newDist / prevPinchDist.current;
          applyZoomAt(
            scaleDelta,
            newMid.x - containerOffset.current.left,
            newMid.y - containerOffset.current.top,
          );
        }

        const clamped = clampPan(pan.current.x, pan.current.y, zoom.current, viewW, viewH);
        pan.current = clamped;
      }

      prevPinchMid.current = newMid;
      prevPinchDist.current = newDist;
    }

    scheduleApply();

    // Broadcast cursor position (throttled)
    if (onCursorMove && e.pointerType !== "touch") {
      const now = Date.now();
      if (now - lastCursorBroadcast.current > CURSOR_BROADCAST_INTERVAL) {
        lastCursorBroadcast.current = now;
        // Make the pointer container-relative before converting to canvas space,
        // or every collaborator sees this cursor offset by the container's screen
        // position.
        const canvasX = (e.clientX - containerOffset.current.left - pan.current.x) / zoom.current;
        const canvasY = (e.clientY - containerOffset.current.top - pan.current.y) / zoom.current;
        onCursorMove(canvasX, canvasY);
      }
    }
  }, [containerRef, onCursorMove]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerUp = useCallback((e: PointerEvent) => {
    const wasTracked = pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) {
      prevPinchMid.current = null;
      prevPinchDist.current = null;
    }
    if (pointers.current.size === 0) {
      // Release inertia: a flicked pan glides to rest instead of dead-stopping
      // (Freeform feel). Skipped for cancel, reduced-motion, and slow lifts.
      const samples = velocitySamples.current;
      velocitySamples.current = [];
      if (
        wasTracked &&
        e.type === "pointerup" &&
        samples.length >= 3 &&
        !prefersReducedMotion()
      ) {
        const windowMs = samples[samples.length - 1].t - samples[0].t;
        if (windowMs > 0 && windowMs < 160) {
          let vx = samples.reduce((s, p) => s + p.dx, 0) / windowMs; // px/ms
          let vy = samples.reduce((s, p) => s + p.dy, 0) / windowMs;
          const speed = Math.hypot(vx, vy);
          if (speed > 0.25) {
            const el = containerRef.current;
            let last = performance.now();
            const glide = (now: number) => {
              const dt = now - last;
              last = now;
              const decay = Math.pow(0.94, dt / (1000 / 60));
              vx *= decay;
              vy *= decay;
              pan.current.x += vx * dt;
              pan.current.y += vy * dt;
              if (el) {
                pan.current = clampPan(
                  pan.current.x, pan.current.y, zoom.current,
                  el.clientWidth, el.clientHeight,
                );
              }
              onTransform(pan.current.x, pan.current.y, zoom.current);
              if (Math.hypot(vx, vy) > 0.02) {
                panToRaf.current = requestAnimationFrame(glide);
              } else {
                panToRaf.current = 0;
                onTransformEnd(pan.current.x, pan.current.y, zoom.current);
              }
            };
            if (panToRaf.current) cancelAnimationFrame(panToRaf.current);
            panToRaf.current = requestAnimationFrame(glide);
            return;
          }
        }
      }
      // Gesture ended — sync to React state once
      onTransformEnd(pan.current.x, pan.current.y, zoom.current);
    }
  }, [onTransform, onTransformEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mouse wheel zoom ──────────────────────────────────────────────────────

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const viewEl = containerRef.current;
    if (!viewEl) return;
    const viewW = viewEl.clientWidth;
    const viewH = viewEl.clientHeight;

    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch (and ctrl+wheel): magnitude-proportional zoom at the
      // cursor — a fixed ×1.1 per tick rocketed across the zoom range.
      const rect = viewEl.getBoundingClientRect();
      applyZoomAt(
        Math.exp(-e.deltaY * 0.0035),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    } else {
      // Plain wheel / two-finger trackpad scroll: PAN (the Figma/FigJam
      // standard) — previously there was no way to pan with a trackpad at all.
      pan.current.x -= e.deltaX;
      pan.current.y -= e.deltaY;
    }

    const clamped = clampPan(pan.current.x, pan.current.y, zoom.current, viewW, viewH);
    pan.current = clamped;

    scheduleApply();

    // Debounce the state sync on wheel
    clearTimeout((onWheel as { _t?: ReturnType<typeof setTimeout> })._t);
    (onWheel as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      onTransformEnd(pan.current.x, pan.current.y, zoom.current);
    }, 150);
  }, [containerRef, onTransformEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register events on the container ─────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp, { passive: false });
    el.addEventListener("pointercancel", onPointerUp, { passive: false });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (panToRaf.current) cancelAnimationFrame(panToRaf.current);
    };
  }, [containerRef, onPointerDown, onPointerMove, onPointerUp, onWheel]);

  // ── Coordinate conversion utilities ───────────────────────────────────────

  const canvasToScreen = useCallback((cx: number, cy: number) => ({
    x: cx * zoom.current + pan.current.x,
    y: cy * zoom.current + pan.current.y,
  }), []);

  const screenToCanvas = useCallback((sx: number, sy: number) => ({
    x: (sx - pan.current.x) / zoom.current,
    y: (sy - pan.current.y) / zoom.current,
  }), []);

  // ── Pan-to animation ──────────────────────────────────────────────────────

  const panTo = useCallback((
    targetCanvasX: number,
    targetCanvasY: number,
    viewportCenterX: number,
    viewportCenterY: number,
    durationMs = 400
  ) => {
    // Cancel any panTo already running so two animations can't fight.
    if (panToRaf.current) cancelAnimationFrame(panToRaf.current);

    const startPanX = pan.current.x;
    const startPanY = pan.current.y;
    const targetPanX = viewportCenterX - targetCanvasX * zoom.current;
    const targetPanY = viewportCenterY - targetCanvasY * zoom.current;
    // Reduced motion: jump to the destination, no easing.
    if (prefersReducedMotion()) {
      pan.current.x = targetPanX; pan.current.y = targetPanY;
      onTransform(pan.current.x, pan.current.y, zoom.current);
      onTransformEnd(pan.current.x, pan.current.y, zoom.current);
      return;
    }
    const start = performance.now();

    function frame(now: number) {
      const t = Math.min((now - start) / durationMs, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      pan.current.x = startPanX + (targetPanX - startPanX) * ease;
      pan.current.y = startPanY + (targetPanY - startPanY) * ease;
      onTransform(pan.current.x, pan.current.y, zoom.current);
      if (t < 1) {
        panToRaf.current = requestAnimationFrame(frame);
      } else {
        panToRaf.current = 0;
        onTransformEnd(pan.current.x, pan.current.y, zoom.current);
      }
    }

    panToRaf.current = requestAnimationFrame(frame);
  }, [onTransform, onTransformEnd]);

  // ── Animate pan AND zoom together (semantic nav: fit-to-view, zone framing) ──

  const animateTo = useCallback((
    targetPanX: number,
    targetPanY: number,
    targetZoom: number,
    durationMs = 520,
  ) => {
    if (panToRaf.current) cancelAnimationFrame(panToRaf.current);
    const z = clamp(targetZoom, minZoom, maxZoom);
    // Land only where a touch could pan to — an unclamped fly-to used to park
    // the view where the next gesture instantly snapped it somewhere else.
    const el = containerRef.current;
    if (el) {
      const c = clampPan(targetPanX, targetPanY, z, el.clientWidth, el.clientHeight);
      targetPanX = c.x;
      targetPanY = c.y;
    }
    const startPanX = pan.current.x;
    const startPanY = pan.current.y;
    const startZoom = zoom.current;
    // Reduced motion: jump to the destination, no easing.
    if (prefersReducedMotion()) {
      pan.current.x = targetPanX; pan.current.y = targetPanY; zoom.current = z;
      onTransform(pan.current.x, pan.current.y, zoom.current);
      onTransformEnd(pan.current.x, pan.current.y, zoom.current);
      return;
    }
    const start = performance.now();

    function frame(now: number) {
      const t = Math.min((now - start) / durationMs, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      pan.current.x = startPanX + (targetPanX - startPanX) * ease;
      pan.current.y = startPanY + (targetPanY - startPanY) * ease;
      zoom.current = startZoom + (z - startZoom) * ease;
      onTransform(pan.current.x, pan.current.y, zoom.current);
      if (t < 1) {
        panToRaf.current = requestAnimationFrame(frame);
      } else {
        panToRaf.current = 0;
        onTransformEnd(pan.current.x, pan.current.y, zoom.current);
      }
    }
    panToRaf.current = requestAnimationFrame(frame);
  }, [onTransform, onTransformEnd, minZoom, maxZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Frame a canvas-space box in the viewport: choose the zoom that fits it
   * (respecting min/max) and center it, animated. Used by fit-to-view, jump-to
   * -zone, and tap-a-cluster-to-frame-it.
   */
  const fitTo = useCallback((
    box: { minX: number; minY: number; maxX: number; maxY: number },
    viewW: number,
    viewH: number,
    padding = 72,
    durationMs = 520,
  ) => {
    const bw = Math.max(1, box.maxX - box.minX);
    const bh = Math.max(1, box.maxY - box.minY);
    const z = clamp(
      Math.min((viewW - 2 * padding) / bw, (viewH - 2 * padding) / bh),
      minZoom,
      maxZoom,
    );
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    animateTo(viewW / 2 - cx * z, viewH / 2 - cy * z, z, durationMs);
  }, [animateTo, minZoom, maxZoom]);

  // ── Keyboard controls (accessibility) ───────────────────────────────────────

  /** Pan by a screen-space delta (arrow keys). Instant, clamped, state-synced. */
  const nudge = useCallback((dx: number, dy: number) => {
    const el = containerRef.current;
    if (!el) return;
    pan.current.x += dx;
    pan.current.y += dy;
    const c = clampPan(pan.current.x, pan.current.y, zoom.current, el.clientWidth, el.clientHeight);
    pan.current = c;
    onTransform(c.x, c.y, zoom.current);
    onTransformEnd(c.x, c.y, zoom.current);
  }, [containerRef, onTransform, onTransformEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Zoom by a factor about the viewport center (+/- keys). */
  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    applyZoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
    const c = clampPan(pan.current.x, pan.current.y, zoom.current, el.clientWidth, el.clientHeight);
    pan.current = c;
    onTransform(c.x, c.y, zoom.current);
    onTransformEnd(c.x, c.y, zoom.current);
  }, [containerRef, onTransform, onTransformEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag-time pan (edge auto-pan while a card is being dragged) ────────────

  /**
   * Pan by a screen delta WITHOUT the per-call React state sync — safe to call
   * every frame from a card drag's edge auto-pan loop. Caller must finish with
   * endDragPan() so React state syncs once.
   */
  const dragPanBy = useCallback((dx: number, dy: number) => {
    const el = containerRef.current;
    if (!el) return;
    pan.current.x += dx;
    pan.current.y += dy;
    pan.current = clampPan(pan.current.x, pan.current.y, zoom.current, el.clientWidth, el.clientHeight);
    onTransform(pan.current.x, pan.current.y, zoom.current);
  }, [onTransform]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sync React state once after a dragPanBy sequence ends. */
  const endDragPan = useCallback(() => {
    onTransformEnd(pan.current.x, pan.current.y, zoom.current);
  }, [onTransformEnd]);

  return { canvasToScreen, screenToCanvas, panTo, animateTo, fitTo, nudge, zoomBy, dragPanBy, endDragPan, panRef: pan, zoomRef: zoom };
}
