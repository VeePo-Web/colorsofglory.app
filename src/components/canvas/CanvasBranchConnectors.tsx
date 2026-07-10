import { memo } from "react";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/canvas/canvasConstants";
import {
  CONNECTOR_VERT_SLACK,
  ROOT_FINAL_ANCHOR,
  ROOT_IDEAS_ANCHOR,
  finalArrival,
  ideaArrival,
} from "@/lib/canvas/canvasGeometry";
import type { CanvasBoardCardType } from "@/lib/canvas/canvasTypes";

/**
 * CanvasBranchConnectors — soft curved SVG lines that connect the root song
 * card to every idea/final card. This is the visual backbone of the
 * "songwriting tree" metaphor. Lines pick up each creator's accent color.
 *
 * Every departure/arrival point comes from canvasGeometry (the SAME source the
 * root card and cards paint from), so a card and its connector always meet —
 * nudge one geometry value and both move in lockstep.
 *
 * Positioned at (0,0) inside CanvasViewport's infinite canvas layer, behind
 * all cards (z-index 0). Never interactive (pointerEvents: none).
 */

interface BranchCard {
  id: string;
  x: number;
  y: number;
  accent: string;
  type: CanvasBoardCardType;
  isDimmedReference?: boolean;
}

interface CanvasBranchConnectorsProps {
  ideasCards: BranchCard[];
  finalCards: BranchCard[];
}

const CanvasBranchConnectors = ({ ideasCards, finalCards }: CanvasBranchConnectorsProps) => {
  const hasIdeas = ideasCards.length > 0;
  const hasFinal = finalCards.length > 0;

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 0,
      }}
    >
      {/* â”€â”€ Ideas connectors: root bottom-center → card top-center â”€â”€â”€â”€â”€â”€ */}
      {ideasCards.map((card) => {
        const { x: ex, y: ey } = ideaArrival(card.x, card.y, card.type);
        // Cubic bezier: depart downward from root, arrive from above at card
        const path = `M ${ROOT_IDEAS_ANCHOR.x} ${ROOT_IDEAS_ANCHOR.y} C ${ROOT_IDEAS_ANCHOR.x} ${ROOT_IDEAS_ANCHOR.y + CONNECTOR_VERT_SLACK} ${ex} ${ey - CONNECTOR_VERT_SLACK} ${ex} ${ey}`;
        const opacity = card.isDimmedReference ? 0.10 : 0.32;
        return (
          <g key={`ci-${card.id}`}>
            {/* Soft glow underlay for depth */}
            <path d={path} stroke={card.accent} strokeWidth={5} strokeLinecap="round" fill="none" opacity={opacity * 0.32} />
            <path d={path} stroke={card.accent} strokeWidth={2} strokeLinecap="round" fill="none" opacity={opacity} />
            {/* Arrival dot at card top-center */}
            <circle cx={ex} cy={ey} r={4} fill={card.accent} opacity={Math.min(opacity + 0.16, 0.55)} />
          </g>
        );
      })}

      {/* â”€â”€ Final connectors: root right-center → card left-center â”€â”€â”€â”€â”€â”€ */}
      {finalCards.map((card) => {
        const { x: ex, y: ey } = finalArrival(card.x, card.y);
        // S-curve cubic: depart horizontally from root, arrive horizontally at card
        const midX = (ROOT_FINAL_ANCHOR.x + ex) / 2;
        const path = `M ${ROOT_FINAL_ANCHOR.x} ${ROOT_FINAL_ANCHOR.y} C ${midX} ${ROOT_FINAL_ANCHOR.y} ${midX} ${ey} ${ex} ${ey}`;
        const opacity = card.isDimmedReference ? 0.10 : 0.32;
        return (
          <g key={`cf-${card.id}`}>
            <path d={path} stroke={card.accent} strokeWidth={5} strokeLinecap="round" fill="none" opacity={opacity * 0.32} />
            <path d={path} stroke={card.accent} strokeWidth={2} strokeLinecap="round" fill="none" opacity={opacity} />
            {/* Arrival dot at card left-center */}
            <circle cx={ex} cy={ey} r={4} fill={card.accent} opacity={Math.min(opacity + 0.16, 0.55)} />
          </g>
        );
      })}

      {/* â”€â”€ Anchor dots on root card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {hasIdeas && (
        <circle cx={ROOT_IDEAS_ANCHOR.x} cy={ROOT_IDEAS_ANCHOR.y} r={4.5} fill="rgba(181,147,90,0.42)" />
      )}
      {hasFinal && (
        <circle cx={ROOT_FINAL_ANCHOR.x} cy={ROOT_FINAL_ANCHOR.y} r={4.5} fill="rgba(181,147,90,0.42)" />
      )}
    </svg>
  );
};

// Static stage layer - re-renders only when its own props change, not on
// every host/stage render (e.g. the mid-drag divider-glow flip).
export default memo(CanvasBranchConnectors);
