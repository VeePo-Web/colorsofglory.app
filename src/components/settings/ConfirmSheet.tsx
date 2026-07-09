import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmSheetProps {
  ariaLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Focus-trapped bottom sheet for settings confirms (cancel plan, sign out
 * everywhere, delete account). Escape closes; tab cycles inside; focus
 * returns to the opener on close. Slide-up entrance, static under
 * prefers-reduced-motion.
 */
const ConfirmSheet = ({ ariaLabel, onClose, children }: ConfirmSheetProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const focusables = () =>
      Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  // zIndex 600: above BottomNav (500) — a confirm must never sit under the nav.
  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 600 }} role="presentation">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: "rgba(28,26,23,0.35)" }}
        tabIndex={-1}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="cog-confirm-sheet relative w-full"
        style={{
          maxWidth: "var(--max-w-app)",
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--cog-border)",
          borderBottom: "none",
          boxShadow: "0 -8px 40px rgba(28,26,23,0.18)",
          padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
      <style>{`
        .cog-confirm-sheet { animation: cog-sheet-up 250ms var(--cog-ease-reveal, ease-out); }
        @keyframes cog-sheet-up {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cog-confirm-sheet { animation: none; }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default ConfirmSheet;
