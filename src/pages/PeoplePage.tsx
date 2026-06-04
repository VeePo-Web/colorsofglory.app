import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, Share2, Crown, Pencil, X } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import SongTabBar from "@/components/cog/SongTabBar";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import { useSongTitle, getAvatarColor } from "@/lib/songContext";
import { generateInviteToken, revokeInviteToken, type GeneratedInvite } from "@/lib/invite/inviteApi";

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteRole = "viewer" | "contributor" | "reviewer";

const ROLE_DETAILS: Record<InviteRole, { label: string; desc: string }> = {
  viewer:      { label: "Viewer",      desc: "Can listen and read." },
  contributor: { label: "Contributor", desc: "Can add lyrics, memos, comments, and ideas." },
  reviewer:    { label: "Reviewer",    desc: "Can comment and approve changes." },
};

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
  { userId: "u3", firstName: "Caleb",  lastName: "Rivera", role: "Reviewer",    isOwner: false, avatarColor: "#8070C4", avatarInitials: "CR" },
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
    try { await navigator.clipboard.writeText(invite.inviteUrl); } catch { /* fallback */ }
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
            collaborators={MOCK_COLLABS.map((c) => ({
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
          {MOCK_COLLABS.length} collaborator{MOCK_COLLABS.length !== 1 ? "s" : ""}
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
            They can listen, write, comment, or review depending on the role you choose.
          </p>

          {/* Role cards */}
          <div className="flex gap-2 mb-5">
            {(["viewer", "contributor", "reviewer"] as InviteRole[]).map((r) => (
              <RoleCard
                key={r}
                role={r}
                selected={selectedRole === r}
                onSelect={() => { setSelectedRole(r); setGeneratedInvite(null); }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-[0.8125rem] text-center mb-3" style={{ color: "#E05440" }} role="alert">
              {error}
            </p>
          )}

          {/* Generate link button */}
          {!generatedInvite && (
            <GoldButton
              loading={isGenerating}
              loadingText="Creating link..."
              onClick={handleGenerate}
            >
              Create invite link
            </GoldButton>
          )}

          {/* Microcopy */}
          <p className="text-[0.75rem] text-center mt-3" style={{ color: "#999" }}>
            Invited songs don't use their free song.
          </p>
        </div>

        {/* ── GENERATED LINK ───────────────────────────────────────────────── */}
        {generatedInvite && (
          <GeneratedLinkPanel
            invite={generatedInvite}
            onRevoke={() => setGeneratedInvite(null)}
            onClose={() => setGeneratedInvite(null)}
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
            {MOCK_COLLABS.map((c) => (
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
