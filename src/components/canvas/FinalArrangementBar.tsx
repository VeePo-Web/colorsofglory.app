import { ChevronDown, ChevronUp, ListOrdered } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";

/**
 * FinalArrangementBar — F23 Final Arrangement mode.
 *
 * Collapsed: a quiet "Arrange final ▸" pill (shown when ≥2 final sections and
 * the viewer can edit). Active: a bottom toolbar listing the final sections in
 * running order with single-pointer / keyboard up-down controls, Save + Cancel.
 * D2 owns this order model + persistence (useFinalArrangement); the on-canvas
 * drag visual is D1's.
 */
interface FinalArrangementBarProps {
  arranging: boolean;
  canArrange: boolean;
  orderedCards: CanvasBoardCard[];
  onBegin: () => void;
  onMove: (id: string, delta: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

const FinalArrangementBar = ({
  arranging,
  canArrange,
  orderedCards,
  onBegin,
  onMove,
  onSave,
  onCancel,
}: FinalArrangementBarProps) => {
  const reducedMotion = usePrefersReducedMotion();

  if (!arranging) {
    if (!canArrange) return null;
    return (
      <button
        type="button"
        onClick={onBegin}
        aria-label="Arrange the final song order"
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 148px)",
          zIndex: 640,
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 40,
          padding: "0 14px",
          borderRadius: 999,
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(184,149,58,0.40)",
          color: "var(--cog-gold, #B8953A)",
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
          transition: reducedMotion ? "none" : "transform 150ms ease",
        }}
      >
        <ListOrdered size={14} strokeWidth={2} aria-hidden="true" />
        Arrange final ▸
      </button>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label="Final arrangement — running order"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 690,
        backgroundColor: "var(--cog-cream-light, #FAFAF6)",
        borderTop: "1px solid rgba(184,149,58,0.40)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
        borderRadius: "20px 20px 0 0",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        animation: reducedMotion
          ? "none"
          : "cog-arrange-rise 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Grabber */}
      <div
        aria-hidden="true"
        style={{
          width: 36,
          height: 4,
          borderRadius: 9999,
          backgroundColor: "rgba(28,26,23,0.15)",
          margin: "10px auto 0",
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 4px" }}>
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--cog-gold, #B8953A)",
          }}
        >
          Final running order
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 28,
            padding: "0 10px",
            borderRadius: 8,
            backgroundColor: "rgba(28,26,23,0.06)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--cog-warm-gray, #6B6459)",
          }}
          aria-label="Cancel arranging and restore the previous order"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          style={{
            height: 28,
            padding: "0 12px",
            borderRadius: 8,
            backgroundColor: "var(--cog-gold, #B8953A)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 11,
            fontWeight: 700,
            color: "#FFF",
            boxShadow: "0 2px 8px rgba(184,149,58,0.30)",
          }}
          aria-label="Save running order"
        >
          Save order
        </button>
      </div>

      {/* Ordered section rows */}
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: "4px 16px 8px",
          maxHeight: "36dvh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {orderedCards.map((card, index) => (
          <li
            key={card.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 48,
              padding: "6px 10px",
              borderRadius: 12,
              backgroundColor: "rgba(28,26,23,0.04)",
              border: `1px solid ${card.accent}30`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                backgroundColor: card.accent,
                color: "#FFF",
                fontSize: 10,
                fontWeight: 800,
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--cog-charcoal, #1C1A17)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {card.section || card.title}
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  color: "var(--cog-warm-gray, #6B6459)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {card.title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onMove(card.id, -1)}
              disabled={index === 0}
              aria-label={`Move ${card.section || card.title} earlier`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                cursor: index === 0 ? "default" : "pointer",
                backgroundColor: "rgba(28,26,23,0.06)",
                color: index === 0 ? "rgba(28,26,23,0.25)" : "var(--cog-charcoal, #1C1A17)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ChevronUp size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onMove(card.id, 1)}
              disabled={index === orderedCards.length - 1}
              aria-label={`Move ${card.section || card.title} later`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                cursor: index === orderedCards.length - 1 ? "default" : "pointer",
                backgroundColor: "rgba(28,26,23,0.06)",
                color:
                  index === orderedCards.length - 1
                    ? "rgba(28,26,23,0.25)"
                    : "var(--cog-charcoal, #1C1A17)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ChevronDown size={16} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ol>

      <style>{`
        @keyframes cog-arrange-rise {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default FinalArrangementBar;
