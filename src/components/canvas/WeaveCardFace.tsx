import { memo } from "react";
import { FileText } from "lucide-react";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import type { GloryTone } from "@/lib/canvas/glorySpectrum";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import type { WeaveGlowLine } from "@/components/canvas/useWeave";

/**
 * WeaveCardFace — an idea card's face while Weave mode is on (D1).
 *
 * The card's body opens up into individual LINES, each glowing by how well it
 * fits the forming section (strong / warm / faint — computed by D2, painted
 * here). Tap a line to place it; tap a woven line to pull it back. Every glow
 * explains itself (the fit reason rides under strong/warm lines and in every
 * aria-label) — no unexplained magic, and a faint line is still a button:
 * guidance, never a gate.
 */

interface WeaveCardFaceProps {
  card: CanvasBoardCard;
  tone: GloryTone;
  lines: WeaveGlowLine[];
  sectionName: string;
  onLineTap: (index: number) => void;
}

const GOLD = GLORY.gold;

const WeaveCardFace = memo(({ card, tone, lines, sectionName, onLineTap }: WeaveCardFaceProps) => (
  <>
    {/* Crown — same anatomy as the resting face, so the card stays itself. */}
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <FileText size={12} strokeWidth={1.8} style={{ color: tone.base }} />
      </div>
      <span
        style={{
          flex: 1, minWidth: 0,
          fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)",
          fontFamily: "var(--font-display)", lineHeight: 1.15,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {card.section || card.title || "Lyric"}
      </span>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 5 }} role="group" aria-label={`Lines that could fit ${sectionName}`}>
      {lines.map((line) => {
        const { tier, reason } = line.fit;
        const strong = tier === "strong" && !line.used;
        const warm = tier === "warm" && !line.used;
        return (
          <button
            key={`${line.index}:${line.text}`}
            type="button"
            onClick={(e) => { e.stopPropagation(); onLineTap(line.index); }}
            aria-label={
              line.used
                ? `Woven into ${sectionName}: “${line.text}”. Tap to take it back out.`
                : `Weave “${line.text}” into ${sectionName} — ${reason}`
            }
            style={{
              display: "block", width: "100%", textAlign: "left",
              minHeight: 44, padding: "7px 10px", borderRadius: 11, cursor: "pointer",
              // The glow: gold is the system's voice — "this fits the song".
              // Three registers of the same light, never a gate.
              backgroundColor: line.used
                ? "rgba(28,26,23,0.035)"
                : strong
                  ? GOLD.bg
                  : warm
                    ? "rgba(184,149,58,0.07)"
                    : "transparent",
              border: line.used
                ? "1px dashed rgba(28,26,23,0.14)"
                : strong
                  ? `1.5px solid ${GOLD.base}59`
                  : warm
                    ? `1px solid ${GOLD.base}30`
                    : "1px solid rgba(28,26,23,0.08)",
              boxShadow: strong ? `0 0 0 3px ${GOLD.base}1A, 0 2px 10px ${GOLD.glow}` : "none",
              transition: "background-color 200ms ease, border-color 200ms ease, box-shadow 240ms ease",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: 13, fontFamily: "var(--font-display)", lineHeight: 1.45,
                // Used rows are still interactive ("tap to take back") — they
                // must stay readable: warm-gray, never the disabled-muted tone.
                color: line.used ? "var(--cog-warm-gray)" : "var(--cog-charcoal)",
                fontStyle: line.used ? "italic" : "normal",
              }}
            >
              {line.used ? "↳ " : ""}{line.text}
            </span>
            {/* The WHY — only where the light is meaningful (calm, not chatty). */}
            {(strong || warm) && (
              <span
                style={{
                  display: "block", marginTop: 2,
                  fontSize: 10, fontWeight: 600, fontFamily: "var(--font-body)",
                  color: "var(--cog-warm-gray)",
                  letterSpacing: "0.02em",
                }}
              >
                {reason}
              </span>
            )}
            {line.used && (
              <span style={{ display: "block", marginTop: 2, fontSize: 10, fontWeight: 600, fontFamily: "var(--font-body)", color: "var(--cog-warm-gray)" }}>
                woven — tap to take back
              </span>
            )}
          </button>
        );
      })}
    </div>
  </>
));

WeaveCardFace.displayName = "WeaveCardFace";
export default WeaveCardFace;
