import { memo } from "react";
import { Music } from "lucide-react";
import CardShell, { type CardInteractionState } from "./CardShell";
import { getCreatorColor, getCreatorInitials } from "@/lib/canvas/creatorColors";

export interface ChordCardData {
  id: string;
  x: number;
  y: number;
  title: string;
  chords: string[];
  key?: string;
  bpm?: number;
  timeSignature?: string;
  contributor: string;
  isDimmedReference?: boolean;
}

interface ChordCardProps {
  card: ChordCardData;
  selected: boolean;
  isDragging?: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMoveToFinal?: () => void;
  onMoveToIdeas?: () => void;
}

const MAX_CHORDS_PER_ROW = 4;

/**
 * ChordCard — displays a chord progression as visual chips.
 * Creator color chips (base15 bg, dark text) in rows of max 4.
 * Key, BPM, time signature as small unicode-symbol tags.
 */
const ChordCard = memo(({ card, selected, isDragging = false, isNew = false, onSelect, onPointerDown, onMoveToFinal, onMoveToIdeas }: ChordCardProps) => {
  const color = getCreatorColor(card.contributor);
  const initials = getCreatorInitials(card.contributor);

  const state: CardInteractionState = card.isDimmedReference ? "dimmed" : isDragging ? "dragging" : selected ? "selected" : "default";

  // Split chords into rows of max 4
  const rows: string[][] = [];
  for (let i = 0; i < card.chords.length; i += MAX_CHORDS_PER_ROW) {
    rows.push(card.chords.slice(i, i + MAX_CHORDS_PER_ROW));
  }

  return (
    <CardShell
      color={color}
      state={state}
      isNew={isNew}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      aria-label={`Chords: ${card.chords.join(", ")} by ${card.contributor}`}
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: color.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Music size={13} strokeWidth={1.8} style={{ color: color.base }} />
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "#999", fontFamily: "var(--font-body)" }}>
          {card.title}
        </span>
      </div>

      {/* Chord chip rows */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}
        aria-label={`Chord progression: ${card.chords.join(", ")}`}
      >
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {row.map((chord, ci) => (
              <span
                key={`${ri}-${ci}`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                  padding: "3px 7px",
                  borderRadius: 9999,
                  backgroundColor: `${color.base}18`,
                  border: `1px solid ${color.base}38`,
                  color: color.dark,
                  letterSpacing: "0.02em",
                }}
                aria-label={`${chord} chord`}
              >
                {chord}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Key / BPM / time signature tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: selected ? 0 : 2 }}>
        {card.key && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontFamily: "var(--font-body)" }}>
            ♪ {card.key}
          </span>
        )}
        {card.bpm && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontFamily: "var(--font-body)" }}>
            ♩ {card.bpm}
          </span>
        )}
        {card.timeSignature && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontFamily: "var(--font-body)" }}>
            {card.timeSignature}
          </span>
        )}
      </div>

      {/* Action bar */}
      {selected && !card.isDimmedReference && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${color.base}18`, display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {onMoveToFinal && (
            <button onClick={onMoveToFinal} style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: color.base, color: "#FFF", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}>
              → Final
            </button>
          )}
          {onMoveToIdeas && (
            <button onClick={onMoveToIdeas} style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.05)", color: "#666", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "var(--font-body)" }}>
              ← Ideas
            </button>
          )}
        </div>
      )}
    </CardShell>
  );
});

ChordCard.displayName = "ChordCard";
export default ChordCard;
