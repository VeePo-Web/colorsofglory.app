import { memo } from "react";
import { FileText } from "lucide-react";
import { getCreatorInitials, STATUS_COLORS } from "@/lib/canvas/creatorColors";
import type { CardFaceProps } from "./cardFace";

/**
 * LyricCard — the face for a lyric fragment, the songwriter's primary creative
 * card. Section crown label, the words themselves in Playfair Display (a
 * sanctuary, not a note app), word count + status chip. Expands to full body
 * when selected. Presentational only — see cardFace.ts.
 */
const LyricCard = memo(({ card, color, tone, selected }: CardFaceProps) => {
  const initials = getCreatorInitials(card.contributor);
  const statusMeta = STATUS_COLORS[card.status] ?? STATUS_COLORS.raw;
  const wordCount = (card.body || "").split(/\s+/).filter(Boolean).length;

  return (
    <>
      {/* Creator dot — authorship (WHO), top-right */}
      {card.contributor && (
        <div
          style={{
            position: "absolute", top: 11, right: 11,
            width: 22, height: 22, borderRadius: "50%",
            backgroundColor: color.base,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 800, color: "#FFFFFF", letterSpacing: -0.3,
            border: "2px solid #FFFFFF", boxShadow: `0 2px 6px ${color.glow}`,
          }}
          title={card.contributor}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}

      {/* Type icon + section label — the material's rose tone (WHAT) */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={13} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: tone.dark, fontFamily: "var(--font-body)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.section}
        </span>
      </div>

      {/* Lyric body — Playfair Display */}
      {card.body ? (
        <p
          style={{
            fontSize: 13.5, fontFamily: "var(--font-display)", color: "var(--cog-charcoal)",
            lineHeight: 1.65, marginBottom: 10,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: selected ? 999 : 3, WebkitBoxOrient: "vertical",
            transition: "all 240ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {card.body}
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--cog-muted)", fontStyle: "italic", fontFamily: "var(--font-display)", marginBottom: 10 }}>
          {card.title || "Tap to write the words…"}
        </p>
      )}

      {/* Footer: word count + status chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span
          style={{
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em",
            padding: "2px 7px", borderRadius: 9999,
            backgroundColor: statusMeta.bg, color: statusMeta.text, fontFamily: "var(--font-body)",
          }}
        >
          {statusMeta.icon ? `${statusMeta.icon} ` : ""}{card.status}
        </span>
      </div>
    </>
  );
});

LyricCard.displayName = "LyricCard";
export default LyricCard;
