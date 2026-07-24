import { memo } from "react";
import { Sparkles } from "lucide-react";
import { GLORY_CROWN_GRADIENT } from "@/lib/canvas/glorySpectrum";
import { ROOT_HEIGHT, ROOT_LEFT, ROOT_TOP, ROOT_WIDTH } from "@/lib/canvas/canvasGeometry";

interface SongRootCardProps {
  title: string;
}

/**
 * The root song card — the anchor at the top-left of the Ideas zone that every
 * idea branches from. Treated as the special centre of the room: warm gradient
 * surface, a gold glow, a gold gradient crown bar, and the song title in
 * display serif. Its box comes from canvasGeometry so the connectors branch
 * from the exact same rectangle it paints.
 */
const SongRootCard = ({ title }: SongRootCardProps) => (
  <section
    aria-label="Root song card"
    style={{
      position: "absolute",
      left: ROOT_LEFT,
      top: ROOT_TOP,
      width: ROOT_WIDTH,
      minHeight: ROOT_HEIGHT,
      borderRadius: 20,
      background: "linear-gradient(150deg, #FFFFFF 0%, #FFFBF2 100%)",
      border: "1.5px solid rgba(184,149,58,0.34)",
      boxShadow: "0 14px 44px rgba(184,149,58,0.16), 0 2px 8px rgba(28,26,23,0.07)",
      padding: "18px 20px 18px 20px",
      boxSizing: "border-box",
      color: "#1A1A1A",
      overflow: "hidden",
    }}
  >
    {/* The glory crown — the auth-code spectrum as a soft bar along the top
        edge. The root song wears the whole spectrum; every card below carries
        one tone of it. */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 4,
        background: GLORY_CROWN_GRADIENT,
        opacity: 0.9,
      }}
    />
    {/* A whisper of the crown's light bleeding into the card surface */}
    <div
      aria-hidden="true"
      style={{
        position: "absolute", top: 4, left: 0, right: 0, height: 26,
        background: GLORY_CROWN_GRADIENT,
        opacity: 0.07,
        filter: "blur(10px)",
        pointerEvents: "none",
      }}
    />
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span
        aria-hidden="true"
        style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(140deg, rgba(212,174,92,0.22), rgba(184,149,58,0.12))",
          border: "1px solid rgba(184,149,58,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Sparkles size={15} strokeWidth={1.9} style={{ color: "#B5935A" }} />
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#B5935A",
        }}
      >
        Root song
      </p>
    </div>
    <p
      style={{
        margin: "0 0 5px",
        fontFamily: "var(--font-display)",
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.1,
        color: "#1A1A1A",
      }}
    >
      {title}
    </p>
    <p
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: 13,
        lineHeight: 1.45,
        color: "#6B6459",
      }}
    >
      Start the song here — add your first idea.
    </p>
  </section>
);

// Static stage layer - re-renders only when its own props change, not on
// every host/stage render (e.g. the mid-drag divider-glow flip).
export default memo(SongRootCard);
