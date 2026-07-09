import { CANVAS_WIDTH, DIVIDER_X } from "./canvasConstants";
import type { CanvasBoardCardType } from "./canvasTypes";

/**
 * canvasGeometry — THE single source of truth for board-space geometry.
 *
 * Every pixel dimension and anchor point the render surface shares lives here:
 * card footprints per type, the root song card's box, and the exact points the
 * bezier connectors depart from and arrive at. CardShell/CanvasCard,
 * SongRootCard, and CanvasBranchConnectors ALL import from this file — nothing
 * mirrors a dimension by comment. Nudge one value → card + connector move in
 * lockstep (see docs/CANVAS-RENDER-CONTRACT.md §4).
 *
 * D1-owned. Canvas size (2400×3200, divider 1200, zoom 0.4–2.5) stays in
 * canvasConstants.ts.
 */

// ─── Card footprints ───────────────────────────────────────────────────────

/** Default card box — lyric / voice / chord / section. */
export const CARD_WIDTH = 208;
export const CARD_MIN_HEIGHT = 132;

/** Per-type widths: a hum is smaller (raw fragment), a note is a slip of paper. */
const CARD_WIDTHS: Record<CanvasBoardCardType, number> = {
  lyric: CARD_WIDTH,
  voice: CARD_WIDTH,
  chord: CARD_WIDTH,
  section: CARD_WIDTH,
  scripture: 192,
  note: 192,
  hum: 184,
};

/** The rendered width of a card of this type (connectors + placement agree). */
export const cardWidth = (type: CanvasBoardCardType): number => CARD_WIDTHS[type] ?? CARD_WIDTH;

// ─── Drag ────────────────────────────────────────────────────────────────

/**
 * A card only starts moving once the finger travels past this (screen px), so a
 * tap or a small wiggle selects instead of nudging the card.
 */
export const DRAG_THRESHOLD_PX = 7;

// ─── Idea/Final column placement ──────────────────────────────────────────

/**
 * New cards flow into a single tidy vertical column per zone, under the labels,
 * so the board reads like a scrollable feed of ideas instead of a 2D scatter.
 */
export const COLUMN_TOP = 272;
export const COLUMN_GAP = 156;
export const IDEAS_COLUMN_X = 80;
export const FINAL_COLUMN_X = DIVIDER_X + 80;

export const ideaColumnSlot = (index: number) => ({
  x: IDEAS_COLUMN_X,
  y: COLUMN_TOP + index * COLUMN_GAP,
});

export const finalColumnSlot = (index: number) => ({
  x: FINAL_COLUMN_X,
  y: COLUMN_TOP + index * COLUMN_GAP,
});

// ─── Root song card box ────────────────────────────────────────────────────

/** The root song card's box — SongRootCard renders it, connectors branch from it. */
export const ROOT_LEFT = 80;
export const ROOT_TOP = 48;
export const ROOT_WIDTH = 420;
export const ROOT_HEIGHT = 132;

// ─── Connector anchor points ───────────────────────────────────────────────

/** Ideas tree departs the root's bottom-center and flows down to each card top-center. */
export const ROOT_IDEAS_ANCHOR = {
  x: ROOT_LEFT + ROOT_WIDTH / 2,
  y: ROOT_TOP + ROOT_HEIGHT,
};

/** Final tree departs the root's right-center and flows across to each card left-center. */
export const ROOT_FINAL_ANCHOR = {
  x: ROOT_LEFT + ROOT_WIDTH,
  y: ROOT_TOP + ROOT_HEIGHT / 2,
};

/** How far a bezier bows before curving to its target (ideas tree). */
export const CONNECTOR_VERT_SLACK = 56;

/** An idea card's connector arrival point (top-center of the card). */
export const ideaArrival = (x: number, y: number, type: CanvasBoardCardType) => ({
  x: x + cardWidth(type) / 2,
  y,
});

/** A final card's connector arrival point (left-center of the card). */
export const finalArrival = (x: number, y: number) => ({
  x,
  y: y + CARD_MIN_HEIGHT / 2,
});

// A guard so a future canvas-width change can't silently desync the columns.
export const _FINAL_COLUMN_IN_FINAL_ZONE = FINAL_COLUMN_X >= CANVAS_WIDTH / 2;
