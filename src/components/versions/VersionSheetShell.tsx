import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Shared bottom-sheet shell for the version surfaces (detail / save / restore
 * confirm). Visual language follows the canvas sheets (CompareModeSheet):
 * cream sheet, 28px top radius, grabber, rise animation — but with a REAL
 * focus trap: focus moves in on open, Tab cycles inside, Escape dismisses,
 * and focus returns to the opener on close. Reduced-motion disables the rise.
 */

interface VersionSheetShellProps {
  ariaLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** Hide the corner close button (confirm sheets supply their own "Not now"). */
  hideClose?: boolean;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const VersionSheetShell = ({ ariaLabel, onClose, children, hideClose }: VersionSheetShellProps) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    // Move focus in: first focusable, else the sheet itself.
    const first = sheet?.querySelector<HTMLElement>(FOCUSABLE);
    window.setTimeout(() => (first ?? sheet)?.focus(), 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === firstEl || !sheet.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      openerRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="cog-vsheet-backdrop"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(28, 26, 23, 0.48)",
          zIndex: 60,
          animation: "cog-vsheet-fade 200ms ease forwards",
        }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="cog-vsheet"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 61,
          maxWidth: "var(--max-w-app, 430px)",
          marginInline: "auto",
          backgroundColor: "var(--cog-cream)",
          borderRadius: "28px 28px 0 0",
          paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
          animation: "cog-vsheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
          maxHeight: "85dvh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          outline: "none",
        }}
      >
        {/* Grabber */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, marginBottom: 4 }}>
          <div
            aria-hidden="true"
            style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.12)" }}
          />
        </div>

        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 14,
              right: 16,
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
            }}
          >
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        {children}
      </div>

      <style>{`
        @keyframes cog-vsheet-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cog-vsheet-rise { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .cog-vsheet, .cog-vsheet-backdrop { animation: none !important; }
        }
      `}</style>
    </>
  );
};

export default VersionSheetShell;
