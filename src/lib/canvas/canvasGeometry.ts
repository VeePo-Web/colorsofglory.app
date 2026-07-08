import { DIVIDER_X } from "./canvasConstants";

/**
 * canvasGeometry — the single source of truth for board-space geometry shared
 * between the render surface (CanvasStage), the connector layer, and the host's
 * card-placement logic. D1-owned. Values are the exact numbers the canvas has
 * always used; this module only removes the copies.
 */

/** Idea/final card footprint — CanvasCardEl and the connectors must agree. */
export const CARD_WIDTH = 208;
export const CARD_MIN_HEIGHT = 132;

/**
 * A card only starts moving once the finger travels past this (screen px), so a
 * tap or a small wiggle selects instead of nudging the card.
 */
export const DRAG_THRESHOLD_PX = 7;

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
