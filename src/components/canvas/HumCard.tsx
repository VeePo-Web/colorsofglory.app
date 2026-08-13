import { memo, useMemo } from "react";
import {
  resolveWaveformBars,
  HUM_BAR_COUNT,
  HUM_MAX_BAR_HEIGHT,
  BAR_WIDTH,
  BAR_GAP,
} from "@/lib/canvas/waveformSeed";
import CardPlayButton from "./CardPlayButton";
import type { CardFaceProps } from "./cardFace";

/**
 * HumCard — the face for a raw, quick-captured hum. Fewer, taller bars say
 * "unfinished idea, caught in the moment"; with a Melody Lens contour the
 * eight bars ride the hummed tune (real, at a glance), real peaks come next,
 * and the id-seeded fake survives only for legacy rows. Presentational only.
 */
const HumCard = memo(({ card, tone, selected, playing, onPlay }: CardFaceProps) => {
  const wave = useMemo(
    () =>
      resolveWaveformBars({
        seedId: card.id,
        peaks: card.waveformPeaks,
        contour: card.pitchContour,
        barCount: HUM_BAR_COUNT,
        maxHeight: HUM_MAX_BAR_HEIGHT,
      }),
    [card.id, card.waveformPeaks, card.pitchContour],
  );
  return (
    <>
      {/* The hum's NAME leads, amber-warm and unfinished. No icon tile (the
          stripe + bars already say audio) and no fresh-dot — in a live writing
          session most hums are hours old, so the dot was noise, not signal. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.15, flex: 1, minWidth: 0, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        {card.meta && (
          <span style={{ fontSize: 11, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", flexShrink: 0 }}>{card.meta}</span>
        )}
      </div>

      {/* Play control fused to the waveform — one tap to hear the hum. Fewer,
          taller bars = raw idea; a hum's contour makes them ride the tune.
          Always system gold; breathes while sounding. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onPlay && <CardPlayButton playing={Boolean(playing)} onPlay={onPlay} />}
        <div
          style={{ display: "flex", alignItems: "flex-start", gap: BAR_GAP + 2, height: HUM_MAX_BAR_HEIGHT, flex: "0 1 auto", minWidth: 0, overflow: "hidden" }}
          aria-hidden="true"
        >
          {wave.bars.map((bar, i) => (
            <div
              key={i}
              style={{
                width: BAR_WIDTH + 1, height: bar.height, marginTop: bar.top, borderRadius: 3,
                backgroundColor: "var(--cog-gold, #B8953A)",
                opacity: !bar.voiced
                  ? 0.16
                  : playing
                    ? bar.amp * 0.45 + 0.5
                    : bar.amp * 0.65 + 0.25,
                flexShrink: 0,
                transformOrigin: "bottom",
                animation: playing ? `cog-wave-play 1.1s ease-in-out ${(i % 5) * 110}ms infinite` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* The words (or honest "[humming]") the take carries — F12 at a
          glance, same quiet serif treatment as VoiceMemoCard. */}
      {card.body && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 12.5,
            fontFamily: "var(--font-display)",
            color: "var(--cog-warm-gray)",
            lineHeight: 1.55,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: selected ? 6 : 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {card.body}
        </p>
      )}
    </>
  );
});

HumCard.displayName = "HumCard";
export default HumCard;
