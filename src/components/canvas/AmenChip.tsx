import { memo, type CSSProperties, type PointerEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Heart, Sparkles } from "lucide-react";
import type { CardReactionKind } from "@/integrations/cog/reactions";
import type { AmenSummary } from "@/lib/canvas/collab/amens";
import { getCreatorInitials } from "@/lib/canvas/creatorColors";
import { useVibration } from "@/hooks/useVibration";

/**
 * AmenChip — the encouragement layer's card footer (D3 fills D1's adornment
 * slot). Two calm faces:
 *
 *  - Unselected card WITH amens: a small display cluster of WHO affirmed —
 *    contributor-colored initial dots, capped +N — never a red count, never
 *    interactive (a hot target on a drag/pan canvas is a mis-tap hazard).
 *  - Selected card: the warm action row — "Amen" (serif) · heart · keeper —
 *    44px targets, gold when yours, one tap on = one tap off.
 *
 * It renders in normal flow after the face (the card grows; nothing ever
 * overlaps), stops propagation so a tap never selects/drags the card under
 * it, and appears with an opacity-only fade (reduced-motion compliant by
 * construction — no scale, no bounce).
 */

const GOLD = "var(--cog-gold, #B8953A)";
const GOLD_PALE = "rgba(184,149,58,0.14)";

const swallow = {
  onPointerDown: (e: PointerEvent) => e.stopPropagation(),
  onPointerUp: (e: PointerEvent) => e.stopPropagation(),
  onClick: (e: MouseEvent) => e.stopPropagation(),
  onKeyDown: (e: KeyboardEvent) => {
    // CardShell treats Enter/Space at the shell as "select card" — an amen
    // keypress must stay an amen keypress.
    if (e.key === " " || e.key === "Enter") e.stopPropagation();
  },
};

const fadeIn: CSSProperties = { animation: "cog-amen-in 400ms ease both" };

// Injected once at module load (render must stay pure). Opacity-only, so
// it is reduced-motion compliant by construction — no scale, no bounce.
if (typeof document !== "undefined" && !document.getElementById("cog-amen-keyframes")) {
  const style = document.createElement("style");
  style.id = "cog-amen-keyframes";
  style.textContent = `@keyframes cog-amen-in { from { opacity: 0 } to { opacity: 1 } }`;
  document.head.appendChild(style);
}

function describe(summary: AmenSummary): string {
  const names = summary.contributors.map((c) => c.name);
  const extra = summary.count - summary.contributors.length;
  const who =
    names.length === 0
      ? "Someone"
      : names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return extra > 0 ? `${who} and ${extra} more said amen` : `${who} said amen`;
}

/** The tiny contributor-colored initial dots, newest first, capped. */
const DotCluster = ({ summary }: { summary: AmenSummary }) => {
  const extra = summary.count - summary.contributors.length;
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
      {summary.contributors.map((c, i) => (
        <span
          key={c.id}
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            backgroundColor: c.color,
            color: "#FFF",
            fontSize: 8.5,
            fontWeight: 800,
            fontFamily: "var(--font-body)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid #FFFCF7",
            marginLeft: i === 0 ? 0 : -5,
            ...fadeIn,
          }}
        >
          {getCreatorInitials(c.name)}
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: 4,
            fontSize: 10.5,
            fontWeight: 700,
            color: "var(--cog-warm-gray, #6B6459)",
            fontFamily: "var(--font-body)",
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
};

const kindBtn = (active: boolean): CSSProperties => ({
  height: 44,
  minWidth: 44,
  borderRadius: 12,
  border: active ? `1.5px solid rgba(184,149,58,0.45)` : "1.5px solid rgba(28,26,23,0.10)",
  backgroundColor: active ? GOLD_PALE : "rgba(255,255,255,0.7)",
  color: active ? GOLD : "var(--cog-warm-gray, #6B6459)",
  // A soft, STATIC warm lift on your own affirmation — "yours" reads as gently
  // lit, not merely tinted. Static (no pulse) → reduced-motion-safe.
  boxShadow: active ? "0 1px 10px rgba(184,149,58,0.30)" : "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
  transition: "background-color 150ms ease, border-color 150ms ease, box-shadow 200ms ease, transform 150ms ease",
});

export interface AmenChipProps {
  summary: AmenSummary | null;
  selected: boolean;
  cardTitle: string;
  onToggle: (kind: CardReactionKind) => void;
}

const AmenChip = memo(function AmenChip({ summary, selected, cardTitle, onToggle }: AmenChipProps) {
  const { vibrate } = useVibration();
  // Giving an affirmation should be FELT — a warmer tick when you bless a card,
  // a lighter one when you quietly withdraw. (No-op on iOS, which has no
  // Vibration API — the amen still lands; the tap just isn't haptic there.)
  const affirm = (kind: CardReactionKind, wasMine: boolean) => {
    vibrate(wasMine ? 4 : 10);
    onToggle(kind);
  };
  const count = summary?.count ?? 0;
  if (!selected && count === 0) return null;

  const mineAmen = summary?.mine.has("amen") ?? false;
  const mineHeart = summary?.mine.has("heart") ?? false;
  const mineKeeper = summary?.mine.has("keeper") ?? false;

  // Unselected: pure calm display — who affirmed, never a metric.
  if (!selected) {
    return (
      <div
        role="img"
        aria-label={describe(summary!)}
        style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, ...fadeIn }}
      >
        <DotCluster summary={summary!} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 11.5,
            color: mineAmen || mineHeart || mineKeeper ? GOLD : "var(--cog-warm-gray, #6B6459)",
          }}
        >
          amen
        </span>
      </div>
    );
  }

  // Selected: the warm action row. Buttons swallow events so an amen tap
  // never becomes a card drag/select/keyboard toggle.
  return (
    <div style={{ marginTop: 10, ...fadeIn }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          {...swallow}
          onClick={(e) => {
            e.stopPropagation();
            affirm("amen", mineAmen);
          }}
          aria-pressed={mineAmen}
          aria-label={mineAmen ? `Remove your amen from ${cardTitle}` : `Say amen to ${cardTitle}`}
          style={{ ...kindBtn(mineAmen), flex: 1, padding: "0 14px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 14.5,
            }}
          >
            Amen
          </span>
          {count > 0 && <DotCluster summary={summary!} />}
        </button>
        <button
          type="button"
          {...swallow}
          onClick={(e) => {
            e.stopPropagation();
            affirm("heart", mineHeart);
          }}
          aria-pressed={mineHeart}
          aria-label={mineHeart ? `Remove your heart from ${cardTitle}` : `Send a heart to ${cardTitle}`}
          style={kindBtn(mineHeart)}
        >
          <Heart size={16} fill={mineHeart ? GOLD : "none"} strokeWidth={2} />
        </button>
        <button
          type="button"
          {...swallow}
          onClick={(e) => {
            e.stopPropagation();
            affirm("keeper", mineKeeper);
          }}
          aria-pressed={mineKeeper}
          aria-label={mineKeeper ? `Remove your keeper mark from ${cardTitle}` : `Mark ${cardTitle} as a keeper`}
          style={kindBtn(mineKeeper)}
        >
          <Sparkles size={16} strokeWidth={2} />
        </button>
      </div>
      {count > 0 && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10.5,
            color: "var(--cog-warm-gray, #6B6459)",
            fontFamily: "var(--font-body)",
          }}
        >
          {describe(summary!)}
        </div>
      )}
    </div>
  );
});

export default AmenChip;
