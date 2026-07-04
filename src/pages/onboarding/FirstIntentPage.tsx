import { useNavigate } from "react-router-dom";
import { PenLine, Users } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import OnboardingShell from "@/components/cog/OnboardingShell";
import OnboardingProgress from "@/components/cog/OnboardingProgress";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";
import { useIdlePrefetch } from "@/lib/onboarding/prefetchNext";

interface IntentCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
  /** Position in the list — drives the staggered entrance delay. */
  index?: number;
}

const IntentCard = ({ icon: Icon, title, description, onClick, accent, index = 0 }: IntentCardProps) => (
  <button
    onClick={onClick}
    className="cog-intent-in w-full text-left rounded-2xl p-5 transition-all duration-150 active:scale-[0.98] active:shadow-none"
    style={{
      backgroundColor: "#FFFFFF",
      border: accent ? "1.5px solid #B5935A" : "1.5px solid rgba(0,0,0,0.08)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      animationDelay: `${160 + index * 90}ms`,
    }}
  >
    <div className="flex items-start gap-4">
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{
          width: 44,
          height: 44,
          backgroundColor: accent ? "rgba(181,147,90,0.12)" : "rgba(0,0,0,0.04)",
        }}
      >
        <Icon
          size={20}
          strokeWidth={1.6}
          style={{ color: accent ? "#B5935A" : "#666" }}
        />
      </div>
      <div className="pt-0.5">
        <p
          className="text-[1.0625rem] font-semibold mb-1 leading-snug"
          style={{ color: "#1A1A1A", fontFamily: "var(--font-display)" }}
        >
          {title}
        </p>
        <p className="text-[0.875rem] leading-relaxed" style={{ color: "#666" }}>
          {description}
        </p>
      </div>
    </div>
  </button>
);

const FirstIntentPage = () => {
  const navigate = useNavigate();
  // While they choose, fetch the create-song screen so "Start a song" is instant.
  useIdlePrefetch(() => import("@/pages/onboarding/StartFirstSongPage"));

  return (
    <OnboardingShell>
      {/* Logo */}
      <div className="pt-16 pb-6 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Momentum cue */}
      <OnboardingProgress step={1} total={2} className="mb-9" />

      {/* Headline */}
      <h1
        className="text-[2.6rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        What are you working on?
      </h1>
      <p className="text-[1rem] text-center mb-10" style={{ color: "#666" }}>
        Choose where to begin.
      </p>

      {/* The two choices arrive in sequence — a calm, considered reveal after
          the screen settles. Reduced-motion shows them in place. GPU-only. */}
      <style>{`
        @keyframes cogIntentIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cog-intent-in { animation: cogIntentIn 380ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .cog-intent-in { animation: none; } }
      `}</style>

      {/* Intent cards */}
      <div className="flex flex-col gap-4 mb-8">
        <IntentCard
          icon={PenLine}
          title="Start a song"
          description="Create a private space for lyrics, voice memos, chords, and ideas."
          onClick={() => {
            updateOnboardingStep("intent_selected").catch(() => {});
            navigate("/onboarding/start-song");
          }}
          accent
          index={0}
        />
        <IntentCard
          icon={Users}
          title="Join a song"
          description="Use an invite from someone you are writing with."
          onClick={() => navigate("/join")}
          index={1}
        />
      </div>

      {/* Microcopy */}
      <p className="text-[13px] text-center" style={{ color: "#999" }}>
        You can always do both later.
      </p>

      {/* Quiet founder/beta code path — a post-verification route by intent for
          users who hold a founder, beta, friend, or lifetime code. Kept quiet so
          it reads as private access, not a public coupon. */}
      <button
        onClick={() => navigate("/onboarding/founder-code")}
        className="mt-6 text-[13px] text-center w-full py-2 transition-opacity hover:opacity-70 underline"
        style={{ color: "#999", fontFamily: "var(--font-body)" }}
      >
        Have a founder or beta code?
      </button>
    </OnboardingShell>
  );
};

export default FirstIntentPage;
