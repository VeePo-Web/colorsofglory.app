import { memo, useCallback, useState } from "react";
import type { CreatorColor } from "@/lib/canvas/creatorColors";

export interface ClusterCard {
  id: string;
  title: string;
  body: string;
  contributor: string;
  type: string;
  x: number;
  y: number;
}

export interface SectionClusterData {
  id: string;
  sectionLabel: string;
  x: number;
  y: number;
  cards: ClusterCard[];
  color: CreatorColor;    // color of the most frequent contributor in this cluster
}

interface SectionClusterProps {
  cluster: SectionClusterData;
  onExpand: (clusterId: string) => void;
}

const MINI_W = 48;
const MINI_H = 40;
const CARD_W = 200;
const CARD_H = 56;

/**
 * SectionCluster — collapses 10+ cards with the same section label.
 *
 * Visual: Physical stack of 3 cards (rotated shadows behind the front card).
 * Front card: section label + count badge + 3 mini-card previews.
 * Tap: triggers onExpand callback (parent fans cards out from cluster position).
 */
const SectionCluster = memo(({ cluster, onExpand }: SectionClusterProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const { color, sectionLabel, cards, x, y } = cluster;

  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onExpand(cluster.id);
  }, [cluster.id, onExpand]);

  const previewCards = cards.slice(0, 3);
  const remaining = cards.length;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: CARD_W,
        cursor: "pointer",
      }}
      onClick={handleExpand}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-canvas-nopan
      role="button"
      aria-label={`Section cluster: ${sectionLabel}, ${cards.length} ideas. Tap to expand.`}
      aria-expanded={false}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(cluster.id); } }}
    >
      {/* Shadow card 3 — furthest back */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -8,
          left: 8,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${color.base}22`,
          transform: "rotate(-3deg)",
          transformOrigin: "center bottom",
          opacity: 0.30,
          zIndex: 1,
          transition: "transform 200ms ease, opacity 200ms ease",
          ...(isHovered && { transform: "rotate(-4.5deg) translate(-4px, -4px)", opacity: 0.22 }),
        }}
      />

      {/* Shadow card 2 — middle */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -4,
          left: 4,
          width: CARD_W,
          height: CARD_H,
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          border: `1px solid ${color.base}28`,
          transform: "rotate(-1.5deg)",
          transformOrigin: "center bottom",
          opacity: 0.55,
          zIndex: 2,
          transition: "transform 200ms ease, opacity 200ms ease",
          ...(isHovered && { transform: "rotate(-2.5deg) translate(-2px, -2px)", opacity: 0.44 }),
        }}
      />

      {/* Front card */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          borderRadius: 16,
          backgroundColor: "#FFFFFF",
          borderLeft: `3px solid ${color.base}`,
          borderTop: `1px solid ${color.base}28`,
          borderRight: `1px solid ${color.base}28`,
          borderBottom: `1px solid ${color.base}28`,
          boxShadow: isHovered
            ? `0 12px 36px ${color.glow}, 0 0 0 1.5px ${color.base}60`
            : `0 6px 20px ${color.glow}`,
          padding: "12px 13px 13px 11px",
          transition: "box-shadow 200ms ease, transform 200ms ease",
          transform: isHovered ? "translateY(-3px)" : "translateY(0)",
        }}
      >
        {/* Header: triangle + label + count badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                color: color.base,
                lineHeight: 1,
                transform: "rotate(0deg)",
                transition: "transform 200ms ease",
              }}
              aria-hidden="true"
            >
              ▶
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A", fontFamily: "var(--font-display)" }}>
              {sectionLabel}
            </span>
          </div>

          {/* Count badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 9999,
              backgroundColor: color.base,
              color: "#FFFFFF",
              fontFamily: "var(--font-body)",
              letterSpacing: "0.02em",
            }}
          >
            {remaining}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: `${color.base}15`, marginBottom: 9 }} />

        {/* Mini card previews — first 3 cards */}
        <div style={{ display: "flex", gap: 5 }}>
          {previewCards.map((card) => (
            <div
              key={card.id}
              style={{
                width: MINI_W,
                height: MINI_H,
                borderRadius: 8,
                backgroundColor: "#FAFAF6",
                borderLeft: `2px solid ${color.base}`,
                borderTop: `1px solid ${color.base}20`,
                borderRight: `1px solid ${color.base}20`,
                borderBottom: `1px solid ${color.base}20`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                overflow: "hidden",
                padding: "4px 4px 4px 5px",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <p
                style={{
                  fontSize: 8,
                  color: "#666",
                  lineHeight: 1.4,
                  fontFamily: "var(--font-body)",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  margin: 0,
                }}
              >
                {card.body || card.title}
              </p>
            </div>
          ))}

          {/* "+N more" if more than 3 previews */}
          {remaining > 3 && (
            <div
              style={{
                width: MINI_W,
                height: MINI_H,
                borderRadius: 8,
                backgroundColor: color.bg,
                border: `1px dashed ${color.base}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <span style={{ fontSize: 9, color: color.dark, fontWeight: 700, fontFamily: "var(--font-body)" }}>
                +{remaining - 3}
              </span>
            </div>
          )}
        </div>

        {/* Tap hint */}
        <p style={{ fontSize: 9, color: "#CCC", marginTop: 8, textAlign: "center", fontFamily: "var(--font-body)" }}>
          Tap to expand {remaining} ideas
        </p>
      </div>
    </div>
  );
});

SectionCluster.displayName = "SectionCluster";
export default SectionCluster;
