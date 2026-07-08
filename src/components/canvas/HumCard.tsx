import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
import CardShell, { type CardInteractionState } from "./CardShell";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";
import { generateWaveform, HUM_BAR_COUNT, HUM_MAX_BAR_HEIGHT, BAR_WIDTH, BAR_GAP } from "@/lib/canvas/waveformSeed";
import { resamplePeaks } from "@/lib/audio/waveformPeaks";

export interface HumCardData {
  id: string;
  x: number;
  y: number;
  title: string;
  duration: string;
  contributor: string;
  /** Real persisted peaks; downsampled to the hum's raw 8 bars. Absent → seed fallback. */
  waveformPeaks?: number[] | null;
  isDimmedReference?: boolean;
}

interface HumCardProps {
  card: HumCardData;
  selected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMoveToFinal?: () => void;
}

/**
 * HumCard — the raw, quick-capture hum card.
 * Fewer, taller bars communicate rawness (not composed audio).
 * Creator color used for the "QUICK HUM" section label (urgent feel).
 * Pulse dot always shown until played.
 */
const HumCard = memo(({ card, selected, isDragging = false, isNew = false, onSelect, onPointerDown, onMoveToFinal }: HumCardProps) => {
  const color = getCreatorColor(card.contributor);
  const initials = getCreatorInitials(card.contributor);
  // Real persisted peaks when present, downsampled to the hum's few raw bars
  // (max-pooling keeps the jagged feel). Seed fallback for legacy rows only.
  const barHeights = useMemo(
    () =>
      card.waveformPeaks?.length
        ? resamplePeaks(card.waveformPeaks, HUM_BAR_COUNT)
        : generateWaveform(card.id, HUM_BAR_COUNT),
    [card.id, card.waveformPeaks],
  );

  const state: CardInteractionState = card.isDimmedReference ? "dimmed" : isDragging ? "dragging" : selected ? "selected" : "default";
  const totalBarsPx = HUM_BAR_COUNT * BAR_WIDTH + (HUM_BAR_COUNT - 1) * (BAR_GAP + 2); // wider gaps for raw feel

  return (
    <CardShell
      color={color}
      state={state}
      width={180}
      isNew={isNew}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`Quick hum: ${card.title} by ${card.contributor}`}
      style={{ left: card.x, top: card.y } as React.CSSProperties}
    >
      {/* Creator dot */}
      <div
        style={{
          position: "absolute", top: 10, right: 10,
          width: 22, height: 22, borderRadius: "50%",
          backgroundColor: color.base,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 700, color: "#FFF",
        }}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Icon + "QUICK HUM" in creator color (urgency signal) */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Mic size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: color.dark, fontFamily: "var(--font-body)" }}>
            Quick Hum
          </span>
          {/* Pulse dot — always visible on hum cards */}
          <div
            style={{
              width: 6, height: 6, borderRadius: "50%",
              backgroundColor: color.base,
              animation: "card-pulse-dot 2s ease-in-out infinite",
            }}
            aria-label="New hum — not yet reviewed"
          />
        </div>
      </div>

      {/* Title + duration */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "var(--font-display)", lineHeight: 1.2, flex: 1, marginRight: 6 }}>
          {card.title}
        </p>
        <span style={{ fontSize: 10, color: "#999", fontFamily: "var(--font-body)", flexShrink: 0 }}>{card.duration}</span>
      </div>

      {/* Waveform — fewer, taller, jagged bars = raw idea */}
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP + 2, height: HUM_MAX_BAR_HEIGHT, overflow: "hidden" }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: BAR_WIDTH + 1,
              height: Math.round(h * HUM_MAX_BAR_HEIGHT),
              borderRadius: 3,
              backgroundColor: color.base,
              opacity: h * 0.65 + 0.25,
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      {/* Action bar */}
      {selected && !card.isDimmedReference && onMoveToFinal && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${color.base}18` }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onMoveToFinal}
            style={{ width: "100%", height: 30, borderRadius: 8, backgroundColor: color.base, color: "#FFF", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
          >
            → Move to Final
          </button>
        </div>
      )}
    </CardShell>
  );
});

HumCard.displayName = "HumCard";
export default HumCard;
