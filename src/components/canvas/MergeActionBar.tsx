import { useEffect, useState } from "react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { getCreatorColor } from "@/lib/canvas/creatorColors";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";

interface MergeActionBarProps {
  selection: string[];
  cards: CanvasBoardCard[];
  onRemove: (id: string) => void;
  onMerge: () => void;
  onClear: () => void;
}

const MergeActionBar = ({ selection, cards, onRemove, onMerge, onClear }: MergeActionBarProps) => {
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(selection.length > 0));
    return () => cancelAnimationFrame(t);
  }, [selection.length]);

  if (selection.length === 0 && !visible) return null;

  const selectedCards = selection
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as CanvasBoardCard[];
  const canMerge = selection.length === 2;

  return (
    <div
      role="toolbar"
      aria-label="Merge ideas toolbar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 540,
        backgroundColor: "var(--cog-cream-light, #FAFAF6)",
        borderTop: "1px solid rgba(184,149,58,0.25)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
        borderRadius: "20px 20px 0 0",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        transform: visible && selection.length > 0 ? "translateY(0)" : "translateY(100%)",
        transition: reducedMotion ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Drag handle */}
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 4,
          borderRadius: 9999,
          backgroundColor: "rgba(0,0,0,0.15)",
          margin: "10px auto 0",
        }}
      />

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px 4px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--cog-gold, #B8953A)",
          }}
        >
          Merge Ideas {selection.length > 0 ? `(${selection.length}/2)` : ""}
        </span>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--cog-warm-gray, #6B6459)",
            minHeight: 44,
            padding: "4px 12px",
            borderRadius: 8,
          }}
          aria-label="Cancel merge"
        >
          Cancel
        </button>
      </div>

      {/* Selected cards strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          padding: "6px 16px 10px",
          scrollbarWidth: "none",
        }}
      >
        {selectedCards.map((card, i) => {
          const color = getCreatorColor(card.contributor);
          return (
            <div
              key={card.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexShrink: 0,
                backgroundColor: `${color.base}12`,
                border: `1px solid ${color.base}30`,
                borderRadius: 10,
                padding: "6px 10px",
                maxWidth: 160,
              }}
            >
              {/* Position badge */}
              <div
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: color.base,
                  color: "#FFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </div>
              {/* Card title */}
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--cog-charcoal)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {card.title}
              </span>
              {/* Remove from merge */}
              <button
                type="button"
                onClick={() => onRemove(card.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--cog-muted, #A09689)",
                  padding: 0,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  lineHeight: 1,
                }}
                aria-label={`Remove ${card.title} from merge`}
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* "Select 1 more" placeholder */}
        {selection.length < 2 && (
          <div
            aria-hidden="true"
            style={{
              flexShrink: 0,
              borderRadius: 10,
              padding: "6px 14px",
              border: "1.5px dashed rgba(184,149,58,0.35)",
              color: "var(--cog-muted, #A09689)",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontStyle: "italic",
            }}
          >
            Select 1 more idea…
          </div>
        )}
      </div>

      {/* Merge CTA */}
      <div style={{ padding: "0 16px 8px" }}>
        <button
          type="button"
          onClick={onMerge}
          disabled={!canMerge}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            backgroundColor: canMerge ? "var(--cog-gold, #B8953A)" : "rgba(0,0,0,0.08)",
            color: canMerge ? "#FFF" : "var(--cog-muted, #A09689)",
            border: "none",
            cursor: canMerge ? "pointer" : "default",
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: canMerge ? "0 4px 16px rgba(184,149,58,0.35)" : "none",
            transition: "background-color 200ms ease, color 200ms ease, box-shadow 200ms ease",
          }}
          aria-disabled={!canMerge}
          aria-label="Merge selected ideas into a new section"
        >
          Merge into section
        </button>
      </div>
    </div>
  );
};

export default MergeActionBar;
