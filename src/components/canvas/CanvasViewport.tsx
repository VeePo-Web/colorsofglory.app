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
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
} from "@/lib/canvas/canvasConstants";

// ─── Constants ───────────────────────────────────────────────────────────────

// 0.25 lets fitTo genuinely frame the whole song on a 390px phone (the old
// 0.4 floor meant "Fit" framed an empty middle band with both trees cut off).
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const INITIAL_ZOOM = 1.0;

// ─── Context ─────────────────────────────────────────────────────────────────

export interface ViewportCtx {
  /** Convert canvas coordinates → screen coordinates */
  canvasToScreen: (cx: number, cy: number) => { x: number; y: number };
  /** Convert screen coordinates → canvas coordinates */
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number };
  /** Animate pan so canvas point (cx, cy) lands at the viewport center */
  panTo: (cx: number, cy: number, vcx: number, vcy: number, ms?: number) => void;
  /** Animate pan AND zoom together to explicit targets */
  animateTo: (panX: number, panY: number, zoom: number, ms?: number) => void;
  /** Frame a canvas-space box (fit-to-view, jump-to-zone, frame-a-cluster) */
  fitTo: (
    box: { minX: number; minY: number; maxX: number; maxY: number },
    viewW: number,
    viewH: number,
    padding?: number,
    ms?: number,
  ) => void;
  /** Current zoom (read-only, updates after gesture ends) */
  zoom: number;
  /** Current pan (read-only, updates after gesture ends) */
  panX: number;
  panY: number;
  /** Per-frame pan for a card drag's edge auto-pan (no React sync per call). */
  dragPanBy: (dx: number, dy: number) => void;
  /** Sync React state once after a dragPanBy sequence ends. */
  endDragPan: () => void;
}

const CanvasViewportContext = createContext<ViewportCtx | null>(null);

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

  const { canvasToScreen, screenToCanvas, panTo, animateTo, fitTo, nudge, zoomBy, dragPanBy, endDragPan, panRef, zoomRef } = useGesture(
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
      // Land on the CONTENT — the root song card + the Ideas column at the
      // canvas's top-left — not on the empty space between ideas and the
      // divider (which read as a blank void on a phone). A small margin keeps
      // the root card off the very edge.
      panRef.current = { x: 20, y: 20 };
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
    animateTo,
    fitTo,
    zoom: reactZoom,
    panX: reactPan.x,
    panY: reactPan.y,
    dragPanBy,
    endDragPan,
  };

  return (
    <CanvasViewportContext.Provider value={ctxValue}>
      <div
        ref={containerRef}
        data-canvas-viewport="true"
        className={`relative overflow-hidden ${className}`}
        style={{
          touchAction: "none",       // prevent browser scroll hijacking gestures
          userSelect: "none",        // prevent text selection during drag
          WebkitUserSelect: "none",
          cursor: "grab",
          ...style,
        }}
        aria-label="Song canvas. Use the Ideas, Final, and Fit buttons above to move between parts of the song. You can also drag to pan and pinch to zoom, or focus the canvas and use arrow keys to pan and + / - to zoom."
        role="application"
        tabIndex={0}
        onKeyDown={(e) => {
          // Keyboard pan/zoom — only when the canvas itself (not a card/button)
          // holds focus, so Tab-cycling through cards keeps its arrow behavior.
          if (e.target !== e.currentTarget) return;
          const STEP = 120;
          switch (e.key) {
            case "ArrowUp": e.preventDefault(); nudge(0, STEP); break;
            case "ArrowDown": e.preventDefault(); nudge(0, -STEP); break;
            case "ArrowLeft": e.preventDefault(); nudge(STEP, 0); break;
            case "ArrowRight": e.preventDefault(); nudge(-STEP, 0); break;
            case "+": case "=": e.preventDefault(); zoomBy(1.15); break;
            case "-": case "_": e.preventDefault(); zoomBy(1 / 1.15); break;
            default: break;
          }
        }}
      >
        {/* Warm song-room glow — fixed behind the transforming layer, always
            centered in the viewport. This is the brand "spiritual warmth"
            signature; it replaces the old dot grid so the canvas reads as a
            private song room, not a Miro/diagram board. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 80% 55% at 50% 40%, rgba(184,149,58,0.12) 0%, rgba(184,149,58,0) 70%)",
          }}
        />

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

/**
 * Hook for child components that need to convert between screen and canvas
 * coordinates (e.g., CanvasCard for pointer-capture drag).
 * Must be used inside a <CanvasViewport> ancestor.
 */
export function useCanvasViewport(): ViewportCtx {
  const ctx = useContext(CanvasViewportContext);
  if (!ctx) throw new Error("useCanvasViewport must be used inside <CanvasViewport>");
  return ctx;
}

export default CanvasViewport;
