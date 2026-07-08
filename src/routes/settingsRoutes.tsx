import { lazy } from "react";
import { Route } from "react-router-dom";
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
const UpgradePage = lazy(() => import("@/pages/UpgradePage")); // legacy placeholder

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

    {/* Legacy upgrade placeholder (kept for any existing links) */}
    <Route path="/upgrade-old" element={<UpgradePage />} />
  </>
);
