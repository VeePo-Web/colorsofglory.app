import { useEffect, useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import type { ReferralMoment } from "./referralPromptState";

/**
 * ReferralPrompt — the calm in-song referral nudge (Product Vision 14).
 *
 * A small bottom-anchored card, never a modal: it doesn't dim the screen,
 * doesn't trap focus, and never blocks what the songwriter was doing. One warm
 * line per collaboration moment, one gold share action, an easy "Not now",
 * and a permanent "Don't show this again". Presentational only — the caps and
 * trigger logic live in referralPromptState / ReferralPromptHost.
 */
interface ReferralPromptProps {
  moment: ReferralMoment;
  onShare: () => void;
  onDismiss: () => void;
  onOptOut: () => void;
}

const MOMENT_COPY: Record<ReferralMoment, { title: string; body: string }> = {
  invite_sent: {
    title: "Songs are better together",
    body: "Know another songwriter? Share your link — their first song is free.",
  },
  collaborator_joined: {
    title: "Your song room is growing",
    body: "Know someone else who writes? Their first song on Colors of Glory is free.",
  },
  milestone: {
    title: "Worth celebrating",
    body: "Share Colors of Glory with a friend — their first song is free.",
  },
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ReferralPrompt = ({ moment, onShare, onDismiss, onOptOut }: ReferralPromptProps) => {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useMemo(prefersReducedMotion, []);
  const copy = MOMENT_COPY[moment];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      role="complementary"
      aria-label="Invite a friend to Colors of Glory"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
        zIndex: 780, // under sheets/dialogs (799+), above page content
        maxWidth: 430,
        margin: "0 auto",
        backgroundColor: "var(--cog-cream-light)",
        border: "1.5px solid var(--cog-border-gold)",
        borderRadius: 18,
        boxShadow: "0 8px 32px rgba(184,149,58,0.22)",
        padding: "16px 16px 12px",
        opacity: visible ? 1 : 0,
        transform: visible || reduceMotion ? "translateY(0)" : "translateY(12px)",
        transition: reduceMotion ? "none" : "opacity 400ms cubic-bezier(0.22,1,0.36,1), transform 400ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Not now"
        style={{
          position: "absolute", top: 6, right: 6, width: 40, height: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "none", cursor: "pointer", color: "var(--cog-muted)",
        }}
      >
        <X size={16} strokeWidth={2} />
      </button>

      <p
        style={{
          fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600,
          color: "var(--cog-charcoal)", margin: "0 28px 3px 0", lineHeight: 1.3,
        }}
      >
        {copy.title}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 13.5, color: "var(--cog-warm-gray)", margin: "0 0 12px", lineHeight: 1.5 }}>
        {copy.body}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onShare}
          className="transition-all duration-150 active:scale-[0.97]"
          style={{
            flex: 1, height: 44, borderRadius: 12, border: "none", cursor: "pointer",
            backgroundColor: "var(--cog-gold)", color: "#FFFFFF",
            fontFamily: "var(--font-body)", fontSize: 14.5, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}
        >
          <Share2 size={15} strokeWidth={1.8} /> Share your link
        </button>
        <button
          type="button"
          onClick={onOptOut}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 6px",
            fontFamily: "var(--font-body)", fontSize: 12, color: "var(--cog-muted)",
          }}
        >
          Don't show again
        </button>
      </div>
    </div>
  );
};

export default ReferralPrompt;
