import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, Share2, Crown, Pencil, X, Send, Link2 } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import SongTabBar from "@/components/cog/SongTabBar";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import { useSongTitle } from "@/lib/songContext";
import {
  generateInviteToken,
  revokeInviteToken,
  sendInvite,
  type GeneratedInvite,
  updateOnboardingStep,
} from "@/lib/invite/inviteApi";
import { supabase } from "@/integrations/supabase/client";
import { copyTextToClipboard } from "@/lib/invite/clipboard";
import { getAvatarColor, getAvatarInitials } from "@/lib/invite/inviteContext";

// ─── Types ────────────────────────────────────────────────────────────────────

// Two roles only — matches the DB enum (collaborator / viewer). Reviewer is
// deferred until the backend adds the enum value.
type InviteRole = "viewer" | "contributor";

const ROLE_DETAILS: Record<InviteRole, { label: string; desc: string }> = {
  viewer:      { label: "Viewer",      desc: "Can listen and read." },
  contributor: { label: "Contributor", desc: "Can add lyrics, memos, comments, and ideas." },
};

// ─── Contact validation ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valid if it's a sane email or a 10-digit US phone. */
function isValidContact(contact: string): boolean {
  const trimmed = contact.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) return EMAIL_RE.test(trimmed);
  return trimmed.replace(/\D/g, "").length === 10;
}

interface Collab {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  isOwner: boolean;
  avatarColor: string;
  avatarInitials: string;
}

// Mock collaborators — Lovable replaces with live Supabase query
const MOCK_COLLABS: Collab[] = [
  { userId: "u1", firstName: "Parker", lastName: "Kim",    role: "Owner",       isOwner: true,  avatarColor: "#D4AE5C", avatarInitials: "PK" },
  { userId: "u2", firstName: "Sarah",  lastName: "Miller", role: "Contributor", isOwner: false, avatarColor: "#53AB8B", avatarInitials: "SM" },
  { userId: "u3", firstName: "Caleb",  lastName: "Rivera", role: "Viewer",      isOwner: false, avatarColor: "#8070C4", avatarInitials: "CR" },
];

// ─── Role selection card ─────────────────────────────────────────────────────

const RoleCard = ({
  role,
  selected,
  onSelect,
}: {
  role: InviteRole;
  selected: boolean;
  onSelect: () => void;
}) => {
  const { label, desc } = ROLE_DETAILS[role];
  return (
    <button
      onClick={onSelect}
      className="flex-1 rounded-2xl p-4 text-left transition-all duration-150 active:scale-[0.97]"
      style={{
        backgroundColor: selected ? "rgba(181,147,90,0.06)" : "#FFFFFF",
        border: selected ? "1.5px solid #B5935A" : "1.5px solid rgba(0,0,0,0.08)",
        boxShadow: selected
          ? "0 0 0 3px rgba(181,147,90,0.12), 0 2px 12px rgba(0,0,0,0.06)"
          : "0 2px 8px rgba(0,0,0,0.05)",
      }}
      aria-pressed={selected}
    >
      <p
        className="text-[0.9375rem] font-semibold mb-1"
        style={{ color: selected ? "#B5935A" : "#1A1A1A", fontFamily: "var(--font-body)" }}
      >
        {label}
      </p>
      <p className="text-[0.75rem] leading-snug" style={{ color: "#666" }}>
        {desc}
      </p>
    </button>
  );
};

// ─── Generated link panel ────────────────────────────────────────────────────

const GeneratedLinkPanel = ({
  invite,
  onRevoke,
  onClose,
}: {
  invite: GeneratedInvite;
  onRevoke: () => void;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleCopy = async () => {
    // Only confirm when the text actually landed on the clipboard — the link
    // stays visible above for a manual long-press copy if both paths fail.
    const ok = await copyTextToClipboard(invite.inviteUrl);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join my song on Colors of Glory",
        text: "I'm writing a song and want you to collaborate with me.",
        url: invite.inviteUrl,
      });
    } else {
      handleCopy();
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    await revokeInviteToken(invite.tokenId);
    onRevoke();
  };

  return (
    <div
      className="rounded-2xl p-5 mb-5"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1.5px solid rgba(181,147,90,0.35)",
        boxShadow: "0 4px 20px rgba(181,147,90,0.12)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: "#53AB8B" }}
            aria-hidden="true"
          />
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide" style={{ color: "#666" }}>
            Link ready to share
          </p>
        </div>
        <button
          onClick={onClose}
          className="transition-opacity hover:opacity-60 active:scale-90 p-1"
          aria-label="Close"
          style={{ color: "#999" }}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      {/* Role label */}
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.75rem] font-semibold mb-4"
        style={{
          backgroundColor: "rgba(181,147,90,0.10)",
          color: "#B5935A",
          border: "1px solid rgba(181,147,90,0.25)",
        }}
      >
        {ROLE_DETAILS[invite.assignedRole as InviteRole]?.label ?? invite.assignedRole}
      </span>

      {/* URL display */}
      <div
        className="rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2"
        style={{
          backgroundColor: "#F8F7F4",
          border: "1px solid rgba(0,0,0,0.07)",
        }}
      >
        <p
          className="flex-1 text-[0.8125rem] truncate font-medium"
          style={{ color: "#1A1A1A", fontFamily: "monospace" }}
        >
          {invite.inviteUrl}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <GoldButton onClick={handleCopy} className="flex-1">
          {copied ? (
            <><Check size={16} strokeWidth={2} /> Copied!</>
          ) : (
            <><Copy size={16} strokeWidth={1.5} /> Copy link</>
          )}
        </GoldButton>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 rounded-full font-semibold text-[0.9375rem] transition-all duration-150 active:scale-[0.97] px-4"
          style={{
            height: 56,
            backgroundColor: "#1A1A1A",
            color: "#FFFFFF",
            fontFamily: "var(--font-body)",
            flexShrink: 0,
          }}
          aria-label="Share link"
        >
          <Share2 size={16} strokeWidth={1.5} />
          Share
        </button>
      </div>

      {/* Paste tip */}
      <p className="text-[0.75rem] text-center mt-3" style={{ color: "#999" }}>
        Paste this link in iMessage, WhatsApp, or email.
      </p>

      {/* Revoke */}
      <button
        onClick={handleRevoke}
        disabled={revoking}
        className="text-[0.75rem] text-center w-full mt-3 transition-opacity hover:opacity-70 disabled:opacity-40"
        style={{ color: "#999" }}
      >
        {revoking ? "Revoking..." : "Revoke this link"}
      </button>
    </div>
  );
};

// ─── Collaborator row ────────────────────────────────────────────────────────

const CollabRow = ({ collab }: { collab: Collab }) => (
  <div
    className="flex items-center gap-3 py-3"
    style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
  >
    <div
      className="rounded-full flex items-center justify-center text-white font-bold text-[0.75rem] flex-shrink-0"
      style={{ width: 38, height: 38, backgroundColor: collab.avatarColor }}
    >
      {collab.avatarInitials}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[0.9375rem] font-medium leading-snug" style={{ color: "#1A1A1A" }}>
        {collab.firstName} {collab.lastName}
      </p>
      <p className="text-[0.8125rem]" style={{ color: "#999" }}>
        {collab.role}
      </p>
    </div>
    {collab.isOwner && (
      <Crown size={14} strokeWidth={1.5} style={{ color: "#B5935A", flexShrink: 0 }} />
    )}
    {!collab.isOwner && (
      <button
        className="transition-opacity hover:opacity-70 active:scale-90 p-1"
        aria-label={`Edit ${collab.firstName}'s role`}
        style={{ color: "#CCC" }}
      >
        <Pencil size={13} strokeWidth={1.5} />
      </button>
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const PeoplePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);

  const [selectedRole, setSelectedRole] = useState<InviteRole>("contributor");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null);

  // Send-to-person state
  const [contact, setContact] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState<{ channel: "sms" | "email"; to: string } | null>(null);

  // Load real collaborators from Supabase
  const [collabs, setCollabs] = useState<Collab[]>(MOCK_COLLABS);
  useEffect(() => {
    let active = true;

    const loadCollaborators = async () => {
      try {
        const { data } = await supabase
          .from("song_members")
          .select("user_id, role, profiles!inner(display_name, avatar_url)")
          .eq("song_id", songId);

        if (!active) return;
        if (!data?.length) return;
        setCollabs(
          data.map((m) => {
            const profile = (m as { profiles?: { display_name?: string } }).profiles;
            const name = profile?.display_name ?? "Unknown";
            const parts = name.trim().split(/\s+/);
            const first = parts[0] ?? name;
            const last = parts.slice(1).join(" ");
            return {
              userId: m.user_id,
              firstName: first,
              lastName: last,
              role: m.role === "owner" ? "Owner" : m.role === "collaborator" ? "Contributor" : "Viewer",
              isOwner: m.role === "owner",
              avatarColor: getAvatarColor(m.user_id),
              avatarInitials: getAvatarInitials(first, last),
            } satisfies Collab;
          })
        );
      } catch {
        // Keep mock collaborators on error.
      }
    };

    void loadCollaborators();

    return () => {
      active = false;
    };
  }, [songId]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const invite = await generateInviteToken(songId, selectedRole, 5);
      setGeneratedInvite(invite);
    } catch {
      setError("Couldn't create the link. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!isValidContact(contact) || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await sendInvite(songId, selectedRole, contact);
      updateOnboardingStep("first_collaborator_invited").catch(() => {});
      if (result.delivered) {
        setSent({ channel: result.channel, to: contact.trim() });
        setContact("");
      } else {
        // Backend delivery not available — fall back to a shareable link.
        setGeneratedInvite({
          tokenId: result.tokenId,
          token: result.token,
          inviteUrl: result.inviteUrl,
          assignedRole: selectedRole,
          maxUses: 1,
        });
        setError("We couldn't send it automatically — share this link instead.");
      }
    } catch {
      setError("Couldn't send the invite. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const resetInvite = () => {
    setSent(null);
    setGeneratedInvite(null);
    setError(null);
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#FAFAF6", paddingBottom: 88 }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.08) 0%, transparent 65%)" }}
      />

      {/* Back */}
      <div className="relative px-5 pt-14" style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}>
        <button
          onClick={() => navigate(`/songs/${songId}`)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "#999", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Song
        </button>
      </div>

      <div
        className="relative flex flex-col flex-1 px-5"
        style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
      >
        {/* Logo + title */}
        <div className="flex justify-center pt-3 pb-4">
          <CogBrand variant="stacked" size="sm" />
        </div>
        <h1
          className="text-[1.5rem] font-bold text-center mb-1 leading-snug"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          {songTitle}
        </h1>
        <p className="text-[0.875rem] text-center mb-6" style={{ color: "#666" }}>
          People in this song
        </p>

        {/* Collaborator stack overview */}
        <div className="flex justify-center mb-3">
          <CollaboratorAvatarStack
            collaborators={collabs.map((c) => ({
              userId: c.userId,
              firstName: c.firstName,
              lastName: c.lastName,
              avatarColor: c.avatarColor,
              avatarInitials: c.avatarInitials,
            }))}
            size={44}
            maxVisible={5}
          />
        </div>
        <p className="text-[0.8125rem] text-center mb-6" style={{ color: "#999" }}>
          {collabs.length} collaborator{collabs.length !== 1 ? "s" : ""}
        </p>

        {/* ── INVITE SECTION ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            className="text-[1.0625rem] font-semibold mb-1"
            style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
          >
            Invite someone into this song
          </h2>
          <p className="text-[0.8125rem] mb-5" style={{ color: "#666" }}>
            They can listen, write, or comment depending on the role you choose.
          </p>

          {sent ? (
            /* ── Sent success state ──────────────────────────────────────── */
            <div className="text-center py-2">
              <div
                className="mx-auto mb-3 flex items-center justify-center rounded-full"
                style={{ width: 48, height: 48, backgroundColor: "rgba(83,171,139,0.12)", border: "1.5px solid rgba(83,171,139,0.35)" }}
                aria-hidden="true"
              >
                <Check size={22} strokeWidth={2} style={{ color: "#53AB8B" }} />
              </div>
              <p className="text-[1rem] font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}>
                Invite sent
              </p>
              <p className="text-[0.8125rem] mb-4" style={{ color: "#666" }}>
                We {sent.channel === "email" ? "emailed" : "texted"} the invite to{" "}
                <span style={{ color: "#1A1A1A", fontWeight: 500 }}>{sent.to}</span>.
              </p>
              <button
                onClick={resetInvite}
                className="text-[0.875rem] font-medium transition-opacity hover:opacity-70"
                style={{ color: "#B5935A", minHeight: 44 }}
              >
                Invite another person
              </button>
            </div>
          ) : (
            <>
              {/* Role cards */}
              <div className="flex gap-2 mb-5">
                {(["viewer", "contributor"] as InviteRole[]).map((r) => (
                  <RoleCard
                    key={r}
                    role={r}
                    selected={selectedRole === r}
                    onSelect={() => { setSelectedRole(r); setGeneratedInvite(null); }}
                  />
                ))}
              </div>

              {/* Contact input */}
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={contact}
                onChange={(e) => { setContact(e.target.value); if (error) setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && isValidContact(contact)) handleSend(); }}
                placeholder="Phone number or email"
                aria-label="Phone number or email"
                className="w-full rounded-xl mb-3"
                style={{
                  height: 52,
                  padding: "0 16px",
                  backgroundColor: "#FFFFFF",
                  border: isValidContact(contact) ? "1.5px solid #B5935A" : "1.5px solid rgba(0,0,0,0.10)",
                  boxShadow: isValidContact(contact) ? "0 0 0 3px rgba(181,147,90,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
                  color: "#1A1A1A",
                  fontFamily: "var(--font-body)",
                  fontSize: "1rem",
                  outline: "none",
                  caretColor: "#B5935A",
                  transition: "border 150ms, box-shadow 150ms",
                }}
              />

              {/* Error */}
              {error && (
                <p className="text-[0.8125rem] text-center mb-3" style={{ color: "#E05440" }} role="alert">
                  {error}
                </p>
              )}

              {/* Primary: send invite */}
              <GoldButton
                disabled={!isValidContact(contact)}
                loading={isSending}
                loadingText="Sending..."
                onClick={handleSend}
              >
                <Send size={16} strokeWidth={1.8} /> Send invite
              </GoldButton>

              {/* Secondary: or share a link */}
              {!generatedInvite && (
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 w-full mt-3 text-[0.875rem] font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
                  style={{ color: "#666", minHeight: 44 }}
                >
                  <Link2 size={15} strokeWidth={1.8} />
                  {isGenerating ? "Creating link..." : "Or share a link instead"}
                </button>
              )}

              {/* Microcopy */}
              <p className="text-[0.75rem] text-center mt-3" style={{ color: "#999" }}>
                Invited songs don't use their free song.
              </p>
            </>
          )}
        </div>

        {/* ── GENERATED LINK ───────────────────────────────────────────────── */}
        {generatedInvite && (
          <GeneratedLinkPanel
            invite={generatedInvite}
            onRevoke={resetInvite}
            onClose={resetInvite}
          />
        )}

        {/* ── CURRENT MEMBERS ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div className="px-4 pt-4 pb-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide" style={{ color: "#999" }}>
              In this song
            </p>
          </div>
          <div className="px-4 pb-2">
            {collabs.map((c) => (
              <CollabRow key={c.userId} collab={c} />
            ))}
          </div>
        </div>
      </div>

      <SongTabBar activeTab="people" />
    </div>
  );
};

export default PeoplePage;
