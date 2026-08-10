import { lazy, Suspense, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, UserPlus } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import SongTabBar from "@/components/cog/SongTabBar";
import CollaboratorAvatarStack from "@/components/invite/CollaboratorAvatarStack";
import { useSongTitle } from "@/lib/songContext";
import { useSongCollaborators, type SongCollaborator } from "@/lib/invite/useSongCollaborators";
// F3 referral loop — the host renders the calm nudge; the share sheet fires
// the invite_sent moment (see docs/REFERRAL-CONTRACT.md).
import ReferralPromptHost from "@/components/referral/ReferralPromptHost";

// The app's ONE invite surface — the same sheet the canvas header opens.
const ShareSongSheet = lazy(() => import("@/components/invite/ShareSongSheet"));

// ─── Collaborator row ────────────────────────────────────────────────────────

const CollabRow = ({ collab }: { collab: SongCollaborator }) => (
  <div
    className="flex items-center gap-3 py-3"
    style={{ borderBottom: "1px solid var(--cog-border)" }}
  >
    <div
      className="rounded-full flex items-center justify-center text-white font-bold text-[0.75rem] flex-shrink-0"
      style={{ width: 38, height: 38, backgroundColor: collab.avatarColor }}
    >
      {collab.avatarInitials}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[0.9375rem] font-medium leading-snug truncate" style={{ color: "var(--cog-charcoal)" }}>
        {collab.firstName} {collab.lastName}
      </p>
      <p className="text-[0.8125rem]" style={{ color: "var(--cog-warm-gray)" }}>
        {collab.role}
      </p>
    </div>
    {collab.isOwner && (
      <Crown size={14} strokeWidth={1.5} style={{ color: "var(--cog-gold)", flexShrink: 0 }} aria-label="Song owner" />
    )}
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * The People page — who is in this song, and the one door in.
 *
 * Inviting happens through the SAME ShareSongSheet as the canvas header: one
 * mental model, one link, one defaulted decision, everywhere. (The old
 * send-to-contact form called a delivery backend that does not exist — its
 * success state was unreachable. One door, honestly open, replaced it.)
 */
const PeoplePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);
  const collabs = useSongCollaborators(songId);
  const [showShareSheet, setShowShareSheet] = useState(false);

  return (
    <div
      className="relative flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)", minHeight: "100dvh", paddingBottom: 88 }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 55% 40% at 85% 90%, var(--cog-gold-glow) 0%, transparent 65%)" }}
      />

      {/* Back */}
      <div className="relative px-5" style={{ maxWidth: 430, margin: "0 auto", width: "100%", paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
        <button
          onClick={() => navigate(`/songs/${songId}`)}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "var(--cog-warm-gray)", minHeight: 44 }}
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
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
        >
          {songTitle}
        </h1>
        <p className="text-[0.875rem] text-center mb-6" style={{ color: "var(--cog-warm-gray)" }}>
          People in this song
        </p>

        {/* Collaborator stack overview */}
        <div className="flex justify-center mb-3">
          <CollaboratorAvatarStack
            collaborators={collabs}
            size={44}
            maxVisible={5}
          />
        </div>
        <p className="text-[0.8125rem] text-center mb-6" style={{ color: "var(--cog-warm-gray)" }}>
          {collabs.length} collaborator{collabs.length !== 1 ? "s" : ""}
        </p>

        {/* THE one door in */}
        <div className="mb-5">
          <GoldButton onClick={() => setShowShareSheet(true)}>
            <UserPlus size={16} strokeWidth={1.8} /> Invite into this song
          </GoldButton>
          <p className="text-[0.8125rem] text-center mt-3" style={{ color: "var(--cog-warm-gray)" }}>
            Joining a song never uses anyone's free song.
          </p>
        </div>

        {/* ── CURRENT MEMBERS ──────────────────────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1px solid var(--cog-border)",
            boxShadow: "0 2px 12px rgba(28,26,23,0.06)",
          }}
        >
          <div className="px-4 pt-4 pb-2">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide" style={{ color: "var(--cog-warm-gray)" }}>
              In this song
            </p>
          </div>
          <div className="px-4 pb-2">
            {collabs.length === 0 ? (
              <p className="text-[0.875rem] py-3" style={{ color: "var(--cog-warm-gray)" }}>
                It's just you so far — the door is ready when you are.
              </p>
            ) : (
              collabs.map((c) => <CollabRow key={c.userId} collab={c} />)
            )}
          </div>
        </div>
      </div>

      <SongTabBar activeTab="people" />

      {/* F3 — calm referral nudge host; also detects the room growing */}
      <ReferralPromptHost songId={songId} collaboratorCount={collabs.length} />

      {showShareSheet && (
        <Suspense
          fallback={
            <div
              style={{ position: "fixed", inset: 0, zIndex: 799, backgroundColor: "rgba(26,26,23,0.35)" }}
              aria-hidden="true"
            />
          }
        >
          <ShareSongSheet
            songId={songId}
            songTitle={songTitle}
            collaborators={collabs}
            onClose={() => setShowShareSheet(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default PeoplePage;
