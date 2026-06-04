import { useNavigate, useParams } from "react-router-dom";
import { Music, Users } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

const MOCK_INVITE = {
  songTitle: "Grace in the Waiting",
  inviterName: "Parker",
  collaboratorCount: 3,
  role: "Contributor",
};

const InvitePreviewPage = () => {
  const navigate = useNavigate();
  const { token } = useParams();
  const invite = MOCK_INVITE;

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 80%, rgba(184,149,58,0.14) 0%, transparent 65%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pt-24 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Brand */}
        <div className="flex justify-center mb-12">
          <CogLogo size="sm" />
        </div>

        {/* Headline */}
        <h1
          className="text-4xl font-semibold mb-2 text-center"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            lineHeight: 1.1,
          }}
        >
          You have been invited
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          Open the song and start collaborating.
        </p>

        {/* Invite song card */}
        <div
          className="rounded-2xl p-5 mb-8"
          style={{
            background: "linear-gradient(145deg, var(--cog-cream-light) 0%, rgba(232,213,160,0.25) 100%)",
            border: "1.5px solid var(--cog-border-gold)",
            boxShadow: "var(--cog-shadow-card)",
          }}
        >
          {/* Song icon + title */}
          <div className="flex items-start gap-4 mb-4">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 52,
                height: 52,
                backgroundColor: "rgba(184,149,58,0.12)",
                border: "1px solid rgba(184,149,58,0.22)",
              }}
            >
              <Music size={24} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
            </div>
            <div>
              <p
                className="text-xl font-semibold leading-snug mb-1"
                style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
              >
                {invite.songTitle}
              </p>
              <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                Invited by{" "}
                <span style={{ color: "var(--cog-charcoal)", fontWeight: 500 }}>
                  {invite.inviterName}
                </span>
              </p>
            </div>
          </div>

          {/* Role + collaborators row */}
          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: "1px solid var(--cog-border)" }}
          >
            <div className="flex items-center gap-1.5">
              <Users size={14} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
              <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                {invite.collaboratorCount} collaborators
              </p>
            </div>
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "rgba(184,149,58,0.15)",
                color: "var(--cog-gold-alt)",
              }}
            >
              {invite.role}
            </span>
          </div>
        </div>

        {/* Reassurance microcopy */}
        <p className="text-xs text-center mb-8" style={{ color: "var(--cog-muted)" }}>
          Invited songs do not use your free song.
        </p>

        {/* Open song CTA */}
        <button
          onClick={() => navigate("/songs/1")}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-4"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.40)",
          }}
        >
          Open song
        </button>

        {/* View details */}
        <button
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          View details
        </button>
      </div>
    </div>
  );
};

export default InvitePreviewPage;
