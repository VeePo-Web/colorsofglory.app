import { useNavigate, useParams } from "react-router-dom";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";

// Placeholder invite data — Lovable replaces with real Supabase invite lookup
const MOCK_INVITE = {
  songTitle: "Grace in the Waiting",
  inviterName: "Parker",
  collaboratorCount: 3,
  role: "Contributor" as const,
  // Collaborator avatar initials + colors from the reference image
  avatars: [
    { initials: "PK", bg: "#8B7355" },
    { initials: "SM", bg: "#6B8E6B" },
    { initials: "CR", bg: "#8B6B8E" },
  ],
};

const ROLE_DESCRIPTIONS = {
  Viewer: "Can listen and read.",
  Contributor: "Can add lyrics, memos, comments, and ideas.",
  Reviewer: "Can comment and approve changes.",
};

const InvitePreviewPage = () => {
  const navigate = useNavigate();
  const { token } = useParams();
  void token; // Lovable uses this to fetch real invite
  const invite = MOCK_INVITE;

  const handleOpen = () => {
    navigate("/songs/1");
  };

  return (
    <OnboardingShell>
      {/* Logo */}
      <div className="pt-16 pb-10 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Headline — matches reference: "You've been invited" */}
      <h1
        className="text-[2.6rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        You've been invited
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        Open the song and start collaborating.
      </p>

      {/* Invite card — matches reference image exactly */}
      <div
        className="rounded-2xl p-6 mb-3"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1.5px solid rgba(181,147,90,0.30)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        {/* Song title */}
        <p
          className="text-[1.375rem] font-bold mb-1 leading-snug"
          style={{ color: "#1A1A1A", fontFamily: "var(--font-display)" }}
        >
          {invite.songTitle}
        </p>

        {/* Invited by */}
        <p className="text-[0.875rem] mb-5" style={{ color: "#666" }}>
          Invited by{" "}
          <span style={{ color: "#1A1A1A", fontWeight: 600 }}>{invite.inviterName}</span>
        </p>

        {/* Avatar row + collaborator count */}
        <div className="flex items-center gap-3">
          {/* Stacked avatars */}
          <div className="flex -space-x-2.5">
            {invite.avatars.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-center rounded-full text-white text-[11px] font-bold"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: a.bg,
                  border: "2px solid #FFFFFF",
                  position: "relative",
                  zIndex: invite.avatars.length - i,
                }}
              >
                {a.initials}
              </div>
            ))}
          </div>
          <p className="text-[0.875rem]" style={{ color: "#666" }}>
            {invite.collaboratorCount} collaborators
          </p>

          {/* Role chip */}
          <span
            className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-[0.75rem] font-semibold"
            style={{
              backgroundColor: "rgba(181,147,90,0.12)",
              color: "#B5935A",
              border: "1px solid rgba(181,147,90,0.25)",
            }}
          >
            {invite.role}
          </span>
        </div>

        {/* Role description */}
        <p
          className="text-[0.8125rem] mt-4 pt-4 leading-relaxed"
          style={{
            color: "#999",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {ROLE_DESCRIPTIONS[invite.role]}
        </p>
      </div>

      {/* Reassurance microcopy */}
      <p className="text-[0.75rem] text-center mb-8" style={{ color: "#999" }}>
        Invited songs do not use your free song.
      </p>

      {/* Open song — gold pill CTA */}
      <GoldButton onClick={handleOpen}>
        Open song
      </GoldButton>

      {/* View details */}
      <button
        className="text-[0.9375rem] text-center w-full py-4 transition-opacity hover:opacity-70 underline"
        style={{ color: "#999", fontFamily: "var(--font-body)" }}
      >
        View details
      </button>
    </OnboardingShell>
  );
};

export default InvitePreviewPage;
