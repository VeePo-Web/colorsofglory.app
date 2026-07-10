import { memo } from "react";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import { CANVAS_HEIGHT, DIVIDER_X } from "@/lib/canvas/canvasConstants";
import { COLUMN_TOP } from "@/lib/canvas/canvasGeometry";

/**
 * ZoneFields — two whisper-quiet color fields behind the trees, so "where raw
 * ideas live" and "where the final song lives" is answered by LIGHT before a
 * single label is read. Ideas basks in warm amber (unfinished, alive); Final
 * rests on gold-into-sage (chosen, ready to worship) with a luminous rail
 * down its left edge — the song's spine.
 *
 * Pure canvas-space pixels, painted once, zero per-card cost. When a card is
 * dragged toward Final the landing ILLUMINATES — implemented as stacked
 * bright layers fading in via opacity (CSS gradients don't interpolate, so a
 * background swap would snap instead of glow).
 */
interface ZoneFieldsProps {
  /** A card is being dragged toward the Final tree — illuminate the landing. */
  isDropActive?: boolean;
}

const FIELD_TOP = COLUMN_TOP - 96;
const FIELD_HEIGHT = Math.min(2400, CANVAS_HEIGHT - FIELD_TOP - 120);

const ZoneFields = ({ isDropActive = false }: ZoneFieldsProps) => (
  <>
    {/* Ideas field — warm amber morning light */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 36,
        top: FIELD_TOP,
        width: DIVIDER_X - 72,
        height: FIELD_HEIGHT,
        borderRadius: 44,
        background:
          `radial-gradient(70% 34% at 42% 6%, ${GLORY.amber.base}10 0%, transparent 72%), ` +
          `linear-gradient(180deg, ${GLORY.gold.base}0A 0%, ${GLORY.amber.base}05 42%, transparent 88%)`,
        pointerEvents: "none",
      }}
    />

    {/* Final field — gold into sage, the chosen arrangement's resting light */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: DIVIDER_X + 36,
        top: FIELD_TOP,
        width: DIVIDER_X - 72,
        height: FIELD_HEIGHT,
        borderRadius: 44,
        background:
          `radial-gradient(70% 34% at 50% 6%, ${GLORY.gold.base}12 0%, transparent 72%), ` +
          `linear-gradient(180deg, ${GLORY.gold.base}0C 0%, ${GLORY.sage.base}07 48%, transparent 90%)`,
        pointerEvents: "none",
      }}
    />
    {/* Drop illumination — fades in OVER the resting field */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: DIVIDER_X + 36,
        top: FIELD_TOP,
        width: DIVIDER_X - 72,
        height: FIELD_HEIGHT,
        borderRadius: 44,
        background: `radial-gradient(70% 40% at 50% 10%, ${GLORY.gold.base}1F 0%, transparent 74%)`,
        border: `1.5px solid ${GLORY.gold.base}59`,
        boxShadow: `0 0 60px -12px ${GLORY.gold.base}40`,
        opacity: isDropActive ? 1 : 0,
        transition: "opacity 240ms ease",
        pointerEvents: "none",
      }}
    />

    {/* The arrangement rail — a luminous spine down the Final zone's edge */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: DIVIDER_X + 44,
        top: FIELD_TOP + 34,
        width: 3,
        height: FIELD_HEIGHT - 96,
        borderRadius: 3,
        background: `linear-gradient(180deg, ${GLORY.gold.base}4D 0%, ${GLORY.gold.base}1A 55%, transparent 100%)`,
        pointerEvents: "none",
      }}
    />
    {/* Rail brightening — the light turns up as a keeper approaches */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: DIVIDER_X + 44,
        top: FIELD_TOP + 34,
        width: 3,
        height: FIELD_HEIGHT - 96,
        borderRadius: 3,
        background: `linear-gradient(180deg, ${GLORY.gold.base}A6 0%, ${GLORY.gold.base}40 55%, transparent 100%)`,
        boxShadow: `0 0 22px 2px ${GLORY.gold.base}59`,
        opacity: isDropActive ? 1 : 0,
        transition: "opacity 240ms ease",
        pointerEvents: "none",
      }}
    />
  </>
);

// Static stage layer - re-renders only when its own props change, not on
// every host/stage render (e.g. the mid-drag divider-glow flip).
export default memo(ZoneFields);
