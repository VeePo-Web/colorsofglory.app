import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
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
const VoiceMemoCard = memo(({ card, tone, playing }: CardFaceProps) => {
  const barHeights = useMemo(() => generateWaveform(card.id, VOICE_BAR_COUNT), [card.id]);
  const totalBarsPx = VOICE_BAR_COUNT * BAR_WIDTH + (VOICE_BAR_COUNT - 1) * BAR_GAP;

  return (
    <>
      {/* The take's NAME is the headline — one crisp serif line at a legible
          size (Playfair muddies below ~15px), duration quietly right-aligned. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Mic size={12} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.15, flex: 1, minWidth: 0, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        {card.meta && (
          <span style={{ fontSize: 11, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", flexShrink: 0 }}>
            {card.meta}
          </span>
        )}
      </div>

      {/* Waveform — always system gold; while sounding, the bars breathe
          (GPU scaleY, staggered per bar; keyframe lives in CanvasStage). */}
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP, height: MAX_BAR_HEIGHT, width: totalBarsPx, marginBottom: 6, overflow: "hidden" }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: BAR_WIDTH, height: Math.round(h * MAX_BAR_HEIGHT), borderRadius: 3,
              backgroundColor: "var(--cog-gold, #B8953A)",
              opacity: playing ? h * 0.4 + 0.45 : h * 0.5 + 0.18,
              flexShrink: 0,
              transformOrigin: "bottom",
              animation: playing ? `cog-wave-play 1.1s ease-in-out ${(i % 5) * 110}ms infinite` : "none",
            }}
          />
        ))}
      </div>
    </>
  );
});

VoiceMemoCard.displayName = "VoiceMemoCard";
export default VoiceMemoCard;
