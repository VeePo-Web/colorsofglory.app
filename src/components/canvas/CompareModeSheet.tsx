import { useCallback, useEffect, useRef, useState } from "react";
import { GitCompare, Pause, Play, X } from "lucide-react";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import { COMPARE_A_TONE, COMPARE_B_TONE, type GloryTone } from "@/lib/canvas/glorySpectrum";
import { Z } from "@/lib/canvas/zLayers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareModeSheetProps {
  /** Exactly two canvas cards to compare. */
  cards: [CanvasBoardCard, CanvasBoardCard];
  /** Card currently auditioning through the shared canvas audio (useCompareMode). */
  playingId: string | null;
  /** Real A/B audition toggle — one take at a time, never overlapping. */
  onTogglePlay: (cardId: string) => void;
  /** Called with the winning card id when the songwriter chooses a direction. */
  onChoose: (winnerId: string) => void;
  /** Called when the songwriter keeps both ideas active. */
  onKeepBoth: () => void;
  /** Dismisses the sheet without making a decision. */
  onClose: () => void;
}

// ─── Idea card view ───────────────────────────────────────────────────────────

interface IdeaCardViewProps {
  card: CanvasBoardCard;
  label: string;
  /** Two-tone spectral edge: take A wears rose, take B wears violet. */
  tone: GloryTone;
  isPlaying: boolean;
  isSelected: boolean;
  onTogglePlay: () => void;
  onSelect: () => void;
}

const IdeaCardView = ({
  card,
  label,
  tone,
  isPlaying,
  isSelected,
  onTogglePlay,
  onSelect,
}: IdeaCardViewProps) => {
  const isVoice = card.type === "voice" || card.type === "hum";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${label}: ${card.title} by ${card.contributor}${isSelected ? ", selected" : ""}`}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 20,
        backgroundColor: "var(--cog-cream-light)",
        border: isSelected ? `2px solid ${tone.base}` : "2px solid transparent",
        borderLeft: isSelected ? `2px solid ${tone.base}` : `2px solid ${tone.dim}`,
        boxShadow: isSelected
          ? `0 0 0 4px ${tone.bg}, 0 8px 28px ${tone.glow}`
          : "0 4px 16px rgba(0,0,0,0.07)",
        padding: "16px 16px 14px",
        cursor: "pointer",
        transition: "border-color 180ms ease, box-shadow 180ms ease, transform 150ms ease",
        transform: isSelected ? "scale(1.015)" : "scale(1)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        outline: "none",
        flexShrink: 0,
      }}
    >
      {/* Header: label + contributor */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: tone.dark,
            fontFamily: "var(--font-body)",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              backgroundColor: card.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 7,
              fontWeight: 800,
              color: "#FFF",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {card.contributor.slice(0, 2).toUpperCase()}
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
            }}
          >
            {card.contributor}
          </span>
        </div>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "var(--cog-charcoal)",
          fontFamily: "var(--font-display)",
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {card.title}
      </p>

      {/* Body / lyric preview */}
      {card.body ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--cog-warm-gray)",
            lineHeight: 1.6,
            fontFamily: "var(--font-body)",
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {card.body}
        </p>
      ) : null}

      {/* Signal / duration meta */}
      {card.meta && (
        <p
          style={{
            fontSize: 11,
            color: tone.dark,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            margin: 0,
          }}
        >
          {card.meta}
        </p>
      )}

      {/* Play toggle — voice / hum cards only */}
      {isVoice && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 7,
            minHeight: 44,
            paddingInline: 16,
            borderRadius: 999,
            backgroundColor: isPlaying ? tone.dark : tone.bg,
            color: isPlaying ? "#FFF" : tone.dark,
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-body)",
            border: "none",
            cursor: "pointer",
            transition: "background-color 150ms ease, color 150ms ease",
          }}
        >
          {isPlaying ? (
            <Pause size={13} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Play size={13} strokeWidth={2.5} aria-hidden="true" />
          )}
          {isPlaying ? "Pause" : `Play ${label}`}
        </button>
      )}
    </button>
  );
};

// ─── Compare mode sheet ───────────────────────────────────────────────────────

const CompareModeSheet = ({
  cards,
  playingId,
  onTogglePlay,
  onChoose,
  onKeepBoth,
  onClose,
}: CompareModeSheetProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Idempotency: block double-tap on the CTA
  const decisionKeyRef = useRef<string | null>(null);

  const section = cards[0].section || "Idea";
  const labelA = `${section} A`;
  const labelB = `${section} B`;

  // The decision is a synchronous local state change — no fake latency
  // theater. A short "saved" beat gives the choice a moment to land, then the
  // sheet closes itself.
  const handleChoose = useCallback(() => {
    if (!selectedId || decisionKeyRef.current) return;
    decisionKeyRef.current = "choose";
    onChoose(selectedId);
    setIsDone(true);
    setTimeout(onClose, 500);
  }, [selectedId, onChoose, onClose]);

  const handleKeepBoth = useCallback(() => {
    if (decisionKeyRef.current) return;
    decisionKeyRef.current = "both";
    onKeepBoth();
    setIsDone(true);
    setTimeout(onClose, 400);
  }, [onKeepBoth, onClose]);
  const isSaving = isDone;

  // Focus management: move focus into the sheet on open, trap Tab within it,
  // Escape to dismiss. Background stays inert behind the scrim + trap.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === sheetRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const statusText = isDone ? "Saved." : null;

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(28, 26, 23, 0.48)",
          zIndex: Z.sheetBackdrop,
          animation: "cog-fade-in 200ms ease forwards",
        }}
      />

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Compare ${section} ideas`}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: Z.sheet,
          backgroundColor: "var(--cog-cream)",
          borderRadius: "28px 28px 0 0",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
          maxHeight: "90dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div
            aria-hidden="true"
            style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GitCompare
              size={16}
              strokeWidth={2}
              style={{ color: "var(--cog-gold)", flexShrink: 0 }}
              aria-hidden="true"
            />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-display)",
                margin: 0,
              }}
            >
              Compare {section} Ideas
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close compare mode"
            style={{
              minWidth: 32,
              minHeight: 32,
              borderRadius: "50%",
              backgroundColor: "rgba(0,0,0,0.06)",
              color: "var(--cog-warm-gray)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 150ms ease",
            }}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--cog-warm-gray)",
            padding: "6px 20px 16px",
            fontFamily: "var(--font-body)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Tap a card to select a direction. Neither idea will be deleted.
        </p>

        {/* Cards — stacked vertically (mobile-first) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 20px" }}>
          <IdeaCardView
            card={cards[0]}
            label={labelA}
            tone={COMPARE_A_TONE}
            isPlaying={playingId === cards[0].id}
            isSelected={selectedId === cards[0].id}
            onTogglePlay={() => onTogglePlay(cards[0].id)}
            onSelect={() =>
              setSelectedId((prev) => (prev === cards[0].id ? null : cards[0].id))
            }
          />
          <IdeaCardView
            card={cards[1]}
            label={labelB}
            tone={COMPARE_B_TONE}
            isPlaying={playingId === cards[1].id}
            isSelected={selectedId === cards[1].id}
            onTogglePlay={() => onTogglePlay(cards[1].id)}
            onSelect={() =>
              setSelectedId((prev) => (prev === cards[1].id ? null : cards[1].id))
            }
          />
        </div>

        {/* Status message */}
        <p
          aria-live="polite"
          aria-atomic="true"
          style={{
            padding: "0 20px 10px",
            fontSize: 13,
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            margin: 0,
            minHeight: 20,
            color: isDone ? "var(--cog-gold)" : "var(--cog-warm-gray)",
          }}
        >
          {statusText ?? ""}
        </p>

        {/* Actions */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Primary: Choose direction */}
          <button
            type="button"
            onClick={() => void handleChoose()}
            disabled={!selectedId || isSaving}
            aria-disabled={!selectedId || isSaving}
            style={{
              minHeight: 54,
              borderRadius: 16,
              backgroundColor:
                !selectedId || isSaving ? "rgba(181,147,90,0.35)" : "var(--cog-gold)",
              color: "#FFF",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              border: "none",
              cursor: !selectedId || isSaving ? "default" : "pointer",
              transition: "background-color 180ms ease",
              width: "100%",
            }}
          >
            {isSaving && !isDone ? "Saving direction..." : "Choose direction"}
          </button>

          {/* Secondary: Keep both */}
          <button
            type="button"
            onClick={() => void handleKeepBoth()}
            disabled={isSaving}
            style={{
              minHeight: 48,
              borderRadius: 14,
              backgroundColor: "transparent",
              color: "var(--cog-warm-gray)",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              border: "1.5px solid var(--cog-border)",
              cursor: isSaving ? "default" : "pointer",
              opacity: isSaving ? 0.5 : 1,
              transition: "opacity 150ms ease",
              width: "100%",
            }}
          >
            Keep both
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cog-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cog-sheet-rise {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cog-compare-backdrop,
          .cog-compare-sheet {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default CompareModeSheet;
