import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
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
const HumCard = memo(({ card, tone, playing }: CardFaceProps) => {
  const barHeights = useMemo(() => generateWaveform(card.id, HUM_BAR_COUNT), [card.id]);
  // "Fresh" means fresh: the amber dot marks a hum under 24h old (a board of
  // forever-pulsing dots is notification noise, not warmth). Static, no pulse.
  const isFresh = card.createdAt
    ? Date.now() - Date.parse(card.createdAt) < 24 * 60 * 60 * 1000
    : false;

  return (
    <>
      {/* The hum's NAME leads, amber-warm and unfinished */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Mic size={12} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.15, flex: 1, minWidth: 0, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        {isFresh && (
          <span
            role="img"
            aria-label="New hum"
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: tone.base, flexShrink: 0 }}
          />
        )}
        {card.meta && (
          <span style={{ fontSize: 11, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", flexShrink: 0 }}>{card.meta}</span>
        )}
      </div>

      {/* Waveform — fewer, taller, jagged bars = raw idea. Always system
          gold; breathes while sounding. */}
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: BAR_GAP + 2, height: HUM_MAX_BAR_HEIGHT, overflow: "hidden" }}
        aria-hidden="true"
      >
        {barHeights.map((h, i) => (
          <div
            key={i}
            style={{
              width: BAR_WIDTH + 1, height: Math.round(h * HUM_MAX_BAR_HEIGHT), borderRadius: 3,
              backgroundColor: "var(--cog-gold, #B8953A)",
              opacity: playing ? h * 0.45 + 0.5 : h * 0.65 + 0.25,
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

HumCard.displayName = "HumCard";
export default HumCard;
