import { KeyRound, Music3, Timer } from "lucide-react";
import type { MusicCues } from "@/lib/capture/musicCues";

interface HeardCuesStripProps {
  cues: MusicCues;
  className?: string;
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 30,
  padding: "0 12px",
  borderRadius: 9999,
  background: "rgba(184,149,58,0.12)",
  border: "1px solid rgba(184,149,58,0.30)",
  color: "var(--cog-charcoal)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

/**
 * HeardCuesStrip — the quiet "I caught that" confirmation. When the songwriter
 * speaks the key / tempo / chords inside a take, this shows what was heard so
 * the idea arrives song-ready without typing. Read-only and calm — it never
 * nags or blocks; it just reassures.
 */
const HeardCuesStrip = ({ cues, className }: HeardCuesStripProps) => {
  const hasAny = cues.key != null || cues.tempo != null || cues.chords.length > 0;
  if (!hasAny) return null;

  return (
    <div
      className={className}
      aria-live="polite"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, maxWidth: 360 }}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--cog-warm-gray)",
        }}
      >
        Heard
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {cues.key && (
          <span style={chipStyle}>
            <KeyRound size={13} style={{ color: "var(--cog-gold)" }} />
            {cues.key.key}
          </span>
        )}
        {cues.tempo && (
          <span style={chipStyle}>
            <Timer size={13} style={{ color: "var(--cog-gold)" }} />
            {cues.tempo.bpm} BPM
          </span>
        )}
        {cues.chords.length > 0 && (
          <span style={chipStyle}>
            <Music3 size={13} style={{ color: "var(--cog-gold)" }} />
            {cues.chords.map((c) => c.chord).join("  ")}
          </span>
        )}
      </div>
    </div>
  );
};

export default HeardCuesStrip;
