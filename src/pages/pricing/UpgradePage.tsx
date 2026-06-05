import { Suspense, lazy, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, ChevronDown, ChevronUp, Gift, Sparkles } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPlanTiers,
  fetchCurrentPlan,
  validateCode,
  centsToDisplay,
  type PlanTier,
  type SubPlan,
  type ValidateCodeResult,
} from "@/lib/pricing/pricingApi";

const CheckoutModal = lazy(() => import("@/components/pricing/CheckoutModal"));

// Feature lists - UI layer supplementing DB data

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "1 complete song workspace",
    "All features (lyrics, voice, chords, notes)",
    "Unlimited collaborators on that song",
    "Version history on that song",
  ],
  starter: [
    "Everything in Free",
    "3 more songs (4 total)",
    "All features on every song",
    "Voice memos on every song",
  ],
  pro: [
    "Everything in Starter",
    "50 songs",
    "100GB voice memo storage",
    "Unlimited exports (PDF, audio)",
    "Priority support",
    "Advanced version history",
    "Founder code: 50% off forever",
  ],
};

const PLAN_MISSING: Record<string, string[]> = {
  free: ["More songs", "Exports"],
  starter: ["More than 4 songs", "Exports", "Founder code discount"],
  pro: [],
};

const PLAN_TAGLINES: Record<string, string> = {
  free: "One song. Full power.",
  starter: "Your first real catalog.",
  pro: "Your complete songwriting business.",
};

// Feature row

const FeatureRow = ({ text, included }: { text: string; included: boolean }) => (
  <div className="flex items-start gap-3 py-1.5">
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
      style={{
        width: 20, height: 20,
        backgroundColor: included ? "rgba(83,171,139,0.12)" : "rgba(0,0,0,0.05)",
      }}
    >
      {included
        ? <Check size={11} strokeWidth={2.5} style={{ color: "#53AB8B" }} />
        : <X size={11} strokeWidth={2} style={{ color: "#CCC" }} />
      }
    </div>
    <span
      className="text-sm leading-snug"
      style={{ color: included ? "#1A1A1A" : "#BBB" }}
    >
      {text}
    </span>
  </div>
);

// Referred banner

const ReferredBanner = ({ referrerName }: { referrerName?: string }) => (
  <div
    className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-6"
    style={{
      backgroundColor: "rgba(181,147,90,0.10)",
      border: "1.5px solid rgba(181,147,90,0.30)",
    }}
  >
    <Gift size={18} strokeWidth={1.5} style={{ color: "#B5935A", flexShrink: 0 }} />
    <p className="text-sm leading-snug" style={{ color: "#1A1A1A" }}>
      {referrerName
        ? <><span style={{ fontWeight: 600 }}>{referrerName}</span> invited you. </>
        : "You were referred. "}
      <span style={{ color: "#B5935A", fontWeight: 600 }}>50% off Pro is yours</span>
      {" "}- $49/month instead of $100.
    </p>
  </div>
);

// Pricing card

interface PricingCardProps {
  tier: PlanTier;
  isCurrentPlan: boolean;
  isReferred: boolean;
  codeResult: ValidateCodeResult | null;
  isLoading: boolean;
  onSelect: () => void;
}

const PricingCard = ({
  tier,
  isCurrentPlan,
  isReferred,
  codeResult,
  isLoading,
  onSelect,
}: PricingCardProps) => {
  const features = PLAN_FEATURES[tier.key] ?? [];
  const missing = PLAN_MISSING[tier.key] ?? [];
  const tagline = PLAN_TAGLINES[tier.key] ?? "";

  // Price logic
  const isPro = tier.key === "pro";
  const showDiscount = isPro && (isReferred || codeResult?.kind === "founder" || codeResult?.kind === "member_referral");
  const effectiveCents = showDiscount ? (codeResult?.effectiveCents ?? 4900) : tier.monthlyCents;
  const isHighlighted = isPro;
  const isFree = tier.monthlyCents === 0;

  // CTA copy
  let ctaLabel = `Get ${tier.displayName}`;
  if (isFree) ctaLabel = "Your current plan";
  else if (isCurrentPlan) ctaLabel = "Current plan";
  else if (isPro && showDiscount) ctaLabel = `Go Pro - ${centsToDisplay(effectiveCents)}/month`;
  else if (isPro) ctaLabel = `Go Pro - ${centsToDisplay(tier.monthlyCents)}/month`;
  else ctaLabel = `Start for ${centsToDisplay(tier.monthlyCents)}/month`;

  return (
    <div
      className="rounded-2xl p-5 mb-4"
      style={{
        backgroundColor: isHighlighted ? "#FFFFFF" : "#FFFFFF",
        border: isHighlighted
          ? "1.5px solid #B5935A"
          : "1px solid rgba(0,0,0,0.08)",
        boxShadow: isHighlighted
          ? "0 4px 24px rgba(181,147,90,0.18)"
          : "0 2px 12px rgba(0,0,0,0.06)",
        position: "relative",
      }}
    >
      {/* Most popular chip */}
      {isHighlighted && (
        <span
          className="absolute -top-3 left-5 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: "#B5935A",
            color: "#FFFFFF",
          }}
        >
          <Sparkles size={10} strokeWidth={2} />
          Most popular
        </span>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#999" }}>
          {tier.displayName}
        </p>
        {isPro && showDiscount && (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "rgba(181,147,90,0.12)", color: "#B5935A" }}
          >
            50% off
          </span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2 mb-1">
        {showDiscount && (
          <del className="text-base" style={{ color: "#CCC" }}>
            {centsToDisplay(tier.monthlyCents)}/mo
          </del>
        )}
        <p
          className="font-bold"
          style={{
            fontSize: isFree ? "1.5rem" : "1.875rem",
            color: "#1A1A1A",
            fontFamily: "var(--font-display)",
            lineHeight: 1,
          }}
        >
          {isFree ? "Free" : `${centsToDisplay(effectiveCents)}`}
          {!isFree && <span className="text-base font-normal" style={{ color: "#666" }}>/mo</span>}
        </p>
      </div>

      {/* Tagline */}
      <p className="text-sm mb-4" style={{ color: "#666" }}>
        {tagline}
      </p>

      {/* Divider */}
      <div className="h-px mb-4" style={{ backgroundColor: "rgba(0,0,0,0.06)" }} />

      {/* Features */}
      <div className="mb-5">
        {features.map((f) => <FeatureRow key={f} text={f} included={true} />)}
        {missing.map((f) => <FeatureRow key={f} text={f} included={false} />)}
      </div>

      {/* CTA */}
      {isFree || isCurrentPlan ? (
        <div
          className="w-full py-3 rounded-full text-center text-sm font-medium"
          style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "#999" }}
        >
          {ctaLabel}
        </div>
      ) : (
        <GoldButton loading={isLoading} onClick={onSelect}>
          {ctaLabel}
        </GoldButton>
      )}
    </div>
  );
};

// Main page

const UpgradePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL state
  const refCode = searchParams.get("ref");
  const source = searchParams.get("source"); // "song_gate" | "settings" | direct

  // Data state
  const [tiers, setTiers] = useState<PlanTier[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubPlan>("free");
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Code state
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeResult, setCodeResult] = useState<ValidateCodeResult | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Referral state (from URL or validated code)
  const isReferred = !!refCode || codeResult?.kind === "member_referral";
  const referrerName = codeResult?.referrerDisplayName ?? codeResult?.founderDisplayName ?? undefined;

  // Checkout state
  const [checkoutTierKey, setCheckoutTierKey] = useState<string | null>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    Promise.all([fetchPlanTiers(), fetchCurrentPlan()])
      .then(([tierData, plan]) => {
        setTiers(tierData);
        setCurrentPlan(plan);
      })
      .catch(console.error)
      .finally(() => setIsLoadingData(false));
  }, []);

  // Pre-validate referral code from URL
  useEffect(() => {
    if (!refCode) return;
    validateCode(refCode, "pro")
      .then((result) => {
        if (result.kind !== "invalid") setCodeResult(result);
      })
      .catch(() => {});
  }, [refCode]);

  const handleValidateCode = async () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (!trimmed) return;
    setIsValidatingCode(true);
    setCodeError(null);
    setCodeResult(null);
    try {
      const result = await validateCode(trimmed, "pro");
      setCodeResult(result);
      if (result.kind === "invalid") {
        setCodeError(
          result.reason === "wrong_plan"
            ? "Codes only work on the Pro plan."
            : result.reason === "already_attributed"
            ? "You've already applied a code to your account."
            : result.reason === "self"
            ? "You can't use your own code."
            : "That code didn't work. Check it and try again."
        );
      }
    } catch {
      setCodeError("We couldn't validate the code. Check your connection.");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSelectTier = async (tier: PlanTier) => {
    if (tier.monthlyCents === 0 || currentPlan === tier.key) return;

    setCheckoutTierKey(tier.key);
    setIsLoadingCheckout(true);
    setCheckoutError(null);

    try {
      // Auth gate — embedded checkout requires a signed-in user JWT.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const intent = {
          tierKey: tier.key,
          code: codeInput.trim() || refCode || null,
          ref: refCode || null,
          source: source || null,
        };
        sessionStorage.setItem("cog:pending-checkout", JSON.stringify(intent));
        navigate("/auth/login");
        return;
      }

      const { createCheckout } = await import("@/lib/pricing/pricingApi");
      const effectiveCode = codeResult?.kind !== "invalid" ? codeInput.trim() : null;
      const finalCode = effectiveCode || refCode || null;
      const returnUrl = `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

      const result = await createCheckout(tier.key, finalCode, returnUrl);

      if (result.ignoredReferrer) {
        console.warn("[checkout] referrer code was ignored for this tier");
      }

      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("No checkout URL or client secret returned.");
      }
    } catch (err) {
      console.error("[checkout] failed", err);
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const gateMessages: Record<string, string> = {
    song_gate_free: "Your first song proved the workspace. Ready to start the next one?",
    song_gate_starter: "You've filled your Starter catalog. Time to go Pro.",
  };
  const gateMessage = source ? gateMessages[source] : null;

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#FAFAF6", paddingBottom: 96 }}
    >
      <BackHeader label="Back" />

      <div
        className="relative flex flex-col flex-1 px-5 pt-2"
        style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Gate message - contextual, above headline */}
        {gateMessage && (
          <p
            className="text-sm text-center mb-4 px-2"
            style={{ color: "#B5935A", fontFamily: "var(--font-body)", fontWeight: 500 }}
          >
            {gateMessage}
          </p>
        )}

        {/* Headline - outcome not feature */}
        <h1
          className="text-3xl font-bold text-center mb-2 leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          Ready to build your catalog?
        </h1>
        <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: "#666" }}>
          Free proves the workspace.{" "}
          <span style={{ color: "#1A1A1A", fontWeight: 500 }}>Pro becomes your creative business.</span>
        </p>

        {/* Referred banner */}
        {isReferred && <ReferredBanner referrerName={referrerName} />}

        {/* Checkout error */}
        {checkoutError && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm text-center"
            style={{ backgroundColor: "rgba(224,84,64,0.08)", color: "#E05440", border: "1px solid rgba(224,84,64,0.20)" }}
            role="alert"
          >
            {checkoutError}
          </div>
        )}

        {/* Pricing cards */}
        {isLoadingData ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ backgroundColor: "rgba(0,0,0,0.05)" }} />
            ))}
          </div>
        ) : (
          tiers.map((tier) => (
            <PricingCard
              key={tier.key}
              tier={tier}
              isCurrentPlan={currentPlan === tier.key || (currentPlan === "founder_pro" && tier.key === "pro")}
              isReferred={isReferred && tier.key === "pro"}
              codeResult={tier.key === "pro" ? codeResult : null}
              isLoading={isLoadingCheckout && checkoutTierKey === tier.key}
              onSelect={() => handleSelectTier(tier)}
            />
          ))
        )}

        {/* Founder code entry - only shown if not already referred */}
        {!isReferred && (
          <div className="mb-6">
            <button
              onClick={() => setShowCodeInput(!showCodeInput)}
              className="flex items-center gap-1.5 text-sm w-full justify-center transition-opacity hover:opacity-70 py-2"
              style={{ color: "#B5935A" }}
            >
              Have a founder code?
              {showCodeInput
                ? <ChevronUp size={14} strokeWidth={2} />
                : <ChevronDown size={14} strokeWidth={2} />
              }
            </button>

            {showCodeInput && (
              <div className="mt-3">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value.toUpperCase());
                      setCodeError(null);
                      setCodeResult(null);
                    }}
                    placeholder="FOUNDER-XXXXXX"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{
                      backgroundColor: "#FFFFFF",
                      border: "1.5px solid rgba(0,0,0,0.10)",
                      color: "#1A1A1A",
                      fontFamily: "monospace",
                    }}
                  />
                  <button
                    onClick={handleValidateCode}
                    disabled={!codeInput.trim() || isValidatingCode}
                    className="px-4 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
                    style={{ backgroundColor: "#B5935A", minWidth: 72 }}
                  >
                    {isValidatingCode ? "..." : "Apply"}
                  </button>
                </div>

                {/* Code feedback */}
                {codeResult?.kind === "founder" && (
                  <p className="text-xs font-medium" style={{ color: "#53AB8B" }}>
                    Founder code applied - Pro is now $49/month for you.
                  </p>
                )}
                {codeResult?.kind === "member_referral" && (
                  <p className="text-xs font-medium" style={{ color: "#53AB8B" }}>
                    Referral code applied - 50% off Pro is yours.
                  </p>
                )}
                {codeError && (
                  <p className="text-xs" style={{ color: "#E05440" }} role="alert">
                    {codeError}
                  </p>
                )}

                <p className="text-xs mt-2" style={{ color: "#999" }}>
                  Founder codes apply to Pro only, not Starter.
                </p>
              </div>
            )}
          </div>
        )}

        {/* "Keep current plan" - never shaming */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-center w-full py-3 transition-opacity hover:opacity-70"
          style={{ color: "#999", fontFamily: "var(--font-body)" }}
        >
          Keep my current plan
        </button>
      </div>

      {/* Checkout modal */}
      {clientSecret && (
        <Suspense fallback={<div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(26,26,26,0.80)" }} />}>
          <CheckoutModal
            clientSecret={clientSecret}
            onClose={() => { setClientSecret(null); setCheckoutTierKey(null); }}
          />
        </Suspense>
      )}

      <BottomNav active="settings" />
    </div>
  );
};

export default UpgradePage;
