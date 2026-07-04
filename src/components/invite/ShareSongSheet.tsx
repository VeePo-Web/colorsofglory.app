import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { generateInviteToken, updateOnboardingStep, type GeneratedInvite } from "@/lib/invite/inviteApi";
import { copyTextToClipboard } from "@/lib/invite/clipboard";
import type { SongCollaborator } from "@/lib/invite/useSongCollaborators";

type InviteRole = "contributor" | "viewer";

const ROLE_COPY: Record<InviteRole, { label: string; hint: string }> = {
  contributor: { label: "Can contribute", hint: "Anyone with this link can add lyrics, memos, and ideas." },
  viewer: { label: "Can listen", hint: "Anyone with this link can listen and read." },
};

interface ShareSongSheetProps {
  songId: string;
  songTitle: string;
  collaborators: SongCollaborator[];
  onClose: () => void;
  /** Fly the canvas to this person's latest idea (Freeform "jump to their spot"). */
  onJumpTo?: (person: SongCollaborator) => void;
  /** Lowercased names of people live in the room right now (green "here now" dot). */
  presentNames?: Set<string>;
}

/**
 * ShareSongSheet — the canvas's one-tap invite surface.
 *
 * Copy-link-first (the Figma/Notion share hierarchy): the link for the default
 * role is generated the moment the sheet opens, so "Copy invite link" is
 * instant and the clipboard write stays inside the tap gesture. Links are
 * cached per role — flipping Contribute/Listen never mints duplicate tokens.
 */
const ShareSongSheet = ({ songId, songTitle, collaborators, onClose, onJumpTo, presentNames }: ShareSongSheetProps) => {
  const isHereNow = (c: SongCollaborator) => {
    if (!presentNames || presentNames.size === 0) return false;
    const full = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
    return presentNames.has(full) || presentNames.has(c.firstName.toLowerCase());
  };
  const [visible, setVisible] = useState(false);
  const [role, setRole] = useState<InviteRole>("contributor");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inviteCache = useRef<Partial<Record<InviteRole, GeneratedInvite>>>({});
  const pending = useRef<Partial<Record<InviteRole, Promise<GeneratedInvite>>>>({});
  const [, forceRender] = useState(0);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  const reportCopy = useCallback((ok: boolean) => {
    if (!ok) { setError("Couldn't copy — press and hold the link below to copy it."); return; }
    setCopied(true);
    updateOnboardingStep("first_collaborator_invited").catch(() => {});
    window.setTimeout(() => setCopied(false), 2200);
  }, []);

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
      .then(() => updateOnboardingStep("first_collaborator_invited").catch(() => {}))
      .catch(() => { /* share sheet dismissed — nothing to report */ });
  }, [songTitle]);

  const handleShare = () => {
    setError(null);
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      handleCopy();
      return;
    }
    // Same gesture rule as copy: share synchronously when the link is cached.
    const cached = inviteCache.current[role];
    if (cached) { shareInvite(cached); return; }
    ensureInvite(role)
      .then(shareInvite)
      .catch(() => setError("Couldn't create the link. Check your connection and try again."));
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.55)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          opacity: visible ? 1 : 0, transition: "opacity 280ms ease",
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Invite into ${songTitle}`}
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
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          maxWidth: 480, margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 9999, backgroundColor: "var(--cog-border)", margin: "12px auto 14px" }} aria-hidden="true" />
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

        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--cog-charcoal)", marginBottom: 2 }}>
          Invite into this song
        </h2>
        <p style={{ fontSize: 13, color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
          Copy one link, send it anywhere — iMessage, WhatsApp, email.
        </p>

        {/* Role toggle — the link's permission, Figma-style */}
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
                style={{
                  flex: 1, minHeight: 48, borderRadius: 14, cursor: "pointer",
                  backgroundColor: active ? "var(--cog-gold-glow)" : "#FFFFFF",
                  border: active ? "1.5px solid var(--cog-gold)" : "1.5px solid var(--cog-border)",
                  color: active ? "var(--cog-gold)" : "var(--cog-warm-gray)",
                  fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                  transition: "all 150ms ease",
                }}
              >
                {ROLE_COPY[r].label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
          {ROLE_COPY[role].hint}
        </p>

        {/* Primary: copy the link */}
        <button
          type="button"
          onClick={handleCopy}
          style={{
            width: "100%", minHeight: 56, borderRadius: 16, border: "none", cursor: "pointer",
            backgroundColor: copied ? "#53AB8B" : "var(--cog-gold)", color: "#FFFFFF",
            fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 6px 18px rgba(184,149,58,0.35)",
            transition: "background-color 200ms ease",
          }}
        >
          {copied ? <><Check size={18} strokeWidth={2.2} /> Link copied — send it anywhere</> : <><Copy size={18} strokeWidth={1.8} /> Copy invite link</>}
        </button>
        <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
          {copied ? "Invite link copied to clipboard" : ""}
        </span>

        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            style={{
              width: "100%", minHeight: 48, borderRadius: 16, marginTop: 10, cursor: "pointer",
              backgroundColor: "#FFFFFF", border: "1.5px solid var(--cog-border)", color: "var(--cog-charcoal)",
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Share2 size={16} strokeWidth={1.8} /> Share…
          </button>
        )}

        {/* The link itself — tap the whole row to copy (Figma/Notion pattern),
            and it stays selectable for a manual long-press copy too. */}
        <button
          type="button"
          onClick={readyInvite ? handleCopy : undefined}
          disabled={!readyInvite}
          aria-label={readyInvite ? "Copy invite link" : "Creating your link"}
          style={{
            width: "100%", marginTop: 12, borderRadius: 12, padding: "10px 12px",
            backgroundColor: "var(--cog-cream-dark)", border: "1px solid var(--cog-border)",
            display: "flex", alignItems: "center", gap: 8, textAlign: "left",
            cursor: readyInvite ? "pointer" : "default",
          }}
        >
          <Link2 size={14} strokeWidth={1.8} style={{ color: "var(--cog-muted)", flexShrink: 0 }} aria-hidden="true" />
          <span style={{ flex: 1, fontSize: 12, color: "var(--cog-warm-gray)", fontFamily: "monospace", overflowWrap: "anywhere", userSelect: "all", minWidth: 0 }}>
            {readyInvite ? readyInvite.inviteUrl : "Creating your link…"}
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

        {/* Who's already in the room */}
        {collaborators.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
              In this room
            </p>
            {collaborators.map((c) => {
              const hereNow = isHereNow(c);
              const row = (
                <>
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
                          borderRadius: "50%", backgroundColor: "#53AB8B", border: "2px solid #FAFAF6",
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
                </>
              );
              // With a jump handler, each person is a destination: tap → the
              // canvas flies to their latest idea (presence as navigation).
              return onJumpTo ? (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => onJumpTo(c)}
                  aria-label={`Go to ${c.firstName}'s latest idea on the canvas`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    minHeight: 48, padding: "6px 0", background: "none", border: "none",
                    borderBottom: "1px solid var(--cog-border)", cursor: "pointer",
                  }}
                >
                  {row}
                </button>
              ) : (
                <div key={c.userId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--cog-border)" }}>
                  {row}
                </div>
              );
            })}
            {onJumpTo && (
              <p style={{ fontSize: 11, color: "var(--cog-muted)", fontFamily: "var(--font-body)", marginTop: 8 }}>
                Tap a person to see their latest idea on the canvas.
              </p>
            )}
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
