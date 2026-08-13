import { memo, useMemo } from "react";
import { Mic } from "lucide-react";
import {
  resolveWaveformBars,
  MAX_BAR_HEIGHT,
  BAR_WIDTH,
  BAR_GAP,
  VOICE_BAR_COUNT,
} from "@/lib/canvas/waveformSeed";
import CardPlayButton from "./CardPlayButton";
import type { CardFaceProps } from "./cardFace";

/**
 * VoiceMemoCard — the face for a recorded voice memo. The 20-bar waveform is
 * REAL (Melody Lens): with a pitch contour the bars ride the tune up and down
 * (you see loudness AND shape — "the one that soars at the end"); with peaks
 * only it's the true amplitude; the id-seeded fake survives ONLY for legacy
 * rows so a card is never blank. Duration + section as quiet metadata.
 * Playback lives in the stack sheet / Listen Path (D2). Presentational only.
 */
const VoiceMemoCard = memo(({ card, tone, selected, playing, onPlay }: CardFaceProps) => {
  const wave = useMemo(
    () =>
      resolveWaveformBars({
        seedId: card.id,
        peaks: card.waveformPeaks,
        contour: card.pitchContour,
        barCount: VOICE_BAR_COUNT,
        maxHeight: MAX_BAR_HEIGHT,
      }),
    [card.id, card.waveformPeaks, card.pitchContour],
  );
  const totalBarsPx = VOICE_BAR_COUNT * BAR_WIDTH + (VOICE_BAR_COUNT - 1) * BAR_GAP;

  return (
    <>
      {/* The take's NAME is the headline — one crisp serif line at a legible
          size (Playfair muddies below ~15px), duration quietly right-aligned.
          No icon tile: the tone stripe already says "audio", and the waveform
          says it louder — the title is the face's one bold. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.15, flex: 1, minWidth: 0, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.title}
        </p>
        {card.meta && (
          <span style={{ fontSize: 11, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", flexShrink: 0 }}>
            {card.meta}
          </span>
        )}
      </div>

      {/* Play control fused to the waveform (SoundCloud/BandLab) — one tap to
          hear the take, right on the card. Waveform flexes to fill what's left;
          melody bars ride the tune via marginTop; while sounding, the bars
          breathe (GPU scaleY, staggered; keyframe lives in CanvasStage). */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        {onPlay && <CardPlayButton playing={Boolean(playing)} onPlay={onPlay} />}
        <div
          style={{ display: "flex", alignItems: "flex-start", gap: BAR_GAP, height: MAX_BAR_HEIGHT, flex: 1, minWidth: 0, maxWidth: totalBarsPx, overflow: "hidden" }}
          aria-hidden="true"
        >
          {wave.bars.map((bar, i) => (
          <div
            key={i}
            style={{
              width: BAR_WIDTH, height: bar.height, marginTop: bar.top, borderRadius: 3,
              backgroundColor: "var(--cog-gold, #B8953A)",
              opacity: !bar.voiced
                ? 0.14
                : playing
                  ? bar.amp * 0.4 + 0.45
                  : bar.amp * 0.5 + 0.18,
              flexShrink: 0,
              transformOrigin: "bottom",
              animation: playing ? `cog-wave-play 1.1s ease-in-out ${(i % 5) * 110}ms infinite` : "none",
            }}
          />
          ))}
        </div>
      </div>

      {/* THE WORDS THE TAKE CARRIES (F12): the transcript, quiet serif under
          the waveform — a voice card answers "what's on it" without playing.
          Two lines at rest, room to read when selected. */}
      {card.body && (
        <p
          style={{
            margin: "2px 0 0",
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

VoiceMemoCard.displayName = "VoiceMemoCard";
export default VoiceMemoCard;
