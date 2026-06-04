import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Download } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";

interface CreditEntry {
  initials: string;
  name: string;
  role: string;
  color: string;
  isOwner?: boolean;
  contributions: string[];
}

const CREDITS: CreditEntry[] = [
  {
    initials: "PK",
    name: "Parker",
    role: "Owner",
    color: "#B8953A",
    isOwner: true,
    contributions: ["Lyrics", "Arrangement", "Original idea"],
  },
  {
    initials: "SM",
    name: "Sarah M.",
    role: "Contributor",
    color: "#53AB8B",
    contributions: ["Voice memo", "Bridge idea", "3 recordings"],
  },
  {
    initials: "CR",
    name: "Caleb R.",
    role: "Reviewer",
    color: "#8070C4",
    contributions: ["Chord suggestion", "Chorus review", "2 comments"],
  },
];

const CreditsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const songId = id ?? "1";

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
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.12) 0%, transparent 60%)",
        }}
      />

      <div
        className="relative flex flex-col flex-1 px-6 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="pt-14 pb-6">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-1"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Credits
        </h1>
        <p className="text-sm mb-1" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          Grace in the Waiting
        </p>
        <p className="text-sm mb-8" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
          Every contribution remembered.
        </p>

        {/* Credit cards */}
        <div className="flex flex-col gap-4 mb-8">
          {CREDITS.map((credit) => (
            <div
              key={credit.name}
              className="rounded-2xl p-5"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: credit.isOwner
                  ? "1.5px solid var(--cog-border-gold)"
                  : "1.5px solid var(--cog-border)",
                boxShadow: credit.isOwner
                  ? "0 4px 20px rgba(184,149,58,0.12)"
                  : "0 4px 16px rgba(28,26,23,0.06)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                {/* Avatar */}
                <div
                  className="flex items-center justify-center rounded-full text-sm font-semibold flex-shrink-0"
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: `${credit.color}20`,
                    color: credit.color,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {credit.initials}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className="text-base font-semibold"
                      style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                    >
                      {credit.name}
                    </p>
                    {credit.isOwner && (
                      <Crown size={14} style={{ color: "var(--cog-gold)" }} />
                    )}
                  </div>
                  <p
                    className="text-xs"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  >
                    {credit.role}
                  </p>
                </div>
              </div>

              {/* Contributions */}
              <div className="flex flex-wrap gap-2">
                {credit.contributions.map((contribution) => (
                  <span
                    key={contribution}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${credit.color}14`,
                      color: credit.color,
                      border: `1px solid ${credit.color}30`,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {contribution}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Export button */}
        <button
          className="w-full py-4 rounded-2xl font-medium text-base transition-all duration-150 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
          }}
        >
          <span className="flex items-center justify-center gap-2">
            <Download size={16} strokeWidth={1.8} style={{ color: "var(--cog-warm-gray)" }} />
            Export credits
          </span>
        </button>
      </div>
    </div>
  );
};

export default CreditsPage;

