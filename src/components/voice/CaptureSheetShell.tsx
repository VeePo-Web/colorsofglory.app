import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface CaptureSheetShellProps {
  ariaLabel: string;
  onBackdropClick?: () => void;
  minHeight?: number;
  /**
   * A short human status ("Recording", "Saving your idea") announced politely to
   * screen readers whenever it changes. The visual UI already shows this; the
   * live region makes the capture lifecycle perceivable without sight.
   */
  liveStatus?: string;
  children: ReactNode;
}

const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/** Live subscription to the user's reduced-motion preference. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * How many px the on-screen keyboard overlaps the bottom of the viewport. On iOS
 * Safari the software keyboard covers a bottom-pinned sheet with no reflow —
 * hiding Save/Discard/name fields behind it. Every capture sheet composes this
 * shell, so tracking the inset here fixes the whole lane (record · review ·
 * global capture · pickers) in one place, the DRY root-cause way.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(gap > 24 ? gap : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * CaptureSheetShell — the shared bottom-sheet chrome for every capture surface
 * (record · global capture · review). Owns the frosted charcoal scrim, the
 * rounded cream sheet, the grab handle, the slide-up motion, and the safe-area
 * padding — all on COG tokens. The three capture sheets compose this instead of
 * each re-declaring ~40 lines of identical inline styling, so they stay visually
 * identical by construction and recolor with the design system, not by hand.
 */
const CaptureSheetShell = ({ ariaLabel, onBackdropClick, minHeight, liveStatus, children }: CaptureSheetShellProps) => {
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const kbInset = useKeyboardInset();

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Reduced motion: cross-fade the sheet in place instead of sliding it up from
  // the bottom — the design-bible-sanctioned alternative for vestibular safety.
  const sheetMotion: CSSProperties = reducedMotion
    ? { opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }
    : {
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
      };

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
          // The sheet is pinned to the screen bottom, so adding the keyboard
          // inset to the bottom padding grows it UPWARD — lifting the name field
          // and Save/Discard clear of the keyboard. When lifted, cap to the
          // viewport and scroll so nothing at the top ever clips.
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 24px + ${kbInset}px)`,
          ...(kbInset > 0
            ? { maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - 8px)", overflowY: "auto" as const }
            : {}),
          ...sheetMotion,
          // Combine the sheet's own open/close motion with a gentle padding
          // slide so the keyboard lift eases in (declared AFTER sheetMotion so it
          // extends, not drops, that transition).
          transition: `${sheetMotion.transition}, padding-bottom 180ms ease`,
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
        {/* Polite SR announcement of the capture lifecycle (recording → saving →
            saved). Visually hidden; the sighted UI already conveys this. */}
        <div role="status" aria-live="polite" style={SR_ONLY}>
          {liveStatus ?? ""}
        </div>
        {children}
      </div>
    </>
  );
};

export default CaptureSheetShell;
