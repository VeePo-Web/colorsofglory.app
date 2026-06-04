import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BackHeader from "@/components/cog/BackHeader";

interface PlanFeature {
  label: string;
}

const FREE_FEATURES: PlanFeature[] = [
  { label: "1 owned song" },
  { label: "500MB storage" },
  { label: "Voice memos (limited)" },
  { label: "Basic collaboration" },
];

const PRO_FEATURES: PlanFeature[] = [
  { label: "50 active owned songs" },
  { label: "100GB storage" },
  { label: "Voice memos (unlimited)" },
  { label: "Version history" },
  { label: "Collaborators (unlimited)" },
  { label: "Exports" },
];

const UpgradePage = () => {
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
            "radial-gradient(ellipse 70% 50% at 50% 85%, rgba(184,149,58,0.18) 0%, transparent 65%)",
        }}
      />

      <BackHeader label="Back" />

      <div
        className="relative flex flex-col flex-1 px-6 pt-4 pb-12"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-4xl font-semibold mb-3 text-center"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Ready to build your catalog?
        </h1>

        <p
          className="text-base text-center mb-10"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Free includes one active owned song. Upgrade to Pro when one song becomes a real workspace.
        </p>

        {/* Plan cards */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Free card */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
              >
                Free
              </h2>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
              >
                $0
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {FREE_FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: "rgba(160,150,137,0.15)",
                    }}
                  >
                    <Check size={10} strokeWidth={3} style={{ color: "var(--cog-muted)" }} />
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  >
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro card */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(184,149,58,0.06) 0%, rgba(184,149,58,0.12) 100%)",
              border: "1.5px solid var(--cog-border-gold)",
              boxShadow: "0 8px 32px rgba(184,149,58,0.16)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2
                  className="text-xl font-semibold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
                >
                  Pro
                </h2>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: "rgba(184,149,58,0.15)",
                    color: "var(--cog-gold)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Most popular
                </span>
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                $12/month
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {PRO_FEATURES.map((feature) => (
                <li key={feature.label} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 18,
                      height: 18,
                      backgroundColor: "rgba(184,149,58,0.18)",
                    }}
                  >
                    <Check size={10} strokeWidth={3} style={{ color: "var(--cog-gold)" }} />
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
                  >
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Go Pro CTA */}
        <button
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-3"
          style={{
            backgroundColor: "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 6px 28px rgba(184,149,58,0.45)",
          }}
        >
          Go Pro
        </button>

        <button
          onClick={() => navigate(-1)}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          Keep using Free
        </button>
      </div>
    </div>
  );
};

export default UpgradePage;

