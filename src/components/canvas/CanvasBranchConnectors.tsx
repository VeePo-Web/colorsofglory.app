import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/canvas/canvasConstants";

/**
 * CanvasBranchConnectors — soft curved SVG lines that connect the root song
 * card to every idea/final card. This is the visual backbone of the
 * "songwriting tree" metaphor. Lines pick up each creator's accent color.
 *
 * Positioned at (0,0) inside CanvasViewport's infinite canvas layer, behind
 * all cards (z-index 0). Never interactive (pointerEvents: none).
 */

interface BranchCard {
  id: string;
  x: number;
  y: number;
  accent: string;
  isDimmedReference?: boolean;
}

interface CanvasBranchConnectorsProps {
  ideasCards: BranchCard[];
  finalCards: BranchCard[];
}

// Root card geometry — must mirror SongRootCard.tsx
const ROOT_L = 80;
const ROOT_T = 48;
const ROOT_W = 420;
const ROOT_H = 132;

// Idea card geometry — must mirror CanvasCardEl
const CARD_W = 208;
const CARD_H = 132;

// Root anchor points
const ROOT_BOTTOM_CX = ROOT_L + ROOT_W / 2; // 290
const ROOT_BOTTOM_CY = ROOT_T + ROOT_H;     // 180  → sends lines downward to ideas
const ROOT_RIGHT_CX  = ROOT_L + ROOT_W;     // 500  → sends lines rightward to final
const ROOT_RIGHT_CY  = ROOT_T + ROOT_H / 2; // 114

// How far the bezier control points bow outward before curving to the target
const VERT_SLACK  = 56; // ideas tree: vertical bezier slack
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const HORIZ_SLACK = 0;  // final tree: horizontal midpoint cubic (no extra slack needed)

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
      {/* ── Ideas connectors: root bottom-center → card top-center ────── */}
      {ideasCards.map((card) => {
        const ex = card.x + CARD_W / 2;
        const ey = card.y;
        // Cubic bezier: depart downward from root, arrive from above at card
        const path = `M ${ROOT_BOTTOM_CX} ${ROOT_BOTTOM_CY} C ${ROOT_BOTTOM_CX} ${ROOT_BOTTOM_CY + VERT_SLACK} ${ex} ${ey - VERT_SLACK} ${ex} ${ey}`;
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

      {/* ── Final connectors: root right-center → card left-center ────── */}
      {finalCards.map((card) => {
        const ex = card.x;
        const ey = card.y + CARD_H / 2;
        // S-curve cubic: depart horizontally from root, arrive horizontally at card
        const midX = (ROOT_RIGHT_CX + ex) / 2;
        const path = `M ${ROOT_RIGHT_CX} ${ROOT_RIGHT_CY} C ${midX} ${ROOT_RIGHT_CY} ${midX} ${ey} ${ex} ${ey}`;
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

      {/* ── Anchor dots on root card ─────────────────────────────────── */}
      {hasIdeas && (
        <circle
          cx={ROOT_BOTTOM_CX}
          cy={ROOT_BOTTOM_CY}
          r={4.5}
          fill="rgba(181,147,90,0.42)"
        />
      )}
      {hasFinal && (
        <circle
          cx={ROOT_RIGHT_CX}
          cy={ROOT_RIGHT_CY}
          r={4.5}
          fill="rgba(181,147,90,0.42)"
        />
      )}
    </svg>
  );
};

export default CanvasBranchConnectors;
