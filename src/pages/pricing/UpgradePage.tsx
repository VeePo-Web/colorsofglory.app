import { Suspense, lazy, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, X, ChevronDown, ChevronUp, Gift, Sparkles } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import { getSessionUser } from "@/integrations/cog/auth";
import { preloadOnIdle } from "@/lib/nav/preloadOnIdle";
import {
  buildEmbeddedCheckoutReturnUrl,
  createCheckoutSession,
  fetchPlanTiers,
  fetchCurrentPlan,
  validateCode,
  centsToDisplay,
  paymentErrorToMessage,
  type PlanKey,
  type PlanTier,
  type SubPlan,
  type ValidateCodeResult,
} from "@/lib/pricing/pricingApi";

const CheckoutModal = lazy(() => import("@/components/pricing/CheckoutModal"));

// Feature copy - qualitative phrasing lives here; every NUMBER (song limits,
// storage) is read from the server plan_tiers row so the page can never
// contradict what billing actually enforces (money truth: server wins).

const formatStorage = (bytes: number): string => {
  if (!bytes || bytes <= 0) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : Number(gb.toFixed(1))}GB`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
};

const songCount = (n: number): string => (n === 1 ? "1 song" : `${n} songs`);

const planFeatures = (tier: PlanTier, tiers: PlanTier[]): string[] => {
  const freeTier = tiers.find((t) => t.key === "free");
  const storage = formatStorage(tier.storageBytesIncluded);
  if (tier.key === "free") {
    return [
      tier.ownedSongLimit === 1
        ? "1 complete song workspace"
        : `${tier.ownedSongLimit} complete song workspaces`,
      "All features (lyrics, voice, chords, notes)",
      "Unlimited collaborators on that song",
      "Version history on that song",
    ];
  }
  if (tier.key === "starter") {
    const more = freeTier ? tier.ownedSongLimit - freeTier.ownedSongLimit : tier.ownedSongLimit;
    return [
      "Everything in Free",
      `${songCount(more).replace("song", "more song")} (${tier.ownedSongLimit} total)`,
      "All features on every song",
      "Voice memos on every song",
    ];
  }
  return [
    "Everything in Starter",
    songCount(tier.ownedSongLimit),
    ...(storage ? [`${storage} voice memo storage`] : []),
    "Unlimited exports (PDF, audio)",
    "Priority support",
    "Advanced version history",
    ...(tier.allowsMemberReferral ? ["50% off with referral code (limited time)"] : []),
  ];
};

const planMissing = (tier: PlanTier): string[] => {
  if (tier.key === "free") return ["More songs", "Exports"];
  if (tier.key === "starter") {
    return [`More than ${songCount(tier.ownedSongLimit)}`, "Exports", "Founder code discount"];
  }
  return [];
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
      <span style={{ color: "#B5935A", fontWeight: 600 }}>50% off Pro with your referral code</span>
      {" "}- $49/month instead of $100. Limited time.
    </p>
  </div>
);

const codeErrorMessage = (reason?: string): string => {
  if (reason === "wrong_plan") return "Codes only work on the Pro plan.";
  if (reason === "already_attributed") return "You've already applied a code to your account.";
  if (reason === "self") return "You can't use your own code.";
  if (reason === "expired") return "That code is no longer active.";
  if (reason === "network_error") return "We couldn't validate the code. Check your connection.";
  return "That code didn't work. Check it and try again.";
};

// Pricing card

interface PricingCardProps {
  tier: PlanTier;
  allTiers: PlanTier[];
  isCurrentPlan: boolean;
  isReferred: boolean;
  codeResult: ValidateCodeResult | null;
  isLoading: boolean;
  onSelect: () => void;
}

const PricingCard = ({
  tier,
  allTiers,
  isCurrentPlan,
  isReferred,
  codeResult,
  isLoading,
  onSelect,
}: PricingCardProps) => {
  const features = planFeatures(tier, allTiers);
  const missing = planMissing(tier);
  const tagline = PLAN_TAGLINES[tier.key] ?? "";

  // Price logic
  const isPro = tier.key === "pro";
  const showDiscount = isPro && (isReferred || codeResult?.kind === "founder" || codeResult?.kind === "member_referral");
  const effectiveCents = showDiscount ? (codeResult?.effectiveCents ?? 4900) : tier.monthlyCents;
  const isHighlighted = isPro;
  const isFree = tier.monthlyCents === 0;

  // CTA copy
  let ctaLabel = `Get ${tier.displayName}`;
  if (isFree && isCurrentPlan) ctaLabel = "Your current plan";
  else if (isFree) ctaLabel = "Included";
  else if (isCurrentPlan) ctaLabel = "Current plan";
  else if (isPro && showDiscount) ctaLabel = `Go Pro - ${centsToDisplay(effectiveCents, tier.currency)}/month`;
  else if (isPro) ctaLabel = `Go Pro - ${centsToDisplay(tier.monthlyCents, tier.currency)}/month`;
  else ctaLabel = `Start for ${centsToDisplay(tier.monthlyCents, tier.currency)}/month`;

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
            {centsToDisplay(tier.monthlyCents, tier.currency)}/mo
          </del>
        )}
        <p
          className="font-bold"
          aria-label={
            isFree
              ? "Free"
              : `${centsToDisplay(effectiveCents, tier.currency)} per month${showDiscount ? ", discounted from " + centsToDisplay(tier.monthlyCents, tier.currency) : ""}`
          }
          style={{
            fontSize: isFree ? "1.5rem" : "1.875rem",
            color: "#1A1A1A",
            fontFamily: "var(--font-display)",
            lineHeight: 1,
          }}
        >
          {isFree ? "Free" : `${centsToDisplay(effectiveCents, tier.currency)}`}
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
  const [storedRefCode, setStoredRefCode] = useState<string | null>(null);

  // Data state
  const [tiers, setTiers] = useState<PlanTier[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SubPlan>("free");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Code state
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeResult, setCodeResult] = useState<ValidateCodeResult | null>(null);
  const [referralResult, setReferralResult] = useState<ValidateCodeResult | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const referralCode = (refCode ?? storedRefCode ?? "").trim().toUpperCase();

  // Referral state (from URL or validated code)
  const manualDiscountResult = codeResult?.kind !== "invalid" ? codeResult : null;
  const referralDiscountResult = referralResult?.kind !== "invalid" ? referralResult : null;
  const activeDiscountResult = manualDiscountResult ?? referralDiscountResult;
  const isReferred = !!referralDiscountResult;
  const referrerName = referralDiscountResult?.referrerDisplayName ?? referralDiscountResult?.founderDisplayName ?? undefined;

  // Checkout state
  const [checkoutTierKey, setCheckoutTierKey] = useState<string | null>(null);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<{
    planName: string;
    priceLabel: string;
    appliedCode: { kind: "founder" | "member_referral"; label: string } | null;
  } | null>(null);

  useEffect(() => {
    setStoredRefCode(sessionStorage.getItem("cog:referral-code"));
  }, []);

  // Remember what the songwriter was doing so /checkout/success can hand them
  // straight back — a song gate returns to the catalog (to create that second
  // song), settings returns to settings. Set on arrival, consumed on success.
  useEffect(() => {
    const returnTo = source?.startsWith("song_gate")
      ? "/"
      : source === "settings"
      ? "/settings"
      : "/";
    try {
      sessionStorage.setItem("cog:upgrade-return-to", returnTo);
    } catch { /* non-fatal */ }
  }, [source]);

  // Warm the embedded-checkout chunk (Stripe UI) while the songwriter reads the
  // pricing, so picking a plan opens the payment surface instantly instead of
  // waiting on a chunk download at the moment of intent. Same import as the
  // lazy() below — Vite dedupes; paired with the Stripe preconnect in index.html.
  useEffect(() => {
    preloadOnIdle(() => import("@/components/pricing/CheckoutModal"));
  }, []);

  // Load data (retryable — a failed plan load must never be a dead end on a
  // money page; the songwriter gets a calm one-tap "Try again").
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDataError(null);
    setIsLoadingData(true);
    Promise.all([fetchPlanTiers(), fetchCurrentPlan()])
      .then(([tierData, plan]) => {
        if (cancelled) return;
        setTiers(tierData);
        setCurrentPlan(plan);
      })
      .catch(() => {
        if (!cancelled) setDataError("Plans are taking longer than usual to load.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false);
      });
    return () => { cancelled = true; };
  }, [loadAttempt]);

  // Pre-validate referral code from URL
  useEffect(() => {
    if (!referralCode) return;
    validateCode(referralCode, "pro")
      .then((result) => {
        setReferralResult(result);
      })
      .catch(() => {});
  }, [referralCode]);

  // Resume a pending checkout after the user signs in.
  useEffect(() => {
    if (isLoadingData || tiers.length === 0) return;
    const raw = sessionStorage.getItem("cog:pending-checkout");
    if (!raw) return;
    let intent: { tierKey: string; code?: string | null; ref?: string | null } | null = null;
    try { intent = JSON.parse(raw); } catch { /* ignore */ }
    if (!intent?.tierKey) return;

    getSessionUser().then((user) => {
      if (!user) return;
      sessionStorage.removeItem("cog:pending-checkout");
      const tier = tiers.find((t) => t.key === intent!.tierKey);
      if (!tier) return;
      if (intent!.code) setCodeInput(intent!.code);
      handleSelectTier(tier, intent!.code ?? "", intent!.ref ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingData, tiers]);

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
        setCodeError(codeErrorMessage(result.reason));
      }
    } catch {
      setCodeError("We couldn't validate the code. Check your connection.");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSelectTier = async (
    tier: PlanTier,
    codeOverride = codeInput,
    referralOverride = referralCode
  ) => {
    if (tier.monthlyCents === 0 || currentPlan === tier.key) return;

    setCheckoutTierKey(tier.key);
    setIsLoadingCheckout(true);
    setCheckoutError(null);
    setCheckoutNotice(null);

    try {
      // Auth gate — embedded checkout requires a signed-in user JWT.
      const user = await getSessionUser();
      if (!user) {
        const intent = {
          tierKey: tier.key,
          code: codeOverride.trim() || null,
          ref: referralOverride || null,
          source: source || null,
        };
        sessionStorage.setItem("cog:pending-checkout", JSON.stringify(intent));
        navigate("/auth/login");
        return;
      }

      const typedCode = codeOverride.trim().toUpperCase();
      const checkoutReferralCode = referralOverride.trim().toUpperCase();
      let manualCode: string | null = null;

      if (tier.key === "pro" && typedCode) {
        const validation = await validateCode(typedCode, "pro");
        setCodeResult(validation);
        if (validation.kind === "invalid") {
          const message = codeErrorMessage(validation.reason);
          setCodeError(message);
          throw new Error(message);
        }
        manualCode = typedCode;
      }

      const canUseReferralCode = !manualCode && referralResult?.kind !== "invalid" && !!checkoutReferralCode;
      const result = await createCheckoutSession({
        planKey: tier.key as Exclude<PlanKey, "free">,
        code: manualCode,
        referrerCode: canUseReferralCode ? checkoutReferralCode : null,
        returnUrl: buildEmbeddedCheckoutReturnUrl(),
      });

      if (result.ignoredReferrer) {
        setCheckoutNotice("Your founder code was applied. The referral link will stay unused.");
      }

      if (result.ignoredCode) {
        setCheckoutNotice("Codes apply to Pro only, so this checkout will continue at regular pricing.");
      }

      if (result.clientSecret) {
        // Summarize exactly what this session charges, from server-validated
        // numbers (tier row + validate-code result) — shown in the modal header.
        const discounted =
          result.appliedCodeKind !== "none"
            ? activeDiscountResult?.effectiveCents ?? Math.round(tier.monthlyCents / 2)
            : null;
        const cents = discounted ?? tier.monthlyCents;
        setCheckoutSummary({
          planName: tier.displayName,
          priceLabel: `${centsToDisplay(cents, tier.currency)}/month`,
          appliedCode:
            result.appliedCodeKind === "founder"
              ? { kind: "founder", label: `Founder code applied — ${centsToDisplay(cents, tier.currency)}/month` }
              : result.appliedCodeKind === "member_referral"
              ? { kind: "member_referral", label: `Referral applied — 50% off, ${centsToDisplay(cents, tier.currency)}/month` }
              : null,
        });
        setClientSecret(result.clientSecret);
      } else if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("No checkout URL or client secret returned.");
      }
    } catch (err) {
      setCheckoutError(paymentErrorToMessage(err));
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  const gateMessages: Record<string, string> = {
    song_gate: "Your first song proved the workspace. Ready to start the next one?",
    song_gate_free: "Your first song proved the workspace. Ready to start the next one?",
    song_gate_starter: "You've filled your Starter catalog. Time to go Pro.",
    storage: "Your songs are safe. More room keeps every new idea safe too.",
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

        {checkoutNotice && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-sm text-center"
            style={{ backgroundColor: "rgba(83,171,139,0.08)", color: "#3E8F71", border: "1px solid rgba(83,171,139,0.20)" }}
            role="status"
          >
            {checkoutNotice}
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
          <>
            {dataError && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm text-center"
                style={{ backgroundColor: "rgba(224,84,64,0.08)", color: "#E05440", border: "1px solid rgba(224,84,64,0.20)" }}
                role="alert"
              >
                {dataError}{" "}
                <button
                  onClick={() => setLoadAttempt((n) => n + 1)}
                  className="font-semibold underline underline-offset-2"
                  style={{ color: "#E05440" }}
                >
                  Try again
                </button>
              </div>
            )}
            {tiers.map((tier) => (
              <PricingCard
                key={tier.key}
                tier={tier}
                allTiers={tiers}
                isCurrentPlan={currentPlan === tier.key || (currentPlan === "founder_pro" && tier.key === "pro")}
                isReferred={!!activeDiscountResult && tier.key === "pro"}
                codeResult={tier.key === "pro" ? activeDiscountResult : null}
                isLoading={isLoadingCheckout && checkoutTierKey === tier.key}
                onSelect={() => handleSelectTier(tier)}
              />
            ))}
          </>
        )}

        {/* Founder code entry */}
        {currentPlan !== "founder_pro" && (
          <div className="mb-6">
            <button
              onClick={() => setShowCodeInput(!showCodeInput)}
              className="flex items-center gap-1.5 text-sm w-full justify-center transition-opacity hover:opacity-70 py-2"
              style={{ color: "#B5935A" }}
            >
              {referralCode ? "Have a founder code instead?" : "Have a founder or referral code?"}
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
                    placeholder="FOUNDER-XXXXXX or REFERRAL"
                    aria-label="Founder or referral code"
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
                    Referral code applied - 50% off Pro is yours. Limited time.
                  </p>
                )}
                {codeError && (
                  <p className="text-xs" style={{ color: "#E05440" }} role="alert">
                    {codeError}
                  </p>
                )}

                <p className="text-xs mt-2" style={{ color: "#999" }}>
                  Founder and referral codes apply to Pro only, not Starter.
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
            planName={checkoutSummary?.planName}
            priceLabel={checkoutSummary?.priceLabel}
            appliedCode={checkoutSummary?.appliedCode}
            onClose={() => { setClientSecret(null); setCheckoutTierKey(null); setCheckoutSummary(null); }}
          />
        </Suspense>
      )}

      <BottomNav active="settings" />
    </div>
  );
};

export default UpgradePage;
