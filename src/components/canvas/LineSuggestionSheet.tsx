import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * LineSuggestionSheet — F19 line-level suggestion overlay.
 *
 * "create" mode: contributor proposes a replacement for one lyric line.
 * "review"  mode: owner sees the proposed line and chooses Accept or Keep Original.
 *
 * The original line is always shown so context is preserved.
 * iOS-safe: Escape listener, idempotency refs, offline guard, sent-pop confirmation.
 */

export type LineSuggestionMode = "create" | "review";

interface LineSuggestionSheetProps {
  mode: LineSuggestionMode;
  originalLine: string;
  proposedLine?: string;
  sectionLabel: string;
  contributorName?: string;
  onSend?: (suggestionText: string) => void;
  onAccept?: () => void;
  onKeep?: () => void;
  onDismiss: () => void;
}

const MAX_CHARS = 280;

const LineSuggestionSheet = ({
  mode,
  originalLine,
  proposedLine,
  sectionLabel,
  contributorName,
  onSend,
  onAccept,
  onKeep,
  onDismiss,
}: LineSuggestionSheetProps) => {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "offline">("idle");
  const didSubmit = useRef(false);
  const didDismiss = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount (create mode)
  useEffect(() => {
    if (mode === "create") {
      const t = setTimeout(() => textareaRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [mode]);

  // Escape dismisses
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleDismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    if (didDismiss.current) return;
    didDismiss.current = true;
    onDismiss();
  };

  const handleSend = () => {
    if (didSubmit.current || !draft.trim() || status !== "idle") return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    didSubmit.current = true;
    setStatus("sending");
    setTimeout(() => {
      setStatus("sent");
      onSend?.(draft.trim());
      setTimeout(handleDismiss, 820);
    }, 200);
  };

  const handleAccept = () => {
    if (didSubmit.current) return;
    didSubmit.current = true;
    onAccept?.();
    handleDismiss();
  };

  const handleKeep = () => {
    onKeep?.();
    handleDismiss();
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const charsLeft = MAX_CHARS - draft.length;
  const isOverLimit = charsLeft < 0;
  const showCounter = charsLeft < 60;

  /* ── Sent confirmation ─────────────────────────────────────────── */
  if (status === "sent") {
    return (
      <>
        <div
          aria-hidden="true"
          onClick={handleDismiss}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.36)", zIndex: 799, animation: "cog-fade-in 200ms ease both" }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Suggestion sent"
          style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 800,
            backgroundColor: "var(--cog-cream-light)",
            borderRadius: "20px 20px 0 0",
            padding: "40px 24px",
            paddingBottom: "max(40px, env(safe-area-inset-bottom, 24px))",
            display: "flex", flexDirection: "column", alignItems: "center",
            animation: "cog-ls-sent-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(184,149,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cog-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "1.0625rem", fontWeight: 600, color: "var(--cog-charcoal)", textAlign: "center" }}>
            Suggestion sent
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-warm-gray)", textAlign: "center", marginTop: 4 }}>
            The owner will review your idea.
          </p>
        </div>
        <style>{ANIM_STYLES}</style>
      </>
    );
  }

  /* ── Main sheet ────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleDismiss}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.36)", zIndex: 799, animation: "cog-fade-in 200ms ease both" }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Suggest a line change" : "Review line suggestion"}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 800,
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "90dvh",
          display: "flex", flexDirection: "column",
          animation: "cog-sheet-rise 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 20px 12px", flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--cog-gold)", marginBottom: 3 }}>
              {sectionLabel}
            </p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.125rem", fontWeight: 700, color: "var(--cog-charcoal)", margin: 0 }}>
              {mode === "create" ? "Suggest a line" : "Review suggestion"}
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cog-warm-gray)", flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 4px" }}>
          {/* Original line */}
          <div style={{ backgroundColor: "rgba(0,0,0,0.04)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--cog-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Original line
            </p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "var(--cog-charcoal)", lineHeight: 1.55, margin: 0 }}>
              {originalLine}
            </p>
          </div>

          {/* CREATE: text input */}
          {mode === "create" && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--cog-warm-gray)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Your suggestion
              </p>
              <div style={{ position: "relative" }}>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS + 10) {
                      setDraft(e.target.value);
                      autoResize(e.target);
                    }
                    if (status === "offline") setStatus("idle");
                  }}
                  placeholder="Write an alternative lyric line…"
                  rows={2}
                  // A lyric is not prose — turn off autocorrect/spellcheck so the
                  // songwriter's exact words (and deliberate non-words) survive.
                  autoCapitalize="sentences"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  style={{
                    width: "100%",
                    border: isOverLimit ? "1.5px solid rgba(224,84,64,0.6)" : "1.5px solid var(--cog-border-gold)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    paddingBottom: showCounter ? 28 : 12,
                    fontFamily: "var(--font-display)",
                    fontSize: "1rem",
                    lineHeight: 1.55,
                    color: "var(--cog-charcoal)",
                    backgroundColor: "var(--cog-cream)",
                    resize: "none",
                    outline: "none",
                    boxSizing: "border-box",
                    caretColor: "var(--cog-gold)",
                    minHeight: 60,
                    overflow: "hidden",
                  }}
                  aria-label="Suggested lyric line"
                />
                {showCounter && (
                  <span style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "var(--font-body)", fontSize: "0.75rem", color: charsLeft < 20 ? "#E05440" : "var(--cog-muted)" }}>
                    {charsLeft}
                  </span>
                )}
              </div>
              {status === "offline" && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#E05440", marginTop: 6 }} role="alert" aria-live="polite">
                  You're offline — reconnect to send.
                </p>
              )}
            </div>
          )}

          {/* REVIEW: proposed line */}
          {mode === "review" && proposedLine && (
            <div style={{ backgroundColor: "rgba(184,149,58,0.08)", border: "1.5px solid rgba(184,149,58,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--cog-gold)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {contributorName ? `${contributorName}'s suggestion` : "Suggested line"}
              </p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1rem", color: "var(--cog-charcoal)", lineHeight: 1.55, margin: 0 }}>
                {proposedLine}
              </p>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div style={{ padding: "12px 20px", paddingBottom: "max(20px, env(safe-area-inset-bottom, 12px))", borderTop: "1px solid var(--cog-border)", flexShrink: 0 }}>
          {mode === "create" ? (
            <button
              onClick={handleSend}
              disabled={!draft.trim() || isOverLimit || status !== "idle"}
              style={{
                width: "100%", height: 52, borderRadius: 14,
                backgroundColor: !draft.trim() || isOverLimit || status !== "idle" ? "rgba(184,149,58,0.35)" : "var(--cog-gold)",
                color: "#fff",
                fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700,
                border: "none",
                cursor: !draft.trim() || isOverLimit || status !== "idle" ? "not-allowed" : "pointer",
                transition: "background-color 150ms, transform 90ms",
              }}
              onPointerDown={(e) => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
              onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              aria-label="Send suggestion"
            >
              {status === "sending" ? "Sending…" : "Send suggestion"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleKeep}
                style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.05)", color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 600, border: "1px solid var(--cog-border)", cursor: "pointer" }}
                aria-label="Keep original line"
              >
                Keep original
              </button>
              <button
                onClick={handleAccept}
                style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)", fontSize: "1rem", fontWeight: 700, border: "none", cursor: "pointer" }}
                aria-label="Accept suggested line"
              >
                Accept line
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{ANIM_STYLES}</style>
    </>
  );
};

const ANIM_STYLES = `
  @keyframes cog-ls-sent-pop {
    0%   { opacity: 0; transform: scale(0.92) translateY(12px); }
    100% { opacity: 1; transform: scale(1)    translateY(0);    }
  }
  @media (prefers-reduced-motion: reduce) {
    [style*="cog-fade-in"],
    [style*="cog-sheet-rise"],
    [style*="cog-ls-sent-pop"] {
      animation: none !important;
    }
  }
`;

export default LineSuggestionSheet;
