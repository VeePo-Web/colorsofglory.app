import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Check, TrendingUp, Users, DollarSign } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import OnboardingShell from "@/components/cog/OnboardingShell";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { fetchReferralStats, type ReferralStats } from "@/lib/pricing/pricingApi";
import { updateOnboardingStep } from "@/lib/invite/inviteApi";

// Documented floor for the per-referral monthly reward (backend default is 500¢).
// The real value comes from fetchReferralStats().perReferralCents the moment it
// loads, so this only governs the very first paint and the offline fallback.
const DEFAULT_PER_REFERRAL_CENTS = 500;

interface StatRowProps {
  people: number;
  monthly: number;
  yearly: number;
  highlight?: boolean;
}

const StatRow = ({ people, monthly, yearly, highlight }: StatRowProps) => (
  <div
    className="flex items-center justify-between px-4 py-3 rounded-xl"
    style={{
      backgroundColor: highlight ? "rgba(181,147,90,0.10)" : "rgba(0,0,0,0.02)",
      border: highlight ? "1px solid rgba(181,147,90,0.25)" : "1px solid rgba(0,0,0,0.06)",
    }}
  >
    <div className="flex items-center gap-2">
      <Users size={13} strokeWidth={1.5} style={{ color: highlight ? "#B5935A" : "#999" }} />
      <span className="text-sm font-medium" style={{ color: highlight ? "#1A1A1A" : "#666" }}>
        {people.toLocaleString()} {people === 1 ? "songwriter" : "songwriters"}
      </span>
    </div>
    <div className="text-right">
      <span
        className="text-sm font-bold"
        style={{ color: highlight ? "#B5935A" : "#1A1A1A" }}
      >
        ${monthly.toLocaleString()}/mo
      </span>
      <span className="text-xs ml-1.5" style={{ color: "#999" }}>
        ${yearly.toLocaleString()}/yr
      </span>
    </div>
  </div>
);

const EarnPage = () => {
  const navigate = useNavigate();
  const { profile } = useCurrentAccount();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  // Record that the referral program was seen (monotonic onboarding step) and
  // pull the user's REAL referral link + reward rate from the same source the
  // settings Refer & Earn screen uses — never a hardcoded demo link.
  useEffect(() => {
    updateOnboardingStep("referral_program_seen").catch(() => {});
    fetchReferralStats()
      .then(setStats)
      .catch(() => {/* offline / not signed in yet — fall back below */});
  }, []);

  // Real per-referral monthly reward, in whole dollars, sourced from the backend.
  const perReferralDollars = Math.round(
    (stats?.perReferralCents ?? DEFAULT_PER_REFERRAL_CENTS) / 100,
  );

  // Real referral link: prefer the canonical stats link, fall back to building
  // one from the profile's referral code so the user always sees THEIR link.
  const referralLink =
    stats?.link ??
    (profile?.referral_code ? `colorsofglory.app/r/${profile.referral_code}` : null);
  const fullLink = referralLink
    ? referralLink.startsWith("http")
      ? referralLink
      : `https://${referralLink}`
    : "";

  // Projection table scales off the real reward rate.
  const projections = useMemo(
    () =>
      [10, 100, 1000, 5000].map((people, i) => ({
        people,
        monthly: people * perReferralDollars,
        yearly: people * perReferralDollars * 12,
        highlight: i === 3,
      })),
    [perReferralDollars],
  );
  const headline = projections[projections.length - 1];

  const handleCopy = async () => {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
    } catch {
      // fallback — clipboard unavailable; the link stays visible to copy manually
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    navigate("/onboarding/start-song");
  };

  return (
    <OnboardingShell>
      {/* Logo */}
      <div className="pt-14 pb-6 flex justify-center">
        <CogBrand variant="stacked" size="md" />
      </div>

      {/* Trending icon */}
      <div
        className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
        style={{
          width: 56,
          height: 56,
          backgroundColor: "rgba(181,147,90,0.12)",
          border: "1.5px solid rgba(181,147,90,0.25)",
        }}
      >
        <TrendingUp size={26} strokeWidth={1.5} style={{ color: "#B5935A" }} />
      </div>

      {/* Headline */}
      <h1
        className="text-[2.4rem] font-bold text-center mb-2 leading-[1.05]"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        Invite songwriters.
        <br />Earn every month.
      </h1>

      {/* Core value prop */}
      <p className="text-[1rem] text-center mb-2" style={{ color: "#666" }}>
        You earn{" "}
        <span className="font-bold" style={{ color: "#1A1A1A" }}>
          ${perReferralDollars} / month
        </span>{" "}
        for every songwriter who joins Pro through your link.
      </p>
      <p
        className="text-[0.8125rem] text-center mb-8 font-medium"
        style={{ color: "#B5935A" }}
      >
        Stacks infinitely. No cap. Paid monthly while they stay.
      </p>

      {/* What this looks like card */}
      <div
        className="rounded-2xl p-4 mb-6"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={14} strokeWidth={1.5} style={{ color: "#B5935A" }} />
          <p className="text-[0.8125rem] font-semibold uppercase tracking-wide" style={{ color: "#999" }}>
            What this looks like
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {projections.map((row) => (
            <StatRow
              key={row.people}
              people={row.people}
              monthly={row.monthly}
              yearly={row.yearly}
              highlight={row.highlight}
            />
          ))}
        </div>

        {/* Top-tier emphasis */}
        <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(181,147,90,0.06)" }}>
          <p className="text-[0.875rem] text-center leading-relaxed" style={{ color: "#666" }}>
            Refer{" "}
            <span className="font-bold" style={{ color: "#1A1A1A" }}>
              {headline.people.toLocaleString()} songwriters
            </span>
            {" "}→{" "}
            <span className="font-bold" style={{ color: "#B5935A" }}>
              ${headline.yearly.toLocaleString()} / year
            </span>
            {" "}recurring cash — direct into your account, every month, for as long as they stay.
          </p>
        </div>
      </div>

      {/* Referral link card */}
      <div
        className="rounded-2xl mb-3"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1.5px solid rgba(181,147,90,0.30)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div className="px-4 pt-3 pb-1">
          <p className="text-[0.75rem] font-medium uppercase tracking-wide" style={{ color: "#999" }}>
            Your referral link
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3">
          <p
            className="flex-1 text-[0.9375rem] font-medium truncate"
            style={{ color: referralLink ? "#1A1A1A" : "#999", fontFamily: "monospace" }}
          >
            {referralLink ?? "Generating your link…"}
          </p>
          <button
            onClick={handleCopy}
            disabled={!fullLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 flex-shrink-0 disabled:opacity-50"
            style={{
              backgroundColor: copied ? "rgba(181,147,90,0.12)" : "rgba(0,0,0,0.04)",
              color: copied ? "#B5935A" : "#666",
              border: copied ? "1px solid rgba(181,147,90,0.25)" : "1px solid transparent",
            }}
            aria-label="Copy referral link"
          >
            {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Rules summary */}
      <p className="text-[0.75rem] text-center mb-6" style={{ color: "#999" }}>
        Direct referrals only · 30-day payout hold · Payouts begin when referral goes Pro
      </p>

      {/* Copy + Start CTA */}
      <GoldButton onClick={handleContinue}>
        Start my first song →
      </GoldButton>

      <button
        onClick={handleContinue}
        className="text-sm text-center w-full py-4 transition-opacity hover:opacity-70 underline"
        style={{ color: "#999", fontFamily: "var(--font-body)" }}
      >
        Skip for now
      </button>
    </OnboardingShell>
  );
};

export default EarnPage;
