import { memo } from "react";
import { StickyNote, BookOpen } from "lucide-react";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import type { CardFaceProps } from "./cardFace";

/**
 * NoteCard — the face for a freeform note OR a scripture/meaning anchor.
 * Inter body on a subtle ruled-paper texture (raw thought, NOT composed
 * lyric). Scripture cards swap to an open-book icon and a gold ✦ so a verse
 * reads as a spiritual anchor, not a to-do. Presentational only — see cardFace.ts.
 */
const NoteCard = memo(({ card, color, tone, selected }: CardFaceProps) => {
  const initials = getCreatorInitials(card.contributor);
  const isScripture = card.type === "scripture";
  const Icon = isScripture ? BookOpen : StickyNote;
  const label = isScripture ? (card.section || "Scripture") : (card.section || "Note");

  return (
    <>
      {/* Creator dot (WHO) */}
      {card.contributor && (
        <div
          style={{
            position: "absolute", top: 11, right: 11,
            width: 22, height: 22, borderRadius: "50%", backgroundColor: color.base,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 800, color: "#FFF",
            border: "2px solid #FFFFFF", boxShadow: `0 2px 6px ${color.glow}`,
          }}
          title={card.contributor}
          aria-hidden="true"
        >
          {initials}
        </div>
      )}

      {/* Type icon + section — sage for meaning anchors, parchment for notes (WHAT) */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: tone.dark, fontFamily: "var(--font-body)" }}>
          {isScripture ? "✦ " : ""}{label}
        </span>
      </div>

      {/* Body — Inter on ruled paper */}
      <div
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 19px, rgba(181,147,90,0.06) 19px, rgba(181,147,90,0.06) 20px)",
          padding: "2px 0",
          minHeight: 48,
        }}
      >
        <p
          style={{
            fontSize: 12.5, fontFamily: "var(--font-body)", color: "var(--cog-charcoal)",
            lineHeight: "20px", margin: 0,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: selected ? 999 : 4, WebkitBoxOrient: "vertical",
            fontStyle: card.body ? "normal" : "italic",
          }}
        >
          {card.body || (isScripture ? "Add a verse or the meaning behind this song…" : "Tap to write the note…")}
        </p>
      </div>
    </>
  );
});

NoteCard.displayName = "NoteCard";
export default NoteCard;
