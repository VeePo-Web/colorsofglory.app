import { memo } from "react";
import { Play, Pause } from "lucide-react";

interface CardPlayButtonProps {
  playing: boolean;
  onPlay: () => void;
}

/**
 * CardPlayButton — the one-tap "hear this idea" control fused to a voice/hum
 * card's waveform. A voice memo you can't play is a tease; this makes the
 * waveform do what a songwriter's thumb expects (Apple Voice Memos / BandLab).
 *
 * Gold, always — a play control is a system CTA (locked decision #5); the card
 * wears the cobalt "now sounding" halo separately while it plays. Matches the
 * Listen-pill's play button so playback speaks one visual language everywhere.
 * stopPropagation so auditioning never also selects/drags the card.
 */
const CardPlayButton = memo(({ playing, onPlay }: CardPlayButtonProps) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onPlay(); }}
    aria-label={playing ? "Pause" : "Play this take"}
    aria-pressed={playing}
    style={{
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer",
      backgroundColor: playing ? "var(--cog-gold, #B8953A)" : "rgba(184,149,58,0.12)",
      color: playing ? "#FFF" : "var(--cog-gold, #B8953A)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "background-color 180ms ease, color 180ms ease",
    }}
  >
    {playing
      ? <Pause size={17} strokeWidth={2} fill="currentColor" />
      : <Play size={17} strokeWidth={2} fill="currentColor" style={{ marginLeft: 2 }} />}
  </button>
));

CardPlayButton.displayName = "CardPlayButton";
export default CardPlayButton;
