import { useNavigate } from "react-router-dom";
import { PenLine, Users } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";
import BackHeader from "@/components/cog/BackHeader";

const FirstIntentPage = () => {
  const navigate = useNavigate();

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
            "radial-gradient(ellipse 80% 60% at 50% 85%, rgba(184,149,58,0.14) 0%, transparent 65%)",
        }}
      />

      <BackHeader to="/auth/verify" label="Back" />

      <div
        className="relative flex flex-col flex-1 px-6 pt-4 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Brand */}
        <div className="flex justify-center mb-10">
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
          What are you working on?
        </h1>

        <p className="text-base mb-10 text-center" style={{ color: "var(--cog-warm-gray)" }}>
          Choose where to begin. You can always do both later.
        </p>

        {/* Intent cards */}
        <div className="flex flex-col gap-4 mb-10">
          {/* Start a song */}
          <button
            onClick={() => navigate("/onboarding/start-song")}
            className="w-full text-left rounded-2xl p-5 transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
              boxShadow: "var(--cog-shadow-card)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: "rgba(184,149,58,0.12)",
                  border: "1px solid rgba(184,149,58,0.20)",
                }}
              >
                <PenLine size={22} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
              </div>
              <div>
                <p
                  className="text-lg font-semibold mb-1"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                >
                  Start a song
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                  Create a private space for lyrics, voice memos, chords, and ideas.
                </p>
              </div>
            </div>
          </button>

          {/* Join a song */}
          <button
            onClick={() => navigate("/invite/demo")}
            className="w-full text-left rounded-2xl p-5 transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
              boxShadow: "var(--cog-shadow-card)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: "rgba(107,100,89,0.08)",
                  border: "1px solid rgba(107,100,89,0.14)",
                }}
              >
                <Users size={22} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
              </div>
              <div>
                <p
                  className="text-lg font-semibold mb-1"
                  style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}
                >
                  Join a song
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                  Use an invite from someone you are writing with.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Microcopy */}
        <p className="text-xs text-center" style={{ color: "var(--cog-muted)" }}>
          You can always do both later.
        </p>
      </div>
    </div>
  );
};

export default FirstIntentPage;
