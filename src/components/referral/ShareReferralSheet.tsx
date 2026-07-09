import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchReferralStats } from "@/lib/pricing/pricingApi";
import { copyTextToClipboard } from "@/lib/invite/clipboard";
import { REFERRAL_SHARE_MESSAGE, shareReferralLink } from "./shareReferral";

/**
 * ShareReferralSheet — the ONE share surface for the referral loop.
 *
 * Both the dashboard (/settings/referral) and every in-song ReferralPrompt
 * open this sheet, so the message, the link, and the tone never diverge.
 * Native share sheet first, graceful copy fallback, and the message is shown
 * so the sender knows exactly what their friend receives.
 */
interface ShareReferralSheetProps {
  open: boolean;
  onClose: () => void;
  /** Pass the link when the caller already has it (dashboard); otherwise the sheet loads it. */
  link?: string | null;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ShareReferralSheet = ({ open, onClose, link }: ShareReferralSheetProps) => {
  const [visible, setVisible] = useState(false);
  const [loadedLink, setLoadedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reduceMotion = useMemo(prefersReducedMotion, []);

  const shareLink = link ?? loadedLink;

  useEffect(() => {
    if (!open) { setVisible(false); return; }
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Self-load the link only when the caller didn't provide one (in-song prompts).
  useEffect(() => {
    if (!open || link != null || loadedLink) return;
    let active = true;
    fetchReferralStats()
      .then((stats) => { if (active) setLoadedLink(stats.link); })
      .catch(() => {/* keep null — share falls back to the app URL */});
    return () => { active = false; };
  }, [open, link, loadedLink]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleShare = async () => {
    const outcome = await shareReferralLink(shareLink);
    if (outcome === "copied") toast.success("Invite copied — paste it anywhere");
    if (outcome === "failed") toast.error("Couldn't share. Try copying the link.");
    if (outcome === "shared" || outcome === "copied") onClose();
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(shareLink ?? "https://colorsofglory.app");
    if (!ok) { toast.error("Couldn't copy the link"); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 899,
          backgroundColor: "rgba(26,26,23,0.5)",
          opacity: visible ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 240ms ease",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share your referral link"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 900,
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          padding: "0 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "85dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: reduceMotion ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "var(--cog-muted)", margin: "12px auto" }} aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 14, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "rgba(28,26,23,0.05)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cog-warm-gray)",
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h2
          style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--cog-charcoal)", margin: "6px 4px 4px" }}
        >
          Invite a songwriter
        </h2>
        <p style={{ fontSize: 14, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", margin: "0 4px 16px", lineHeight: 1.5 }}>
          Their first song is free. You earn a little each month if they go Pro.
        </p>

        {/* The exact message that travels with the link — no surprises */}
        <div
          style={{
            backgroundColor: "var(--cog-cream)",
            border: "1px solid var(--cog-border)",
            borderRadius: 14,
            padding: "12px 14px",
            margin: "0 0 12px",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--cog-charcoal)", fontFamily: "var(--font-body)", lineHeight: 1.55, margin: 0 }}>
            {REFERRAL_SHARE_MESSAGE}
          </p>
          <p
            style={{ fontSize: 12.5, color: "var(--cog-gold)", fontFamily: "monospace", margin: "8px 0 0", wordBreak: "break-all" }}
          >
            {shareLink ?? "colorsofglory.app/r/…"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Share2 size={17} strokeWidth={1.8} /> Share invite
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3.5 mt-2 rounded-2xl text-sm font-medium transition-opacity hover:opacity-70"
          style={{
            color: copied ? "#53AB8B" : "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {copied ? <><Check size={15} strokeWidth={2} /> Copied!</> : <><Copy size={15} strokeWidth={1.8} /> Copy link instead</>}
        </button>
      </div>
    </>
  );
};

export default ShareReferralSheet;
