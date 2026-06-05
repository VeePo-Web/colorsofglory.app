import { memo, type ReactNode, type PointerEvent } from "react";
import type { CreatorColor } from "@/lib/canvas/creatorColors";

export type CardInteractionState = "default" | "selected" | "dragging" | "dimmed";

interface CardShellProps {
  color: CreatorColor;
  state: CardInteractionState;
  width?: number;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  children: ReactNode;
  "aria-label": string;
  className?: string;
  isNew?: boolean;  // triggers card-enter animation
  style?: React.CSSProperties;
}

/**
 * CardShell — the shared base for every canvas card type.
 *
 * Handles:
 *  - Creator color: left border (3px), box-shadow tint
 *  - All 4 interaction states: default / selected / dragging / dimmed
 *  - card-enter spring animation on isNew=true
 *  - Pointer event guard (stopPropagation prevents canvas pan on card touch)
 */
const CardShell = memo(({
  color,
  state,
  width = 200,
  onPointerDown,
  onClick,
  children,
  'aria-label': ariaLabel,
  className = "",
  isNew = false,
  style,
}: CardShellProps) => {
  const isDimmed = state === "dimmed";
  const isSelected = state === "selected";
  const isDragging = state === "dragging";

  const styles: React.CSSProperties = {
    position: "absolute",
    width,
    borderRadius: 16,
    backgroundColor: isDimmed ? "rgba(255,255,255,0.72)" : "#FFFFFF",
    borderLeft: `3px solid ${isDimmed ? color.dim : color.base}`,
    borderTop: `1px solid ${isDimmed ? color.dim : color.base + "28"}`,
    borderRight: `1px solid ${isDimmed ? color.dim : color.base + "28"}`,
    borderBottom: `1px solid ${isDimmed ? color.dim : color.base + "28"}`,
    borderStyle: isDimmed ? "dashed" : "solid",
    boxShadow: isDimmed
      ? "none"
      : isSelected
      ? `0 12px 40px ${color.glow}, 0 0 0 2px ${color.base}`
      : isDragging
      ? `0 24px 60px ${color.glow}, 0 0 0 2px ${color.base}`
      : `0 4px 20px ${color.glow}`,
    opacity: isDimmed ? 0.42 : 1,
    transform: isSelected
      ? "scale(1.04) translateZ(0)"
      : isDragging
      ? "scale(1.06) rotate(1.5deg) translateZ(0)"
      : "scale(1) translateZ(0)",
    transition: isDragging
      ? "none"
      : "transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms ease, opacity 280ms ease",
    cursor: isDimmed ? "not-allowed" : isDragging ? "grabbing" : isSelected ? "default" : "grab",
    zIndex: isDragging ? 50 : isSelected ? 20 : 10,
    padding: "13px 13px 13px 11px",
    boxSizing: "border-box",
    pointerEvents: isDimmed ? "none" : "auto",
    // card-enter animation class applied via className
    animation: isNew ? "card-enter 320ms cubic-bezier(0.34,1.56,0.64,1) both" : "none",
  };

  return (
    <>
      {/* Inject keyframes once into the document */}
      <style>{CARD_KEYFRAMES}</style>

      <div
        style={{ ...styles, ...style }}
        className={className}
        onPointerDown={(e) => {
          e.stopPropagation(); // prevent canvas pan when touching a card
          onPointerDown?.(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDimmed) onClick?.();
        }}
        role="button"
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        tabIndex={isDimmed ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !isDimmed) {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {children}
      </div>
    </>
  );
});

CardShell.displayName = "CardShell";

export default CardShell;

// ─── Keyframes (injected once) ────────────────────────────────────────────────

const CARD_KEYFRAMES = `
  @keyframes card-enter {
    from { opacity: 0; transform: scale(0.82) translateZ(0); }
    to   { opacity: 1; transform: scale(1.0) translateZ(0); }
  }
  @keyframes card-fly-to-final {
    0%   { transform: scale(1.0) translateZ(0); }
    40%  { transform: scale(1.08) rotate(2deg) translateZ(0); }
    100% { transform: scale(1.0) translateZ(0); }
  }
  @keyframes card-pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.75); }
  }
`;
