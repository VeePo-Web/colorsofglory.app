import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import {
  generateWaveform,
  HUM_BAR_COUNT,
  HUM_MAX_BAR_HEIGHT,
  BAR_WIDTH,
  BAR_GAP,
} from "@/lib/canvas/waveformSeed";
import type { CardFaceProps } from "./cardFace";

/**
 * HumCard — the face for a raw, quick-captured hum. Fewer, taller, jagged bars
 * say "unfinished idea, caught in the moment" (not composed audio). The "QUICK
 * HUM" label carries the creator's color and a gentle pulse dot to read as
 * fresh + unreviewed. Presentational only — see cardFace.ts.
 */
const HumCard = memo(({ card, color }: CardFaceProps) => {
  const initials = getCreatorInitials(card.contributor);
  const barHeights = useMemo(() => generateWaveform(card.id, HUM_BAR_COUNT), [card.id]);
  const duration = card.meta || "Hum";

  return (
    <>
      {/* Creator dot */}
      <div
        style={{
          position: "absolute", top: 11, right: 11,
          width: 22, height: 22, borderRadius: "50%",
          backgroundColor: color.base,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 800, color: "#FFF",
          border: "2px solid #FFFFFF", boxShadow: `0 2px 6px ${color.glow}`,
        }}
        title={card.contributor}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Icon + "QUICK HUM" in creator color + pulse */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Mic size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: color.dark, fontFamily: "var(--font-body)" }}>
            Quick Hum
          </span>
          <div
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color.base, animation: "cog-card-pulse-dot 2s ease-in-out infinite" }}
            aria-label="New hum"
          />
        </div>
      </div>

      {/* Title + duration */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.2, flex: 1, marginRight: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        <span style={{ fontSize: 10, color: "var(--cog-muted)", fontFamily: "var(--font-body)", flexShrink: 0 }}>{duration}</span>
      </div>

      {/* Waveform — fewer, taller, jagged bars = raw idea */}
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP + 2, height: HUM_MAX_BAR_HEIGHT, overflow: "hidden" }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{ width: BAR_WIDTH + 1, height: Math.round(h * HUM_MAX_BAR_HEIGHT), borderRadius: 3, backgroundColor: color.base, opacity: h * 0.65 + 0.25, flexShrink: 0 }}
          />
        ))}
      </div>
    </>
  );
});

HumCard.displayName = "HumCard";
export default HumCard;
