import { forwardRef, memo, type ReactNode, type PointerEvent, type KeyboardEvent } from "react";
import type { CreatorColor } from "@/lib/canvas/creatorColors";
import {
  GLORY_PLAYING_SHADOW,
  GLORY_SELECTED_SHADOW,
  PLAYBACK_TONE,
  type GloryTone,
} from "@/lib/canvas/glorySpectrum";
import { CARD_MIN_HEIGHT } from "@/lib/canvas/canvasGeometry";

export type CardInteractionState = "default" | "selected" | "dimmed";

interface CardShellProps {
  color: CreatorColor;
  /** Glory-spectrum tone of the card's TYPE — paints the identity stripe. */
  tone: GloryTone;
  state: CardInteractionState;
  width: number;
  left: number;
  top: number;
  /** Merge selection paints a gold keeper ring regardless of tone. */
  mergeSelected?: boolean;
  /** This card is sounding right now — soft-blue playback halo. */
  playing?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (e: PointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
  "aria-label": string;
}

/**
 * CardShell — the shared frame for every canvas card face.
 *
 * Owns: creator-color left stripe + tint, the three resting interaction states
 * (default / selected / dimmed), the merge keeper ring, the enter animation,
 * position, and the accessible button semantics. It never renders type-specific
 * content (that's the face) and never handles the live drag transform — the
 * orchestrator writes that straight to this element's ref for 60fps (see
 * CanvasCard). Keyframes are injected ONCE by CanvasStage, not per instance.
 */
const CardShell = memo(
  forwardRef<HTMLDivElement, CardShellProps>(function CardShell(
    {
      color,
      tone,
      state,
      width,
      left,
      top,
      mergeSelected = false,
      playing = false,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
      onKeyDown,
      children,
      "aria-label": ariaLabel,
    },
    ref,
  ) {
    const isDimmed = state === "dimmed";
    const isSelected = state === "selected";

    // Rings speak the system's language: gold = selection/merge (you're
    // holding this), soft blue = playback (this is sounding). The card's TYPE
    // tone lives in the stripe; the resting border stays quiet cream so a
    // full board never reads as a rainbow of frames.
    const border = playing
      ? `2px solid ${PLAYBACK_TONE.base}`
      : mergeSelected
      ? "2px solid var(--cog-gold, #B8953A)"
      : isSelected
      ? "2px solid var(--cog-gold, #B8953A)"
      : isDimmed
      ? `1.5px dashed ${tone.dim}`
      : "1.5px solid rgba(28,26,23,0.08)";

    const boxShadow = playing
      ? GLORY_PLAYING_SHADOW
      : mergeSelected
      ? "0 0 0 4px rgba(184,149,58,0.20), 0 10px 28px rgba(28,26,23,0.12)"
      : isDimmed
      ? "none"
      : isSelected
      ? GLORY_SELECTED_SHADOW
      : `0 6px 20px rgba(28,26,23,0.08), 0 1px 3px rgba(28,26,23,0.06)`;

    return (
      <div
        ref={ref}
        style={{
          position: "absolute",
          left,
          top,
          width,
          minHeight: CARD_MIN_HEIGHT,
          borderRadius: 18,
          backgroundColor: isDimmed ? "rgba(255,252,247,0.72)" : "#FFFCF7",
          border,
          boxShadow,
          opacity: isDimmed ? 0.55 : 1,
          // Dimmed cards stay tappable — "nothing is deleted" means nothing is
          // unreachable. They select (to read + restore) but never drag.
          cursor: isDimmed ? "pointer" : isSelected ? "default" : "grab",
          userSelect: "none",
          zIndex: playing ? 22 : isSelected ? 20 : 10,
          transform: isSelected || playing ? "scale(1.03) translateZ(0)" : "scale(1) translateZ(0)",
          transition:
            "transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms ease, border-color 200ms ease, opacity 280ms ease",
          // Plays once on mount (React keeps cards mounted by key), so a newly
          // added card settles in with a calm spring; existing cards animate on
          // first load. No fill → transform reverts to the inline value after,
          // so selection scale still works. Reduced-motion disables it (Step 9).
          animation: "cog-card-enter 360ms cubic-bezier(0.34,1.56,0.64,1)",
          padding: "13px 14px 12px 16px",
          boxSizing: "border-box",
        }}
        onPointerDown={(e) => {
          e.stopPropagation(); // never let a card touch start a canvas pan
          onPointerDown?.(e);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onClick?.();
          }
          onKeyDown?.(e);
        }}
        role="button"
        aria-pressed={isSelected}
        aria-label={ariaLabel}
        tabIndex={0}
        data-canvas-card="true"
      >
        {/* Material identity stripe — the card TYPE's glory tone down the
            left edge (lyric rose, voice gold, hum amber, meaning green…). */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute", left: 6, top: 13, bottom: 13, width: 4, borderRadius: 4,
            background: `linear-gradient(180deg, ${tone.base}, ${tone.base}59)`,
            opacity: isDimmed ? 0.5 : 1,
          }}
        />
        {children}
      </div>
    );
  }),
);

CardShell.displayName = "CardShell";
export default CardShell;
