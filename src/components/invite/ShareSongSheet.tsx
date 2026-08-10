import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { generateInviteToken, updateOnboardingStep, type GeneratedInvite } from "@/lib/invite/inviteApi";
import { copyTextToClipboard } from "@/lib/invite/clipboard";
import { triggerReferralPrompt } from "@/components/referral/referralPromptState";
import type { SongCollaborator } from "@/lib/invite/useSongCollaborators";

type InviteRole = "contributor" | "viewer";

const ROLE_COPY: Record<InviteRole, { label: string; hint: string }> = {
  contributor: { label: "Can contribute", hint: "Anyone with this link can add lyrics, memos, and ideas." },
  viewer: { label: "Can listen", hint: "Anyone with this link can listen and read." },
};

const SENT_DISMISS_MS = 2400;

interface ShareSongSheetProps {
  songId: string;
  songTitle: string;
  collaborators: SongCollaborator[];
  onClose: () => void;
  /** userIds live in the room right now (green "here now" dot) — the reliable identity. */
  presentUserIds?: Set<string>;
  /** Lowercased display names live right now — fallback while a roster row's id resolves. */
  presentNames?: Set<string>;
}

/**
 * ShareSongSheet — the app's ONE invite surface (canvas header, People layer,
 * People page — every door opens this same sheet).
 *
 * One hero act: on phones with the native share sheet, "Send the link" (which
 * itself offers Messages / WhatsApp / copy); elsewhere, "Copy invite link".
 * The link for the default role is generated the moment the sheet opens, so
 * the hero tap stays synchronous inside the gesture (iOS Safari clipboard
 * guard). Links are cached per role — flipping Contribute/Listen never mints
 * duplicates, and re-opening the sheet reuses the song's standing link.
 *
 * After the act completes, the sheet says the one true thing — "The door is
 * open. Keep writing — you'll hear when they arrive." — and leaves.
 */
const ShareSongSheet = ({ songId, songTitle, collaborators, onClose, presentUserIds, presentNames }: ShareSongSheetProps) => {
  const isHereNow = (c: SongCollaborator) => {
    if (presentUserIds?.has(c.userId)) return true;
    if (!presentNames || presentNames.size === 0) return false;
    const full = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
    return presentNames.has(full) || presentNames.has(c.firstName.toLowerCase());
  };
  const reduceMotion =
    typeof window !== "undefined" && !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [visible, setVisible] = useState(reduceMotion);
  const [role, setRole] = useState<InviteRole>("contributor");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inviteCache = useRef<Partial<Record<InviteRole, GeneratedInvite>>>({});
  const pending = useRef<Partial<Record<InviteRole, Promise<GeneratedInvite>>>>({});
  const [, forceRender] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduceMotion) return;
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [reduceMotion]);

  // Move focus into the dialog on open; hand it back on close (VoiceOver /
  // keyboard users otherwise stay stranded behind the overlay).
  useEffect(() => {
    openerRef.current = document.activeElement;
    sheetRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      // Keep Tab inside the dialog — a light trap over the sheet's controls.
      if (e.key === "Tab" && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        // Focus escaped the dialog (e.g. the focused button unmounted on a
        // state swap and focus fell to <body>)? Pull Tab back inside instead
        // of letting it walk the canvas behind an aria-modal overlay.
        if (!sheetRef.current.contains(active)) {
          e.preventDefault(); first.focus(); return;
        }
        if (e.shiftKey && (active === first || active === sheetRef.current)) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The sent-state swap unmounts whichever button was focused — re-anchor
  // focus on the dialog so keyboard/VoiceOver users aren't dropped to <body>.
  useEffect(() => {
    if (sent) sheetRef.current?.focus();
  }, [sent]);

  useEffect(() => () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  }, []);

  const ensureInvite = useCallback((forRole: InviteRole): Promise<GeneratedInvite> => {
    const cached = inviteCache.current[forRole];
    if (cached) return Promise.resolve(cached);
    const inFlight = pending.current[forRole];
    if (inFlight) return inFlight;
    const p = generateInviteToken(songId, forRole, 10)
      .then((invite) => {
        inviteCache.current[forRole] = invite;
        pending.current[forRole] = undefined;
        forceRender((n) => n + 1);
        return invite;
      })
      .catch((err) => {
        pending.current[forRole] = undefined;
        throw err;
      });
    pending.current[forRole] = p;
    return p;
  }, [songId]);

  // Pre-generate the default link the moment the sheet opens.
  useEffect(() => {
    ensureInvite("contributor").catch(() => {
      setError("Couldn't create the link. Check your connection and try again.");
    });
  }, [ensureInvite]);

  const readyInvite = inviteCache.current[role];

  // The act completed — say the true thing, then get out of the way.
  const markSent = useCallback(() => {
    setSent(true);
    updateOnboardingStep("first_collaborator_invited").catch(() => {});
    triggerReferralPrompt("invite_sent", songId);
    // Auto-dismiss back to the song. Reduced-motion users are never whisked
    // away on a timer — they close when they're ready.
    if (!reduceMotion && !dismissTimer.current) {
      dismissTimer.current = setTimeout(onClose, SENT_DISMISS_MS);
    }
  }, [onClose, reduceMotion, songId]);

  const reportCopy = useCallback((ok: boolean) => {
    if (!ok) { setError("Couldn't copy — press and hold the link below to copy it."); return; }
    setCopied(true);
    markSent();
  }, [markSent]);

  const handleCopy = () => {
    setError(null);
    // Safari expires the tap gesture after any await — so when the link is
    // already pre-generated (the normal case), start the clipboard write
    // synchronously inside the tap. The async path only runs on a cold start.
    const cached = inviteCache.current[role];
    if (cached) {
      void copyTextToClipboard(cached.inviteUrl).then(reportCopy);
      return;
    }
    ensureInvite(role)
      .then((invite) => copyTextToClipboard(invite.inviteUrl))
      .then(reportCopy)
      .catch(() => setError("Couldn't create the link. Check your connection and try again."));
  };

  const shareInvite = useCallback((invite: GeneratedInvite) => {
    navigator
      .share({
        title: `Join "${songTitle}" on Colors of Glory`,
        text: `I'm writing "${songTitle}" and want you in the room.`,
        url: invite.inviteUrl,
      })
      .then(() => markSent())
      .catch(() => { /* share sheet dismissed — nothing to report */ });
  }, [songTitle, markSent]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // ONE hero act: native share where it exists (it already offers Messages,
  // WhatsApp, and copy), the clipboard everywhere else.
  const handleHero = () => {
    setError(null);
    if (!canShare) { handleCopy(); return; }
    const cached = inviteCache.current[role];
    if (cached) { shareInvite(cached); return; }
    ensureInvite(role)
      .then(shareInvite)
      .catch(() => setError("Couldn't create the link. Check your connection and try again."));
  };

  const sheetTransition = reduceMotion
    ? "none"
    : "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 280ms ease",
        }}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Invite into ${songTitle}`}
        tabIndex={-1}
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 800,
          backgroundColor: "var(--cog-cream-light)",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid var(--cog-border)",
          boxShadow: "0 -24px 60px rgba(28,26,23,0.20)",
          padding: "0 20px",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          maxHeight: "85dvh", overflowY: "auto",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: sheetTransition,
          maxWidth: 480, margin: "0 auto",
          outline: "none",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "var(--cog-border)", margin: "12px auto 14px" }} aria-hidden="true" />
        {/* Persistent live region — mounted OUTSIDE the sent/compose branches
            so the announcement survives the DOM swap (a region that mounts
            WITH its text, or unmounts in the same batch, never announces). */}
        <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {sent ? "The door is open — invite link shared. Keep writing; you'll hear when they arrive." : copied ? "Invite link copied to clipboard" : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 16, width: 44, height: 44, borderRadius: "50%",
            backgroundColor: "var(--cog-cream-dark)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "var(--cog-warm-gray)",
          }}
          aria-label="Close invite sheet"
        >
          <X size={18} />
        </button>

        {sent ? (
          /* ── The door is open — the calm sent-state, then back to writing ──
                (announced by the persistent live region above, which outlives
                this branch swap) ── */
          <div style={{ textAlign: "center", padding: "18px 0 10px" }}>
            <div
              style={{
                width: 56, height: 56, margin: "0 auto 14px", borderRadius: "50%",
                backgroundColor: "rgba(83,171,139,0.12)", border: "1.5px solid rgba(83,171,139,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              aria-hidden="true"
            >
              <Check size={24} strokeWidth={2} style={{ color: "#53AB8B" }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--cog-charcoal)", marginBottom: 6 }}>
              The door is open.
            </h2>
            <p style={{ fontSize: 14, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", marginBottom: 4 }}>
              Keep writing — you'll hear when they arrive.
            </p>
            {reduceMotion && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  marginTop: 10, minHeight: 44, padding: "0 20px", borderRadius: 14,
                  backgroundColor: "var(--cog-cream-dark)", border: "1px solid var(--cog-border)",
                  color: "var(--cog-charcoal)", fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back to the song
              </button>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", marginBottom: 2 }}>
              Invite into this song
            </h2>
            <p style={{ fontSize: 13, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
              One link opens the room — send it anywhere.
            </p>

            {/* Role toggle — the link's permission, one defaulted decision */}
            <div role="radiogroup" aria-label="What can people with the link do?" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {(["contributor", "viewer"] as InviteRole[]).map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setRole(r); setCopied(false); setError(null); void ensureInvite(r).catch(() => {}); }}
                    className="cog-press"
                    style={{
                      flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer",
                      backgroundColor: active ? "var(--cog-gold-glow)" : "#FFFFFF",
                      border: active ? "1.5px solid var(--cog-gold)" : "1.5px solid var(--cog-border)",
                      color: active ? "var(--cog-gold)" : "var(--cog-warm-gray)",
                      fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                      transition: reduceMotion ? "none" : "all 150ms ease",
                    }}
                  >
                    {ROLE_COPY[r].label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
              {ROLE_COPY[role].hint}
            </p>

            {/* THE one bold act */}
            <button
              type="button"
              onClick={handleHero}
              className="cog-press"
              style={{
                width: "100%", minHeight: 56, borderRadius: 16, border: "none", cursor: "pointer",
                backgroundColor: "var(--cog-gold)", color: "#FFFFFF",
                fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
              }}
            >
              {canShare
                ? <><Share2 size={18} strokeWidth={1.8} /> Send the link</>
                : <><Copy size={18} strokeWidth={1.8} /> Copy invite link</>}
            </button>

            {/* The link itself — the quiet always-there fallback: tap to copy,
                selectable for a manual long-press copy too. */}
            <button
              type="button"
              onClick={readyInvite ? handleCopy : undefined}
              disabled={!readyInvite}
              aria-label={readyInvite ? "Copy invite link" : "Creating your link"}
              className="cog-press"
              style={{
                width: "100%", marginTop: 12, borderRadius: 12, padding: "12px 12px", minHeight: 44,
                backgroundColor: "var(--cog-cream-dark)", border: "1px solid var(--cog-border)",
                display: "flex", alignItems: "center", gap: 8, textAlign: "left",
                cursor: readyInvite ? "pointer" : "default",
              }}
            >
              <Link2 size={14} strokeWidth={1.8} style={{ color: "var(--cog-muted)", flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "monospace", overflowWrap: "anywhere", userSelect: "all", minWidth: 0 }}>
                {readyInvite
                  ? readyInvite.inviteUrl
                  : error ? "No link yet — tap above to try again" : "Creating your link…"}
              </span>
              {readyInvite && (
                copied
                  ? <Check size={14} strokeWidth={2.2} style={{ color: "var(--cog-gold)", flexShrink: 0 }} aria-hidden="true" />
                  : <Copy size={14} strokeWidth={1.8} style={{ color: "var(--cog-muted)", flexShrink: 0 }} aria-hidden="true" />
              )}
            </button>

            {error && (
              <p role="alert" style={{ fontSize: 13, color: "#B4543F", fontFamily: "var(--font-body)", marginTop: 10, textAlign: "center" }}>
                {error}
              </p>
            )}
          </>
        )}

        {/* Who's already in the room — quiet context, not controls */}
        {collaborators.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
              In this room
            </p>
            {collaborators.map((c) => {
              const hereNow = isHereNow(c);
              return (
                <div key={c.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cog-border)" }}>
                  <span style={{ position: "relative", flexShrink: 0 }}>
                    <span
                      style={{
                        width: 34, height: 34, borderRadius: "50%", backgroundColor: c.avatarColor,
                        color: "#FFF", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      aria-hidden="true"
                    >
                      {c.avatarInitials}
                    </span>
                    {hereNow && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute", bottom: -1, right: -1, width: 11, height: 11,
                          borderRadius: "50%", backgroundColor: "#53AB8B", border: "2px solid var(--cog-cream-light)",
                        }}
                      />
                    )}
                  </span>
                  <p style={{ flex: 1, textAlign: "left", fontSize: 14, fontWeight: 600, color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    {c.firstName} {c.lastName}
                  </p>
                  <p style={{ fontSize: 12, color: hereNow ? "#53AB8B" : "var(--cog-muted)", fontWeight: hereNow ? 600 : 400, fontFamily: "var(--font-body)" }}>
                    {hereNow ? "Here now" : c.role}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--cog-muted)", fontFamily: "var(--font-body)", textAlign: "center", marginTop: 14 }}>
          Joining a song never uses anyone's free song.
        </p>
      </div>
    </>
  );
};

export default ShareSongSheet;
