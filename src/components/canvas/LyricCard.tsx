import { memo } from "react";
import { FileText } from "lucide-react";
import CardShell, { type CardInteractionState } from "./CardShell";
import { getCreatorColor, getCreatorInitials, STATUS_COLORS } from "@/lib/canvas/creatorColors";

export interface LyricCardData {
  id: string;
  x: number;
  y: number;
  title: string;
  body: string;
  section: string;
  contributor: string;
  status: "raw" | "shortlisted" | "approved" | "review" | "meaning";
  isDimmedReference?: boolean;
  wordCount?: number;
}

interface LyricCardProps {
  card: LyricCardData;
  selected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMoveToFinal?: () => void;
  onMoveToIdeas?: () => void;
}

/**
 * LyricCard — the songwriter's primary creative card.
 * Playfair Display body, section crown label, 5 status chips.
 * Expands in-place when selected to show action bar.
 */
const LyricCard = memo(({
  card,
  selected,
  isDragging = false,
  isNew = false,
  onSelect,
  onPointerDown,
  onMoveToFinal,
  onMoveToIdeas,
}: LyricCardProps) => {
  const color = getCreatorColor(card.contributor);
  const initials = getCreatorInitials(card.contributor);
  const statusMeta = STATUS_COLORS[card.status] ?? STATUS_COLORS.raw;

  const state: CardInteractionState = card.isDimmedReference
    ? "dimmed"
    : isDragging
    ? "dragging"
    : selected
    ? "selected"
    : "default";

  const wordCount = card.wordCount ?? card.body.split(/\s+/).filter(Boolean).length;

  return (
    <CardShell
      color={color}
      state={state}
      isNew={isNew}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`Lyric: ${card.title} by ${card.contributor}`}
      style={{ left: card.x, top: card.y } as React.CSSProperties}
    >
      {/* Creator dot */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          backgroundColor: color.base,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 700,
          color: "#FFFFFF",
          letterSpacing: -0.3,
        }}
        title={card.contributor}
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Icon + section label */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            backgroundColor: color.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FileText size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#999",
            fontFamily: "var(--font-body)",
            maxWidth: 110,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {card.section}
        </span>
      </div>

      {/* Lyric body — Playfair Display */}
      <p
        id={`${card.id}-content`}
        style={{
          fontSize: 13,
          fontFamily: "var(--font-display)",
          color: "#1A1A1A",
          lineHeight: 1.65,
          marginBottom: 10,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: selected ? 999 : 3,
          WebkitBoxOrient: "vertical",
          transition: "all 240ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {card.body || card.title}
      </p>

      {/* "Used in Final" label for dimmed references */}
      {card.isDimmedReference && (
        <p style={{ fontSize: 10, color: color.base, marginBottom: 6, fontWeight: 600, opacity: 0.8 }}>
          ↳ Used in Final
        </p>
      )}

      {/* Footer: word count + status chip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 9, color: "#CCC", fontFamily: "var(--font-body)" }}>
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            padding: "2px 6px",
            borderRadius: 9999,
            backgroundColor: statusMeta.bg,
            color: statusMeta.text,
            fontFamily: "var(--font-body)",
          }}
        >
          {statusMeta.icon ?? ""}{card.status}
        </span>
      </div>

      {/* In-place action bar — only when selected */}
      {selected && !card.isDimmedReference && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 9,
            borderTop: `1px solid ${color.base}18`,
            display: "flex",
            gap: 6,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {card.status !== "approved" && onMoveToFinal && (
            <button
              onClick={onMoveToFinal}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: color.base,
                color: "#FFF",
                fontSize: 11,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                letterSpacing: "0.03em",
              }}
            >
              → Final
            </button>
          )}
          {onMoveToIdeas && (
            <button
              onClick={onMoveToIdeas}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 8,
                backgroundColor: "rgba(0,0,0,0.05)",
                color: "#666",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              ← Ideas
            </button>
          )}
        </div>
      )}
    </CardShell>
  );
});

LyricCard.displayName = "LyricCard";

export default LyricCard;
