import { useEffect, useState, type ReactNode } from "react";

interface CaptureSheetShellProps {
  ariaLabel: string;
  onBackdropClick?: () => void;
  minHeight?: number;
  children: ReactNode;
}

/**
 * CaptureSheetShell — the shared bottom-sheet chrome for every capture surface
 * (record · global capture · review). Owns the frosted charcoal scrim, the
 * rounded cream sheet, the grab handle, the slide-up motion, and the safe-area
 * padding — all on COG tokens. The three capture sheets compose this instead of
 * each re-declaring ~40 lines of identical inline styling, so they stay visually
 * identical by construction and recolor with the design system, not by hand.
 */
const CaptureSheetShell = ({ ariaLabel, onBackdropClick, minHeight, children }: CaptureSheetShellProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <>
      {/* Frosted charcoal scrim */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(28,26,23,0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        onClick={onBackdropClick}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 800,
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          ...(minHeight ? { minHeight } : {}),
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 9999,
            backgroundColor: "var(--cog-border-light)",
            margin: "12px auto 0",
          }}
          aria-hidden="true"
        />
        {children}
      </div>
    </>
  );
};

export default CaptureSheetShell;
