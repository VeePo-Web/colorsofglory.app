import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGesture } from "@/hooks/useGesture";

// ─── Constants ───────────────────────────────────────────────────────────────

export const CANVAS_WIDTH = 2400;    // total canvas width (Ideas + Final zones)
export const CANVAS_HEIGHT = 3200;   // total canvas height
export const DIVIDER_X = CANVAS_WIDTH / 2;  // center split between trees
export const IDEAS_ZONE_WIDTH = CANVAS_WIDTH / 2;
export const FINAL_ZONE_WIDTH = CANVAS_WIDTH / 2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const INITIAL_ZOOM = 1.0;

// ─── Context ─────────────────────────────────────────────────────────────────

interface ViewportCtx {
  /** Convert canvas coordinates → screen coordinates */
  canvasToScreen: (cx: number, cy: number) => { x: number; y: number };
  /** Convert screen coordinates → canvas coordinates */
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
  /** Animate pan so canvas point (cx, cy) lands at the viewport center */
  panTo: (cx: number, cy: number, vcx: number, vcy: number, ms?: number) => void;
  /** Current zoom (read-only, updates after gesture ends) */
  zoom: number;
  /** Current pan (read-only, updates after gesture ends) */
  panX: number;
  panY: number;
}

const CanvasViewportContext = createContext<ViewportCtx | null>(null);

export function useCanvasViewport(): ViewportCtx {
  const ctx = useContext(CanvasViewportContext);
  if (!ctx) throw new Error("useCanvasViewport must be used inside <CanvasViewport>");
  return ctx;
}

// ─── CanvasViewport ───────────────────────────────────────────────────────────

interface CanvasViewportProps {
  children: ReactNode;
  /** Extra content rendered OUTSIDE the transforming layer (e.g., fixed overlays) */
  overlay?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Optional: receive cursor position in canvas coords (throttled 100ms) */
  onCursorMove?: (cx: number, cy: number) => void;
  /** Optional: initial pan offsets (useful for restoring saved viewport) */
  initialPan?: { x: number; y: number };
  /** Optional: initial zoom */
  initialZoom?: number;
}

/**
 * CanvasViewport — the infinite pan/zoom canvas container.
 *
 * Architecture:
 *   <div class="viewport">         ← fixed size, overflow:hidden, captures gestures
 *     <div class="canvas-layer">   ← GPU-composited, receives transform
 *       {children}                 ← cards, divider, labels (absolute positioned)
 *     </div>
 *     {overlay}                    ← fixed overlays, not transformed
 *   </div>
 *
 * Performance contract:
 *   - All pan/zoom writes go directly to DOM via ref.style.transform (zero React renders)
 *   - React state updates ONLY when gestures end (to persist final values)
 *   - will-change: transform enabled during gesture, cleared after
 *   - touch-action: none prevents browser scroll interference
 */
const CanvasViewport = ({
  children,
  overlay,
  className = "",
  style,
  onCursorMove,
  initialPan,
  initialZoom = INITIAL_ZOOM,
}: CanvasViewportProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);

  // React state — synced once per gesture end (not during)
  const [reactPan, setReactPan] = useState({ x: initialPan?.x ?? 0, y: initialPan?.y ?? 0 });
  const [reactZoom, setReactZoom] = useState(initialZoom);

  // Write transform directly to DOM — bypasses React render cycle
  const applyTransform = useCallback((px: number, py: number, z: number) => {
    if (!canvasLayerRef.current) return;
    canvasLayerRef.current.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
  }, []);

  const handleTransformEnd = useCallback((px: number, py: number, z: number) => {
    applyTransform(px, py, z);
    setReactPan({ x: px, y: py });
    setReactZoom(z);
    // Remove will-change hint after gesture (browser can de-promote the layer)
    if (canvasLayerRef.current) {
      canvasLayerRef.current.style.willChange = "auto";
    }
  }, [applyTransform]);

  const handleTransform = useCallback((px: number, py: number, z: number) => {
    applyTransform(px, py, z);
    // Set will-change only when actively transforming
    if (canvasLayerRef.current) {
      canvasLayerRef.current.style.willChange = "transform";
    }
  }, [applyTransform]);

  const { canvasToScreen, screenToCanvas, panTo, panRef, zoomRef } = useGesture(
    containerRef as React.RefObject<HTMLElement>,
    { panX: reactPan.x, panY: reactPan.y, zoom: reactZoom },
    {
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      onTransform: handleTransform,
      onTransformEnd: handleTransformEnd,
      onCursorMove,
    }
  );

  // Center canvas on initial load
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (initialPan) {
      panRef.current = { x: initialPan.x, y: initialPan.y };
    } else {
      // Center on the Ideas zone horizontally, offset vertically
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      panRef.current = {
        x: vw / 2 - IDEAS_ZONE_WIDTH / 2,
        y: vh / 2 - 400,
      };
    }
    zoomRef.current = initialZoom;
    applyTransform(panRef.current.x, panRef.current.y, zoomRef.current);
    setReactPan({ x: panRef.current.x, y: panRef.current.y });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable context value — coordinate helpers reference refs so they're always current
  const ctxValue: ViewportCtx = {
    canvasToScreen: useCallback((cx, cy) => ({
      x: cx * zoomRef.current + panRef.current.x,
      y: cy * zoomRef.current + panRef.current.y,
    }), [panRef, zoomRef]),
    screenToCanvas: useCallback((sx, sy) => ({
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    }), [panRef, zoomRef]),
    panTo,
    zoom: reactZoom,
    panX: reactPan.x,
    panY: reactPan.y,
  };

  return (
    <CanvasViewportContext.Provider value={ctxValue}>
      <div
        ref={containerRef}
        className={`relative overflow-hidden ${className}`}
        style={{
          touchAction: "none",       // prevent browser scroll hijacking gestures
          userSelect: "none",        // prevent text selection during drag
          WebkitUserSelect: "none",
          cursor: "grab",
          ...style,
        }}
        aria-label="Song canvas — drag to pan, pinch to zoom"
        role="application"
      >
        {/* The transforming layer — GPU-composited */}
        <div
          ref={canvasLayerRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transformOrigin: "0 0",
            // Dot grid background
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(181,147,90,0.09) 1.5px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        >
          {children}
        </div>

        {/* Fixed overlays — not transformed (e.g., first-action prompt, zoom controls) */}
        {overlay}
      </div>
    </CanvasViewportContext.Provider>
  );
};

export default CanvasViewport;
