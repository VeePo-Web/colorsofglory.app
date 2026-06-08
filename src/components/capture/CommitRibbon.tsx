import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

interface CommitRibbonProps {
  open: boolean;
  blockCount: number;
  songTitle?: string;
  onOpenCanvas: () => void;
  onDismiss: () => void;
  /** Auto-dismiss after N ms. Default 3500. */
  autoDismissMs?: number;
}

/**
 * Post-commit success ribbon — replaces the chained
 * toast+modal+navigation that used to happen after `Add to canvas`.
 *
 * Quiet gold bar at the bottom of the screen, single tap → deep-links to
 * `/songs/:id/canvas?from=capture` where the new nodes pulse for the user.
 */
const CommitRibbon = ({
  open,
  blockCount,
  songTitle,
  onOpenCanvas,
  onDismiss,
  autoDismissMs = 3500,
}: CommitRibbonProps) => {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [open, autoDismissMs, onDismiss]);

  if (!open) return null;

  return (
    <button
      type="button"
      onClick={onOpenCanvas}
      aria-label="Open canvas to see the new cards"
      className="fixed left-1/2 transition-all active:scale-[0.98]"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 20px)",
        transform: "translateX(-50%)",
        zIndex: 60,
        padding: "12px 18px",
        borderRadius: 999,
        background: "var(--cog-gold)",
        color: "var(--cog-cream-light, #faf7f2)",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 14px 36px rgba(184,149,58,0.42)",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-body)",
        fontSize: 14,
        fontWeight: 600,
        animation: "cog-ribbon-rise 320ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1))",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {blockCount} {blockCount === 1 ? "card" : "cards"} added
        {songTitle ? ` to ${songTitle}` : ""}
      </span>
      <ArrowRight size={16} />
      <style>{`
        @keyframes cog-ribbon-rise {
          from { opacity: 0; transform: translate(-50%, 16px); }
          to   { opacity: 1; transform: translate(-50%, 0);    }
        }
      `}</style>
    </button>
  );
};

export default CommitRibbon;