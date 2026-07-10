import { memo } from "react";
import { StickyNote, BookOpen } from "lucide-react";
import type { CardFaceProps } from "./cardFace";

/**
 * NoteCard — the face for a freeform note OR a scripture/meaning anchor.
 * Inter body on a subtle ruled-paper texture (raw thought, NOT composed
 * lyric). Scripture cards swap to an open-book icon and a gold ✦ so a verse
 * reads as a spiritual anchor, not a to-do. Presentational only — see cardFace.ts.
 */
const NoteCard = memo(({ card, tone, selected }: CardFaceProps) => {
  const isScripture = card.type === "scripture";
  const Icon = isScripture ? BookOpen : StickyNote;
  // Scripture cards lead with the REFERENCE when the picker stored one
  // (title = "Psalm 46:10"); notes lead with a real section label or stay
  // humbly generic — never a fabricated "Raw idea".
  const headline = isScripture
    ? (card.title && card.title !== "Scripture note" ? card.title : card.section || "Scripture")
    : card.section || "Note";

  return (
    <>
      {/* Serif headline — meaning anchors read as anchors, not UI chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: tone.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} strokeWidth={1.8} style={{ color: tone.base }} />
        </div>
        <span
          style={{
            flex: 1, minWidth: 0,
            fontSize: 15, fontWeight: 700, color: "var(--cog-charcoal)",
            fontFamily: "var(--font-display)", lineHeight: 1.15,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {isScripture && <span aria-hidden="true" style={{ color: tone.base }}>✦ </span>}
          {headline}
        </span>
      </div>

      {/* Body — Inter on ruled paper. Expanded caps at 9 lines (the Edit
          sheet is the full-reading surface). */}
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
            WebkitLineClamp: selected ? 9 : 4, WebkitBoxOrient: "vertical",
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
