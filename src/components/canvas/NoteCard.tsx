import { memo } from "react";
import { StickyNote } from "lucide-react";
import CardShell, { type CardInteractionState } from "./CardShell";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";

export interface NoteCardData {
  id: string;
  x: number;
  y: number;
  body: string;
  section: string;
  contributor: string;
  age?: string;
  isDimmedReference?: boolean;
}

interface NoteCardProps {
  card: NoteCardData;
  selected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMoveToFinal?: () => void;
}

/**
 * NoteCard — freeform thought, prayer, or production note.
 * Inter 400 body (NOT Playfair — this is raw, not composed).
 * Subtle ruled-line paper texture via repeating-linear-gradient.
 */
const NoteCard = memo(({ card, selected, isDragging = false, isNew = false, onSelect, onPointerDown, onMoveToFinal }: NoteCardProps) => {
  const color = getCreatorColor(card.contributor);
  const initials = getCreatorInitials(card.contributor);
  const state: CardInteractionState = card.isDimmedReference ? "dimmed" : isDragging ? "dragging" : selected ? "selected" : "default";

  return (
    <CardShell
      color={color}
      state={state}
      width={190}
      isNew={isNew}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`Note by ${card.contributor}: ${card.body.slice(0, 60)}`}
      style={{ left: card.x, top: card.y } as React.CSSProperties}
    >
      {/* Creator dot */}
      <div
        style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", backgroundColor: color.base, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#FFF" }}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Icon + section */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <StickyNote size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontFamily: "var(--font-body)" }}>
          {card.section}
        </span>
      </div>

      {/* Paper-line texture container */}
      <div
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 19px, rgba(181,147,90,0.06) 19px, rgba(181,147,90,0.06) 20px)",
          backgroundPosition: "0 0",
          padding: "2px 0 2px",
          marginBottom: 8,
          minHeight: 60,
        }}
      >
        {/* Note body — Inter 400, NOT Playfair */}
        <p
          style={{
            fontSize: 12.5,
            fontFamily: "var(--font-body)",
            color: "#1A1A1A",
            lineHeight: "20px",   // matches the 20px grid line spacing
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: selected ? 999 : 4,
            WebkitBoxOrient: "vertical",
            margin: 0,
          }}
        >
          {card.body}
        </p>
      </div>

      {/* Footer */}
      <span style={{ fontSize: 9, color: "#CCC", fontFamily: "var(--font-body)" }}>
        {card.age ?? "Just now"}
      </span>

      {card.isDimmedReference && (
        <p style={{ fontSize: 10, color: color.base, marginTop: 6, fontWeight: 600, opacity: 0.8 }}>↳ Used in Final</p>
      )}

      {/* Action bar */}
      {selected && !card.isDimmedReference && onMoveToFinal && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${color.base}18` }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onMoveToFinal}
            style={{ width: "100%", height: 30, borderRadius: 8, backgroundColor: color.base, color: "#FFF", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}
          >
            → Move to Final
          </button>
        </div>
      )}
    </CardShell>
  );
});

NoteCard.displayName = "NoteCard";
export default NoteCard;
