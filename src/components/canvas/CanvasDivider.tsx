import { memo } from "react";
import { CANVAS_HEIGHT, DIVIDER_X } from "@/lib/canvas/canvasConstants";

interface CanvasDividerProps {
  /** Glow when a card is being dragged toward this line */
  isDropActive?: boolean;
}

/**
 * The center divider line between the Ideas Tree and Final Song zones.
 * Positioned absolutely within the canvas layer.
 * Glows gold when a card is being dragged across it.
 */
const CanvasDivider = ({ isDropActive = false }: CanvasDividerProps) => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      left: DIVIDER_X,
      top: 0,
      width: isDropActive ? 2 : 1,
      height: CANVAS_HEIGHT,
      background: isDropActive
        ? "linear-gradient(to bottom, transparent 0%, rgba(181,147,90,0.70) 8%, rgba(181,147,90,0.70) 92%, transparent 100%)"
        : "linear-gradient(to bottom, transparent 0%, rgba(181,147,90,0.20) 8%, rgba(181,147,90,0.20) 92%, transparent 100%)",
      pointerEvents: "none",
      transition: "width 150ms ease, background 150ms ease",
      boxShadow: isDropActive ? "0 0 12px rgba(181,147,90,0.35)" : "none",
    }}
  />
);

// Static stage layer - re-renders only when its own props change, not on
// every host/stage render (e.g. the mid-drag divider-glow flip).
export default memo(CanvasDivider);
