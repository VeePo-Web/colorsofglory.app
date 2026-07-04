import { useEffect, useRef, useState } from "react";
import { getCreatorColor } from "@/lib/canvas/creatorColors";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RecapItem {
  id: string;
  text: string;
  dotColor: string;
  /** Canvas card this change points at — makes the digest row a deep link. */
  targetCardId?: string;
}

interface WhatChangedRecapSheetProps {
  songId: string;
  onDismiss: () => void;
  /** Real digest entries from the room; the demo digest renders when absent. */
  items?: RecapItem[];
  /** Fly the canvas to a changed card (Product 12: rows deep-link to the change). */
  onJumpToCard?: (cardId: string) => void;
}

// ─── Demo digest (replaced by server activity-feed data in production) ──────

const DEMO_ITEMS: RecapItem[] = [
  { id: "r1", text: "Sarah added 2 harmony memos",    dotColor: getCreatorColor("Sarah").base   },
  { id: "r2", text: "Michael revised Verse 1 lyrics", dotColor: getCreatorColor("Michael").base },
  { id: "r3", text: "Kevin layered a piano idea",      dotColor: getCreatorColor("Kevin").base   },
  { id: "r4", text: "Chorus BPM changed 72 → 74",     dotColor: "var(--cog-gold)"               },
  { id: "r5", text: "3 ideas moved to shortlist",      dotColor: "var(--cog-muted)"              },
];

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * WhatChangedRecapSheet (COG Product 12)
 *
 * Calm bottom-sheet overlay shown when a collaborator returns to the canvas
 * room after being away. Shows up to 5 digest items ("what changed since you
 * left") with contributor color dots + plain-English descriptions.
 *
 * Pattern mirrors CompareModeSheet: fixed backdrop (z-60) + sheet panel (z-61),
 * cog-fade-in backdrop, cog-sheet-rise panel, Escape-to-dismiss, idempotency
 * guard on the primary CTA, prefers-reduced-motion safe.
 */
const WhatChangedRecapSheet = ({ songId: _songId, onDismiss, items: providedItems, onJumpToCard }: WhatChangedRecapSheetProps) => {
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [ctaLabel, setCtaLabel] = useState("Review changes");
  const ctaRef = useRef<HTMLButtonElement>(null);
  const didDismiss = useRef(false);

  // Simulate async fetch of activity digest — real impl calls the activity API.
  useEffect(() => {
    const t = window.setTimeout(() => setPhase("ready"), 560);
    return () => window.clearTimeout(t);
  }, []);

  // Auto-focus primary CTA when the digest is ready (accessibility + UX).
  useEffect(() => {
    if (phase === "ready") {
      window.setTimeout(() => ctaRef.current?.focus(), 50);
    }
  }, [phase]);

  // Escape key dismisses (consistent with every other canvas sheet).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const handleReview = () => {
    if (didDismiss.current) return;
    didDismiss.current = true;
    setCtaLabel("Opening review…");
    window.setTimeout(onDismiss, 320);
  };

  // Respect the real digest when the caller passes one (even empty → honest
  // empty state). DEMO_ITEMS only render when no items prop is supplied at all.
  const items = phase === "ready" ? (providedItems ?? DEMO_ITEMS) : [];
  const isEmpty = phase === "ready" && items.length === 0;
  const subtitle =
    phase === "loading"
      ? "Checking what changed…"
      : isEmpty
      ? "You're all caught up"
      : `${items.length} update${items.length !== 1 ? "s" : ""} since you were last here`;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      <div
        role="presentation"
        className="cog-recap-backdrop"
        onClick={onDismiss}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(28, 26, 23, 0.48)",
          zIndex: 60,
          animation: "cog-fade-in 200ms ease forwards",
        }}
      />

      {/* ── Sheet panel ───────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What changed since you left"
        className="cog-recap-sheet"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          backgroundColor: "var(--cog-cream)",
          borderRadius: "28px 28px 0 0",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div
            aria-hidden="true"
            style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }}
          />
        </div>

        <div style={{ padding: "4px 24px 16px" }}>
          {/* ── Headline ─────────────────────────────────────────────── */}
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.875rem, 5vw, 2.25rem)",
              fontWeight: 780,
              lineHeight: 1.1,
              color: "var(--cog-charcoal)",
              margin: "8px 0 6px",
              letterSpacing: "-0.01em",
            }}
          >
            What changed since you left
          </h2>

          {/* Subtitle (aria-live so screen readers announce the loaded count) */}
          <p
            aria-live="polite"
            aria-atomic="true"
            style={{
              fontSize: 15,
              color: "var(--cog-warm-gray)",
              marginBottom: 20,
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </p>

          {/* ── Loading skeletons ─────────────────────────────────────── */}
          {phase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {[0.9, 0.72, 0.54].map((opacity, i) => (
                <div
                  key={i}
                  style={{
                    height: 56,
                    borderRadius: 18,
                    backgroundColor: "var(--cog-cream-light)",
                    opacity,
                    animation: `cog-skeleton-pulse 1.6s ease-in-out ${i * 120}ms infinite`,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Digest item cards ─────────────────────────────────────── */}
          {phase === "ready" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {items.map((item, idx) => {
                const canJump = Boolean(item.targetCardId && onJumpToCard);
                const rowStyle: React.CSSProperties = {
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: "15px 16px",
                  borderRadius: 18,
                  backgroundColor: "var(--cog-cream-light)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  border: "none",
                  textAlign: "left",
                  cursor: canJump ? "pointer" : "default",
                  animation: `cog-item-rise 240ms cubic-bezier(0.22,1,0.36,1) ${idx * 36}ms both`,
                };
                const rowContent = (
                  <>
                    {/* Contributor color dot */}
                    <div
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: item.dotColor,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: "var(--cog-charcoal)",
                        lineHeight: 1.35,
                        flex: 1,
                      }}
                    >
                      {item.text}
                    </span>
                    {canJump && (
                      <span aria-hidden="true" style={{ color: "var(--cog-muted)", fontSize: 14 }}>
                        ›
                      </span>
                    )}
                  </>
                );
                // A row that points at a card is a deep link: tap → the canvas
                // flies to that exact change (COG Product 12).
                return canJump ? (
                  <button
                    key={item.id}
                    type="button"
                    className="cog-recap-item"
                    style={rowStyle}
                    onClick={() => {
                      onJumpToCard?.(item.targetCardId as string);
                      onDismiss();
                    }}
                    aria-label={`${item.text} — see it on the canvas`}
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div key={item.id} className="cog-recap-item" style={rowStyle}>
                    {rowContent}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Honest empty state (no fabricated activity) ────────────── */}
          {isEmpty && (
            <div
              style={{
                borderRadius: 18, padding: "22px 18px", marginBottom: 24, textAlign: "center",
                backgroundColor: "var(--cog-cream-light)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <p style={{ fontSize: 15, fontWeight: 500, color: "var(--cog-charcoal)", marginBottom: 4 }}>
                Nothing new since you were last here.
              </p>
              <p style={{ fontSize: 13, color: "var(--cog-warm-gray)", lineHeight: 1.45 }}>
                When your co-writers add ideas, their changes will show up here.
              </p>
            </div>
          )}

          {/* ── Primary CTA (only when there's something to review) ─────── */}
          {!isEmpty && (
            <button
              ref={ctaRef}
              onClick={handleReview}
              style={{
                display: "block",
                width: "100%",
                minHeight: 60,
                borderRadius: 16,
                border: "none",
                backgroundColor: "var(--cog-gold)",
                color: "#fff",
                fontSize: 17,
                fontWeight: 650,
                letterSpacing: "0.01em",
                cursor: "pointer",
                marginBottom: 12,
                transition: "transform 130ms ease, opacity 130ms ease",
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = "scale(0.983)";
                e.currentTarget.style.opacity = "0.9";
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.opacity = "";
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.opacity = "";
              }}
            >
              {ctaLabel}
            </button>
          )}

          {/* Secondary — go to the song (primary action when caught up) */}
          <button
            onClick={onDismiss}
            style={{
              display: "block",
              width: "100%",
              minHeight: 44,
              borderRadius: 12,
              border: "none",
              backgroundColor: "transparent",
              color: "var(--cog-warm-gray)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Open song
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
        @keyframes cog-item-rise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cog-skeleton-pulse {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 0.85; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cog-recap-backdrop,
          .cog-recap-sheet {
            animation: none !important;
          }
          .cog-recap-item {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default WhatChangedRecapSheet;
