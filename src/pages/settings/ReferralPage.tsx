import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import { fetchReferralStats, centsToDisplay, type ReferralStats } from "@/lib/pricing/pricingApi";
import { setMyPayoutMethod } from "@/integrations/cog/referrals";
import ShareReferralSheet from "@/components/referral/ShareReferralSheet";
import VanityCodeClaim from "@/components/referral/VanityCodeClaim";

/** Quiet loading placeholder — pulses unless the user prefers reduced motion. */
const Shimmer = ({ width, height = 14 }: { width: number | string; height?: number }) => (
  <span
    className="inline-block rounded-md animate-pulse motion-reduce:animate-none"
    style={{ width, height, backgroundColor: "rgba(28,26,23,0.08)" }}
    aria-hidden="true"
  />
);

const ReferralPage = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [payoutEmail, setPayoutEmail] = useState("");
  const [editingPayout, setEditingPayout] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    fetchReferralStats()
      .then(setStats)
      .catch(() => {/* keep null - use placeholder UI */})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSavePayout = async () => {
    const email = payoutEmail.trim();
    if (email.length < 3) return;
    setSavingPayout(true);
    try {
      await setMyPayoutMethod({ method: "paypal", email });
      const fresh = await fetchReferralStats();
      setStats(fresh);
      setEditingPayout(false);
      toast.success("Payout details saved");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Couldn't save payout details. Please try again.");
    } finally {
      setSavingPayout(false);
    }
  };

  // "Give it forward" — the referrer donates their payout instead of
  // collecting it. COG gives the amount on their behalf; the ledger still
  // batches + reconciles exactly like a cash payout.
  const handleDonatePayout = async () => {
    setSavingPayout(true);
    try {
      await setMyPayoutMethod({ method: "donate" });
      const fresh = await fetchReferralStats();
      setStats(fresh);
      setEditingPayout(false);
      toast.success("Thank you — your earnings will be given forward");
    } catch (err) {
      toast.error((err as Error)?.message ?? "Couldn't save that. Please try again.");
    } finally {
      setSavingPayout(false);
    }
  };

  const referralLink = stats?.link ?? "colorsofglory.app/r/...";
  const fullLink = stats?.link ?? `https://colorsofglory.app/r/...`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink);
    } catch {
      // Fallback for environments without clipboard API
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Sharing goes through the ONE shared surface (ShareReferralSheet) so the
  // warm first-song-free message never diverges from the in-song prompts.

  // After a vanity-code claim the code/link change server-side — refetch so the
  // new /r/<name> flows into the link card and the share sheet immediately.
  const refreshStats = () => {
    fetchReferralStats().then(setStats).catch(() => {/* keep current */});
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
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="text-3xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", lineHeight: 1.1 }}
        >
          Invite songwriters. Earn monthly.
        </h1>
        <p className="text-base mb-8" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
          You earn {centsToDisplay(stats?.perReferralCents ?? 500)}/month while each direct referral stays on Pro.
        </p>

        {/* Recurring earnings — the motivating hero metric, only once it's real */}
        {!isLoading && stats && stats.monthlyRecurringCents > 0 && (
          <div
            className="rounded-2xl p-5 mb-6 text-center"
            style={{
              backgroundColor: "var(--cog-cream-light)",
              border: "1.5px solid var(--cog-border-gold)",
              boxShadow: "0 4px 20px rgba(184,149,58,0.12)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wider mb-1"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              You're earning
            </p>
            <p style={{ fontSize: 44, lineHeight: 1, color: "var(--cog-gold)", fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {centsToDisplay(stats.monthlyRecurringCents)}
              <span style={{ fontSize: 18, color: "var(--cog-warm-gray)" }}>/mo</span>
            </p>
            <p className="text-sm mt-1.5" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
              from {stats.payingCount} active Pro {stats.payingCount === 1 ? "referral" : "referrals"} · recurring every month
            </p>
          </div>
        )}

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
            {isLoading ? (
              <Shimmer width="70%" height={16} />
            ) : (
              <p
                className="flex-1 text-sm truncate"
                style={{
                  color: "var(--cog-charcoal)",
                  fontFamily: "monospace",
                }}
              >
                {referralLink}
              </p>
            )}
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
          {/* Vanity code — memorable /r/<name> links (claim_referral_code RPC) */}
          {!isLoading && (
            <VanityCodeClaim currentCode={stats?.code ?? null} onClaimed={refreshStats} />
          )}
        </div>

        {/* Stats grid - live data from me-referrals */}
        <div className="flex flex-col gap-3 mb-8" aria-busy={isLoading}>
          {([
            [
              { label: "Signups", value: isLoading ? "..." : String(stats?.attributedCount ?? 0) },
              { label: "Active Pro", value: isLoading ? "..." : String(stats?.payingCount ?? 0) },
            ],
            [
              { label: "Pending", value: isLoading ? "..." : centsToDisplay(stats?.earnings.pendingCents ?? 0) },
              { label: "Payable", value: isLoading ? "..." : centsToDisplay(stats?.earnings.payableCents ?? 0) },
            ],
          ] as Array<Array<{label: string; value: string}>>).map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-2 gap-3">
              {row.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 text-center"
                  style={{
                    backgroundColor: "var(--cog-cream-light)",
                    border: "1.5px solid var(--cog-border)",
                  }}
                  role="group"
                  aria-label={isLoading ? `${stat.label} loading` : `${stat.label}: ${stat.value}`}
                >
                  <p
                    className="font-semibold mb-0.5"
                    style={{
                      fontSize: 36,
                      color: "var(--cog-charcoal)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                    }}
                    aria-hidden={isLoading}
                  >
                    {isLoading ? <Shimmer width={48} height={30} /> : stat.value}
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

        {/* Payout method — where earnings get sent. Completes the earn→collect loop. */}
        {!isLoading && stats && (() => {
          const method = stats.payoutMethod.kind;
          const hasEarnings =
            stats.earnings.payableCents + stats.earnings.pendingCents + stats.monthlyRecurringCents > 0;
          // Stay quiet until there's a reason: money in motion, or the referrer chose to edit.
          if (!method && !hasEarnings && !editingPayout) return null;
          const showForm = editingPayout || !method;
          return (
            <div
              className="rounded-2xl p-5 mb-6"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: method ? "1.5px solid var(--cog-border)" : "1.5px solid var(--cog-border-gold)",
              }}
            >
              <p
                className="text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                Where we send your earnings
              </p>
              {method && !editingPayout ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm truncate" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    {method === "donate"
                      ? "Given forward — your earnings become a gift"
                      : (stats.payoutMethod.email ?? "Saved")}
                    {method !== "donate" && (
                      <span style={{ color: "var(--cog-warm-gray)" }}> · {method === "paypal" ? "PayPal" : method}</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setPayoutEmail(stats.payoutMethod.email ?? ""); setEditingPayout(true); }}
                    className="text-sm flex-shrink-0 transition-opacity hover:opacity-70"
                    style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
                  >
                    Change
                  </button>
                </div>
              ) : showForm ? (
                <>
                  {!method && (
                    <p className="text-sm mb-3" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}>
                      Add your PayPal email so we can send what you earn.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="flex-1 rounded-xl px-3 py-2.5 text-sm"
                      style={{
                        backgroundColor: "var(--cog-cream)",
                        border: "1px solid var(--cog-border)",
                        color: "var(--cog-charcoal)",
                        fontFamily: "var(--font-body)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSavePayout}
                      disabled={savingPayout || payoutEmail.trim().length < 3}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white flex-shrink-0 transition-all duration-150 active:scale-95"
                      style={{
                        backgroundColor: "var(--cog-gold)",
                        fontFamily: "var(--font-body)",
                        opacity: savingPayout || payoutEmail.trim().length < 3 ? 0.6 : 1,
                      }}
                    >
                      {savingPayout ? "Saving…" : "Save"}
                    </button>
                  </div>
                  {/* Give it forward — quiet, never an upsell. One tap donates
                      future payouts; changeable any time via "Change". */}
                  <button
                    type="button"
                    onClick={handleDonatePayout}
                    disabled={savingPayout}
                    className="text-xs mt-3 block transition-opacity hover:opacity-70"
                    style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", opacity: savingPayout ? 0.6 : 1 }}
                  >
                    Or give it forward — donate my earnings instead
                  </button>
                  {method && (
                    <button
                      type="button"
                      onClick={() => setEditingPayout(false)}
                      className="text-xs mt-2 transition-opacity hover:opacity-70"
                      style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : null}
            </div>
          );
        })()}

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
          type="button"
          onClick={() => setShareOpen(true)}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70 mb-10"
          style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Share2 size={14} strokeWidth={1.8} />
            Share invite
          </span>
        </button>

        {/* Calm zero-state — no referrals yet is a beginning, not an error */}
        {!isLoading && stats && stats.recentReferrals.length === 0 && (
          <div
            className="rounded-2xl p-5 mb-6 text-center"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)", lineHeight: 1.6 }}>
              Share your link with a songwriter you love writing with.
              <br />
              Their first song is free — you earn when they go Pro.
            </p>
          </div>
        )}

        {/* Recent activity — anonymized momentum feed so shares feel like they land */}
        {!isLoading && stats && stats.recentReferrals.length > 0 && (
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1.5px solid var(--cog-border)" }}
          >
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              Recent activity
            </h2>
            <ul className="flex flex-col gap-3">
              {stats.recentReferrals.slice(0, 6).map((r, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: r.isPaying ? "var(--cog-gold)" : "var(--cog-muted)" }}
                  />
                  <p className="flex-1 text-sm" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}>
                    A songwriter joined
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={
                      r.isPaying
                        ? { backgroundColor: "rgba(184,149,58,0.12)", color: "var(--cog-gold)" }
                        : { color: "var(--cog-warm-gray)" }
                    }
                  >
                    {r.isPaying ? "Active Pro" : "Joined"}
                  </span>
                  {r.referredAt && (
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
                      {new Date(r.referredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

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
              `You earn ${centsToDisplay(stats?.perReferralCents ?? 500)}/month per active Pro referral.`,
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
      <BottomNav active="settings" />

      {/* The ONE share surface — same sheet the in-song prompts open */}
      <ShareReferralSheet open={shareOpen} onClose={() => setShareOpen(false)} link={stats?.link ?? null} />
    </div>
  );
};

export default ReferralPage;
