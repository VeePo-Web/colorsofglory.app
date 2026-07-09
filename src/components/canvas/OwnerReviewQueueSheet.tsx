import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, X } from "lucide-react";

/**
 * OwnerReviewQueueSheet (COG Product 11 — Owner Review Queue / Pending Ideas)
 *
 * When co-writers drop ideas into the room, the owner returns to a CALM
 * "Needs your review" — grouped counts, no red-badge anxiety — then steps
 * through each pending idea one at a time with three plain-language choices:
 * Add to Final (approve), Keep in Ideas (leave it), or Not this one (dismiss).
 * The queue is snapshotted on open so acting on a card never re-indexes the
 * ones still ahead. Bottom-sheet idiom matches WhatChangedRecapSheet:
 * backdrop + rise, Escape-to-close, safe-area, reduced-motion safe.
 */

export interface ReviewCard {
  id: string;
  title: string;
  body: string;
  section: string;
  contributor: string;
  accent: string;
  /** Plain-language kind, e.g. "Voice memo", "Lyric", "Chord", "Line suggestion". */
  kind: string;
  /** When present, this item is a Feature 19 line suggestion, reviewed inline. */
  suggestion?: { originalLine: string; proposedLine: string };
}

interface OwnerReviewQueueSheetProps {
  items: ReviewCard[];
  onApprove: (cardId: string) => void;
  onKeep: (cardId: string) => void;
  onDismiss: (cardId: string) => void;
  /** Accept a line suggestion (replace the line). id = suggestion item id. */
  onAcceptLine?: (id: string) => void;
  /** Keep the original line (dismiss the suggestion). id = suggestion item id. */
  onKeepLine?: (id: string) => void;
  /** Fly the canvas to a card so the owner can see it in context. */
  onSee?: (cardId: string) => void;
  onClose: () => void;
}

type Phase = "summary" | "review" | "done";

const OwnerReviewQueueSheet = ({
  items,
  onApprove,
  onKeep,
  onDismiss,
  onAcceptLine,
  onKeepLine,
  onSee,
  onClose,
}: OwnerReviewQueueSheetProps) => {
  // Freeze the queue on open — parent mutations shrink the live list, but the
  // owner should walk the set that was pending when they hit "Start review".
  const [queue] = useState<ReviewCard[]>(() => items);
  const [phase, setPhase] = useState<Phase>("summary");
  const [index, setIndex] = useState(0);
  const acted = useRef<Set<string>>(new Set());
  const sheetRef = useRef<HTMLDivElement>(null);

  // Focus discipline: focus moves INTO the dialog on open, Tab cycles inside
  // it, Escape closes, and focus returns to the opener — a keyboard or
  // screen-reader owner must never Tab-walk the canvas behind the review.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
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
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  // Grouped counts by plain-language kind for the summary hero.
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of queue) m.set(c.kind, (m.get(c.kind) ?? 0) + 1);
    return Array.from(m.entries());
  }, [queue]);

  const advance = () => {
    if (index + 1 >= queue.length) setPhase("done");
    else setIndex((i) => i + 1);
  };

  const act = (fn: (id: string) => void, card: ReviewCard) => {
    if (acted.current.has(card.id)) return; // guard double-tap
    acted.current.add(card.id);
    fn(card.id);
    advance();
  };

  const current = queue[index];

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(28,26,23,0.48)",
          animation: "cog-fade-in 200ms ease forwards",
        }}
      />
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Needs your review"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 800,
          backgroundColor: "var(--cog-cream)",
          borderRadius: "28px 28px 0 0",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22,1,0.36,1) forwards",
          maxHeight: "90dvh", overflowY: "auto",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }} />
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 12, right: 16, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#666",
          }}
          aria-label="Close review"
        >
          <X size={18} />
        </button>

        <div style={{ padding: "4px 24px 16px" }}>
          {phase === "summary" && (
            <>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem,5vw,2.15rem)", fontWeight: 780, lineHeight: 1.12, color: "var(--cog-charcoal)", margin: "8px 0 6px" }}>
                Needs your review
              </h2>
              <p style={{ fontSize: 15, color: "var(--cog-warm-gray)", marginBottom: 18, lineHeight: 1.45 }}>
                {queue.length} idea{queue.length !== 1 ? "s" : ""} your co-writers added, waiting on you.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
                {groups.map(([kind, count]) => (
                  <div
                    key={kind}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 16px", borderRadius: 16,
                      backgroundColor: "var(--cog-cream-light)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--cog-charcoal)" }}>
                      {count} {kind}{count !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--cog-muted)" }}>Pending</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPhase("review")}
                style={{
                  display: "block", width: "100%", minHeight: 60, borderRadius: 16, border: "none",
                  backgroundColor: "var(--cog-gold)", color: "#fff", fontSize: 17, fontWeight: 650,
                  cursor: "pointer", marginBottom: 12,
                }}
              >
                Start review
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: "block", width: "100%", minHeight: 44, borderRadius: 12, border: "none",
                  backgroundColor: "transparent", color: "var(--cog-warm-gray)", fontSize: 15, fontWeight: 500, cursor: "pointer",
                }}
              >
                Not now
              </button>
            </>
          )}

          {phase === "review" && current && (
            <>
              <p aria-live="polite" style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--cog-muted)", marginBottom: 12 }}>
                {index + 1} of {queue.length}
              </p>
              <div
                style={{
                  borderRadius: 20, padding: 18, marginBottom: 18,
                  backgroundColor: "var(--cog-cream-light)",
                  border: `1.5px solid ${current.accent}40`,
                  boxShadow: "0 4px 18px rgba(0,0,0,0.07)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: current.accent, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                    {current.contributor.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--cog-charcoal)" }}>{current.contributor}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--cog-muted)", marginLeft: "auto" }}>
                    {current.section}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--cog-charcoal)", marginBottom: 6, lineHeight: 1.3 }}>
                  {current.title}
                </p>
                {current.suggestion ? (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cog-muted)", marginBottom: 4 }}>Original</p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.5, marginBottom: 12, textDecoration: "line-through", textDecorationColor: "rgba(0,0,0,0.25)" }}>
                      {current.suggestion.originalLine || "(empty line)"}
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cog-gold)", marginBottom: 4 }}>Suggested</p>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--cog-charcoal)", lineHeight: 1.5, fontWeight: 600 }}>
                      {current.suggestion.proposedLine}
                    </p>
                  </div>
                ) : (
                  current.body && (
                    <p style={{ fontSize: 14, color: "var(--cog-warm-gray)", lineHeight: 1.5 }}>{current.body}</p>
                  )
                )}
                {onSee && !current.suggestion && (
                  <button
                    type="button"
                    onClick={() => onSee(current.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, minHeight: 40,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--cog-gold)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)", padding: 0,
                    }}
                  >
                    <Eye size={14} strokeWidth={1.9} /> See it on the canvas
                  </button>
                )}
              </div>

              {current.suggestion ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => act((id) => onKeepLine?.(id), current)}
                    style={{
                      flex: 1, minHeight: 56, borderRadius: 16, cursor: "pointer",
                      backgroundColor: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.10)",
                      color: "var(--cog-charcoal)", fontSize: 15, fontWeight: 600, fontFamily: "var(--font-body)",
                    }}
                  >
                    Keep original
                  </button>
                  <button
                    type="button"
                    onClick={() => act((id) => onAcceptLine?.(id), current)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      minHeight: 56, borderRadius: 16, border: "none", cursor: "pointer",
                      backgroundColor: "var(--cog-gold)", color: "#fff", fontSize: 15, fontWeight: 700,
                      boxShadow: "0 6px 18px rgba(184,149,58,0.32)", fontFamily: "var(--font-body)",
                    }}
                  >
                    <Check size={17} strokeWidth={2.2} /> Accept line
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => act(onApprove, current)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", minHeight: 56, borderRadius: 16, border: "none",
                      backgroundColor: "var(--cog-gold)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 10,
                      boxShadow: "0 6px 18px rgba(184,149,58,0.32)",
                    }}
                  >
                    <Check size={18} strokeWidth={2.2} /> Add to Final
                  </button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => act(onKeep, current)}
                      style={{
                        flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer",
                        backgroundColor: "#FFFFFF", border: "1.5px solid rgba(0,0,0,0.10)",
                        color: "var(--cog-charcoal)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)",
                      }}
                    >
                      Keep in Ideas
                    </button>
                    <button
                      type="button"
                      onClick={() => act(onDismiss, current)}
                      style={{
                        flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer",
                        backgroundColor: "transparent", border: "1.5px solid rgba(0,0,0,0.08)",
                        color: "var(--cog-warm-gray)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)",
                      }}
                    >
                      Not this one
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
              <div style={{ margin: "0 auto 14px", width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(83,171,139,0.14)", border: "1.5px solid rgba(83,171,139,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }} aria-hidden="true">
                <Check size={26} strokeWidth={2} style={{ color: "#53AB8B" }} />
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 760, color: "var(--cog-charcoal)", marginBottom: 6 }}>
                All caught up
              </h2>
              <p style={{ fontSize: 14, color: "var(--cog-warm-gray)", marginBottom: 20, lineHeight: 1.45 }}>
                You've reviewed everything your co-writers sent. The room is clear.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: "block", width: "100%", minHeight: 56, borderRadius: 16, border: "none",
                  backgroundColor: "var(--cog-gold)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
                }}
              >
                Back to the song
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cog-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cog-sheet-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          [role="presentation"], [role="dialog"] { animation: none !important; }
        }
      `}</style>
    </>
  );
};

export default OwnerReviewQueueSheet;
