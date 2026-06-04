import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

const REFERRAL_LINK = "app.colorsofglory.com/ref/PARKER123";

interface StatCard {
  label: string;
  value: string;
}

const STATS: StatCard[][] = [
  [
    { label: "Signups", value: "24" },
    { label: "Active Pro", value: "18" },
  ],
  [
    { label: "Pending", value: "3" },
    { label: "Payable", value: "$180" },
  ],
];

const ReferralPage = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`https://${REFERRAL_LINK}`);
    } catch {
      // Fallback for environments without clipboard API
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
        </div>

        <div className="flex justify-center mb-6">
          <CogLogo size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Invite songwriters. Earn monthly.
        </h1>
        <p className="text-base mb-8" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          You earn $10/month while each direct referral stays on Pro.
        </p>

        {/* Referral link card */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border-gold)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.12)",
          }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            Your referral link
          </p>
          <div className="flex items-center gap-3">
            <p
              className="flex-1 text-sm truncate"
              style={{
                color: "var(--cog-charcoal)",
                fontFamily: "monospace",
              }}
            >
              {REFERRAL_LINK}
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "rgba(184,149,58,0.12)",
                color: copied ? "#53AB8B" : "var(--cog-gold)",
                border: "1px solid rgba(184,149,58,0.22)",
              }}
              aria-label="Copy referral link"
            >
              <Copy size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="flex flex-col gap-3 mb-8">
          {STATS.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-2 gap-3">
              {row.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 text-center"
                  style={{
                    backgroundColor: "var(--cog-cream-light)",
                    border: "1.5px solid var(--cog-border)",
                  }}
                >
                  <p
                    className="font-semibold mb-0.5"
                    style={{
                      fontSize: 36,
                      color: "var(--cog-charcoal)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleCopy}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all duration-150 active:scale-[0.97] mb-3"
          style={{
            backgroundColor: copied ? "#53AB8B" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            boxShadow: "0 4px 20px rgba(184,149,58,0.35)",
          }}
        >
          {copied ? "Link copied!" : "Copy link"}
        </button>

        <button
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70 mb-10"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Share2 size={14} strokeWidth={1.8} />
            Share invite
          </span>
        </button>

        {/* Rules */}
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "var(--cog-cream-light)",
            border: "1.5px solid var(--cog-border)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
          >
            How referrals work
          </h2>
          <ul className="flex flex-col gap-3">
            {[
              "Direct referrals only. No multi-level structure.",
              "You earn $10/month per active Pro referral.",
              "Payouts begin 30 days after referral's first Pro payment.",
              "No commission during free or founder access periods.",
            ].map((rule, index) => (
              <li key={index} className="flex items-start gap-2.5">
                <span
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2"
                  style={{ backgroundColor: "var(--cog-gold)" }}
                />
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                >
                  {rule}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
