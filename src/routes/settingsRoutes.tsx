import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import RequireAuth from "@/components/auth/RequireAuth";

// ── Account settings + pricing/checkout ───────────────────────────────────
// Settings surfaces are per-user → RequireAuth. Pricing, checkout-return, and
// referral-link landings stay public: a Stripe redirect back or a shared
// referral URL must resolve for a not-yet-authed visitor.

const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const BillingPage = lazy(() => import("@/pages/settings/BillingPage"));
const StoragePage = lazy(() => import("@/pages/settings/StoragePage"));
const ReferralPage = lazy(() => import("@/pages/settings/ReferralPage"));

const PricingUpgradePage = lazy(() => import("@/pages/pricing/UpgradePage"));
const CheckoutSuccessPage = lazy(() => import("@/pages/pricing/CheckoutSuccessPage"));
const ReferralRedirectPage = lazy(() => import("@/pages/pricing/ReferralRedirectPage"));

export const settingsRoutes = (
  <>
    {/* Settings — per-user, guarded */}
    <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
    <Route path="/settings/billing" element={<RequireAuth><BillingPage /></RequireAuth>} />
    <Route path="/settings/storage" element={<RequireAuth><StoragePage /></RequireAuth>} />
    <Route path="/settings/referral" element={<RequireAuth><ReferralPage /></RequireAuth>} />

    {/* Pricing + checkout — public */}
    <Route path="/upgrade" element={<PricingUpgradePage />} />
    <Route path="/pricing" element={<PricingUpgradePage />} />
    <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
    <Route path="/r/:code" element={<ReferralRedirectPage />} />

    {/* Legacy upgrade link — the old hardcoded page is retired; the server-driven
        pricing page is the one source of plan truth (G1 · MONETIZATION-CONTRACT). */}
    <Route path="/upgrade-old" element={<Navigate to="/upgrade" replace />} />
  </>
);
