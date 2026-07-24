import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

export interface CardAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** "gold" tints the row as the accented choice; "muted" for low-emphasis. */
  tone?: "gold" | "muted";
  active?: boolean;
}

interface CardActionsSheetProps {
  title: string;
  subtitle?: string;
  actions: CardAction[];
  onClose: () => void;
}

/**
 * CardActionsSheet — the card's overflow menu.
 *
 * The canvas card used to carry a wall of tiny buttons. Now it shows a primary
 * action and a "⋯"; everything else lives here as a calm, clearly-labelled
 * list (CapCut/Apple "tap → bottom sheet" pattern). Safe-area aware,
 * Escape/backdrop close, reduced-motion safe.
 */
const CardActionsSheet = ({ title, subtitle, actions, onClose }: CardActionsSheetProps) => {
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Modal a11y — aria-modal hides the rest of the board from screen readers, so
  // focus must move INTO the sheet on open (leaving it on the now-hidden card
  // strands an SR user), Tab is trapped inside, Escape closes, and focus returns
  // to the card on close. The proven in-repo dialog pattern (LineLabSheet).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.5)",
          opacity: visible ? 1 : 0, transition: "opacity 240ms ease",
        }}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${title}`}
        tabIndex={-1}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
          outline: "none",
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "0 16px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          maxHeight: "80dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "#CCC", margin: "12px auto 12px" }} aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 12, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#666",
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div style={{ padding: "0 6px 6px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--cog-charcoal)", lineHeight: 1.25 }}>
            {title}
          </p>
          {subtitle && (
            <p style={{ fontSize: 12, color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginTop: 2 }}>{subtitle}</p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { a.onClick(); onClose(); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                minHeight: 52, padding: "0 16px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                backgroundColor: a.tone === "gold" ? "rgba(184,149,58,0.10)" : "#FFFFFF",
                border: a.active
                  ? "1.5px solid var(--cog-gold)"
                  : "1.5px solid rgba(0,0,0,0.07)",
                color: a.tone === "gold" ? "var(--cog-gold)" : a.tone === "muted" ? "var(--cog-warm-gray)" : "var(--cog-charcoal)",
                fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600,
              }}
            >
              {a.icon && <span aria-hidden="true" style={{ display: "flex", flexShrink: 0 }}>{a.icon}</span>}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default CardActionsSheet;
