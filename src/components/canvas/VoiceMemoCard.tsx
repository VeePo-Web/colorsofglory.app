import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import {
  generateWaveform,
  MAX_BAR_HEIGHT,
  BAR_WIDTH,
  BAR_GAP,
  VOICE_BAR_COUNT,
} from "@/lib/canvas/waveformSeed";
import type { CardFaceProps } from "./cardFace";

/**
 * VoiceMemoCard — the face for a recorded voice memo. A composed 20-bar
 * waveform (deterministic from the card id, so it never reflows) reads as
 * audio at a glance; height-based opacity gives it depth in the creator's
 * color. Duration + section as quiet metadata. Playback lives in the stack
 * sheet / Listen Path (D2), so the canvas face stays calm. Presentational only.
 */
const VoiceMemoCard = memo(({ card, color }: CardFaceProps) => {
  const initials = getCreatorInitials(card.contributor);
  const barHeights = useMemo(() => generateWaveform(card.id, VOICE_BAR_COUNT), [card.id]);
  const totalBarsPx = VOICE_BAR_COUNT * BAR_WIDTH + (VOICE_BAR_COUNT - 1) * BAR_GAP;
  const duration = card.meta || "Voice memo";

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

      {/* Icon + section */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Mic size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          {card.section}
        </span>
      </div>

      {/* Title + duration */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.2, flex: 1, marginRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        <span style={{ fontSize: 10, color: "var(--cog-muted)", fontFamily: "var(--font-body)", flexShrink: 0 }}>
          {duration}
        </span>
      </div>

      {/* Waveform */}
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP, height: MAX_BAR_HEIGHT, width: totalBarsPx, marginBottom: 6, overflow: "hidden" }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: BAR_WIDTH, height: Math.round(h * MAX_BAR_HEIGHT), borderRadius: 3,
              // Waveforms are ALWAYS system gold (locked design token) — the
              // creator's identity lives in the stripe, dot, and name.
              backgroundColor: "var(--cog-gold, #B8953A)", opacity: h * 0.5 + 0.18, flexShrink: 0,
            }}
          />
        ))}
      </div>
    </>
  );
});

VoiceMemoCard.displayName = "VoiceMemoCard";
export default VoiceMemoCard;
