import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import BackHeader from "@/components/cog/BackHeader";
import BottomNav from "@/components/cog/BottomNav";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import {
  cancelCurrentSubscription,
  centsToDisplay,
  fetchBillingOverview,
  getBillingPortalUrl,
  paymentErrorToMessage,
  type BillingOverview,
  type SubPlan,
} from "@/lib/pricing/pricingApi";

const planLabel: Record<SubPlan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  founder_pro: "Founder Pro",
};

function formatDate(value: string | null): string {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const BillingSkeleton = () => (
  <div className="space-y-4" aria-label="Loading billing">
    <div className="h-40 rounded-2xl bg-[rgba(28,26,23,0.05)]" />
    <div className="h-24 rounded-2xl bg-[rgba(28,26,23,0.05)]" />
    <div className="h-14 rounded-full bg-[rgba(184,149,58,0.14)]" />
  </div>
);

const BillingPage = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingOverview()
      .then(setOverview)
      .catch((err) => setError(paymentErrorToMessage(err)))
      .finally(() => setIsLoading(false));
  }, []);

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    setError(null);
    try {
      const url = await getBillingPortalUrl(`${window.location.origin}/settings/billing`);
      window.location.assign(url);
    } catch (err) {
      setError(paymentErrorToMessage(err));
      setIsOpeningPortal(false);
    }
  };

  const handleCancelAtPeriodEnd = async () => {
    setIsCancelling(true);
    setError(null);
    setNotice(null);
    try {
      await cancelCurrentSubscription(true);
      setShowCancelConfirm(false);
      setNotice("Your plan will stay active through the current billing period.");
      setOverview((current) => current ? {
        ...current,
        subscription: current.subscription
          ? { ...current.subscription, status: "active" }
          : current.subscription,
      } : current);
    } catch (err) {
      setError(paymentErrorToMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const subscription = overview?.subscription ?? null;
  const isPaidPlan = overview?.currentPlan === "starter" || overview?.currentPlan === "pro" || overview?.currentPlan === "founder_pro";
  const hasSubscription = !!subscription && isPaidPlan;

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 48% at 50% 86%, rgba(184,149,58,0.13) 0%, transparent 64%)",
        }}
      />

      <BackHeader label="Settings" to="/settings" />

      <main
        className="relative mx-auto flex min-h-screen w-full flex-col px-6 pb-36 pt-2"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <div className="mb-6 flex justify-center">
          <CogBrand variant="stacked" size="sm" />
        </div>

        <h1
          className="mb-2 text-3xl font-semibold"
          style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)", lineHeight: 1.1 }}
        >
          Billing
        </h1>
        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
          Manage the plan that keeps your songs protected, connected, and ready to grow.
        </p>

        {isLoading ? (
          <BillingSkeleton />
        ) : !overview?.authenticated ? (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
          >
            <p className="mb-2 text-lg font-semibold" style={{ color: "var(--cog-charcoal)" }}>
              Sign in to manage billing.
            </p>
            <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
              Billing actions are connected to your songwriter account.
            </p>
            <GoldButton onClick={() => navigate("/auth/login")}>Sign in</GoldButton>
          </div>
        ) : (
          <>
            {error && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: "rgba(224,84,64,0.08)", color: "#E05440", border: "1px solid rgba(224,84,64,0.20)" }}
                role="alert"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                className="mb-4 rounded-xl px-4 py-3 text-sm"
                style={{ backgroundColor: "rgba(83,171,139,0.08)", color: "#3E8F71", border: "1px solid rgba(83,171,139,0.20)" }}
                role="status"
              >
                {notice}
              </div>
            )}

            <section
              className="mb-4 rounded-2xl p-5"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1.5px solid var(--cog-border-gold)",
                boxShadow: "0 4px 20px rgba(184,149,58,0.12)",
              }}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--cog-warm-gray)" }}>
                    Current plan
                  </p>
                  <p className="text-3xl font-semibold" style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-display)" }}>
                    {planLabel[overview.currentPlan]}
                  </p>
                </div>
                <div
                  className="flex items-center justify-center rounded-2xl"
                  style={{ width: 48, height: 48, backgroundColor: "rgba(184,149,58,0.12)" }}
                >
                  <CreditCard size={21} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} />
                </div>
              </div>

              {hasSubscription ? (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.62)" }}>
                    <span className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>Monthly price</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
                      {centsToDisplay(subscription.unitAmountCents, subscription.currency)}/mo
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.62)" }}>
                    <span className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>Status</span>
                    <span className="text-sm font-semibold capitalize" style={{ color: "var(--cog-charcoal)" }}>
                      {subscription.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.62)" }}>
                    <span className="flex items-center gap-2 text-sm" style={{ color: "var(--cog-warm-gray)" }}>
                      <CalendarDays size={14} />
                      Renews
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                  You are on the free first-song plan. Upgrade when you are ready to turn one room into a catalog.
                </p>
              )}
            </section>

            <section
              className="mb-4 rounded-2xl p-5"
              style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
            >
              <div className="mb-4 flex items-start gap-3">
                <ShieldCheck size={20} strokeWidth={1.7} style={{ color: "var(--cog-gold)", flexShrink: 0 }} />
                <div>
                  <p className="mb-1 text-sm font-semibold" style={{ color: "var(--cog-charcoal)" }}>
                    Stripe-secured billing
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                    Card changes, invoices, and payment methods open in the secure billing portal.
                  </p>
                </div>
              </div>

              {hasSubscription ? (
                <GoldButton onClick={handleOpenPortal} loading={isOpeningPortal} loadingText="Opening portal...">
                  Manage billing
                </GoldButton>
              ) : (
                <GoldButton onClick={() => navigate("/upgrade?source=settings")}>
                  View plans
                </GoldButton>
              )}
            </section>

            {hasSubscription && (
              <section
                className="rounded-2xl p-5"
                style={{ backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
              >
                <button
                  onClick={() => setShowCancelConfirm((value) => !value)}
                  className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-sm font-semibold transition-opacity hover:opacity-75"
                  style={{ color: "#B43C3C" }}
                >
                  <span className="flex items-center gap-2">
                    <XCircle size={17} strokeWidth={1.7} />
                    Cancel subscription
                  </span>
                </button>

                {showCancelConfirm && (
                  <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "rgba(180,60,60,0.06)" }}>
                    <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--cog-warm-gray)" }}>
                      This schedules cancellation at the end of the current billing period. Your songs stay safe, and access continues until then.
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={handleCancelAtPeriodEnd}
                        disabled={isCancelling}
                        className="min-h-11 rounded-full px-4 text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-45"
                        style={{ backgroundColor: "#B43C3C" }}
                      >
                        {isCancelling ? "Scheduling..." : "Cancel at period end"}
                      </button>
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        className="min-h-11 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-75"
                        style={{ color: "var(--cog-warm-gray)" }}
                      >
                        Keep my plan
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <BottomNav active="settings" />
    </div>
  );
};

export default BillingPage;
