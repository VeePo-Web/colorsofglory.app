import { memo } from "react";
import { FileText } from "lucide-react";
import { STATUS_COLORS } from "@/lib/canvas/creatorColors";
import type { CardFaceProps } from "./cardFace";

/**
 * LyricCard — the face for a lyric fragment, the songwriter's primary creative
 * card. Section crown label, the words themselves in Playfair Display (a
 * sanctuary, not a note app), word count + status chip. Expands to full body
 * when selected. Presentational only — see cardFace.ts.
 */
const LyricCard = memo(({ card, tone, selected }: CardFaceProps) => {
  const statusMeta = STATUS_COLORS[card.status] ?? STATUS_COLORS.raw;

  return (
    <>
      {/* THE CROWN: the section name in serif — "Chorus" must read at arm's
          length, because which part of the song this is IS the card's
          identity. The tiny rose icon keeps the material language; an EARNED
          status (never "raw") rides quietly on the right. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={12} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 16, fontWeight: 700, color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)", lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {card.section || card.title || "Lyric"}
        </span>
        {card.status !== "raw" && (
          <span
            style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em",
              padding: "2px 7px", borderRadius: 9999, flexShrink: 0,
              backgroundColor: statusMeta.bg, color: statusMeta.text, fontFamily: "var(--font-body)",
            }}
          >
            {statusMeta.icon ? `${statusMeta.icon} ` : ""}{card.status}
          </span>
        )}
      </div>

      {/* Lyric body — Playfair Display, the words get the stage. Expanded
          reading caps at 8 lines (999 grew a long lyric into a 1000px tower
          over its neighbours; the Edit sheet is the full-reading surface). */}
      {card.body ? (
        <p
          style={{
            fontSize: 13.5, fontFamily: "var(--font-display)", color: "var(--cog-charcoal)",
            lineHeight: 1.65, marginBottom: 4,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: selected ? 8 : 3, WebkitBoxOrient: "vertical",
          }}
        >
          {card.body}
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--cog-muted)", fontStyle: "italic", fontFamily: "var(--font-display)", marginBottom: 4 }}>
          Tap to write the words…
        </p>
      )}
    </>
  );
});

LyricCard.displayName = "LyricCard";
export default LyricCard;
