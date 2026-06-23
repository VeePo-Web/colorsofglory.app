import { lazy } from "react";
import { Route } from "react-router-dom";

// ── Admin routing (internal-only) ─────────────────────────────────────────
// Self-contained so admin work never has to edit App.tsx (which other agents
// rewrite). Add every new /admin/* page HERE. App.tsx renders {adminRoutes}
// inside its <Routes>; the shared <Suspense> in App.tsx covers these lazies.
const RequireAdmin = lazy(() => import("@/components/admin/RequireAdmin"));
const AdminHomePage = lazy(() => import("@/pages/admin/AdminHomePage"));
const AdminFoundersPage = lazy(() => import("@/pages/admin/FoundersPage"));
const AdminFounderDetailPage = lazy(() => import("@/pages/admin/FounderDetailPage"));
const AdminCodesPage = lazy(() => import("@/pages/admin/CodesPage"));
const AdminPayoutsPage = lazy(() => import("@/pages/admin/PayoutsPage"));
const AdminFinancePage = lazy(() => import("@/pages/admin/FinancePage"));
const AdminWebhookOpsPage = lazy(() => import("@/pages/admin/WebhookOpsPage"));
const AdminPayoutBatchesPage = lazy(() => import("@/pages/admin/PayoutBatchesPage"));
const AdminFraudPage = lazy(() => import("@/pages/admin/FraudPage"));
const AdminReferralsPage = lazy(() => import("@/pages/admin/ReferralsPage"));
const AdminAuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage"));
const AdminAttributionPage = lazy(() => import("@/pages/admin/AttributionPage"));

export const adminRoutes = (
  <>
    <Route path="/admin" element={<RequireAdmin><AdminHomePage /></RequireAdmin>} />
    <Route path="/admin/founders" element={<RequireAdmin><AdminFoundersPage /></RequireAdmin>} />
    <Route path="/admin/founders/:id" element={<RequireAdmin><AdminFounderDetailPage /></RequireAdmin>} />
    <Route path="/admin/codes" element={<RequireAdmin><AdminCodesPage /></RequireAdmin>} />
    <Route path="/admin/payouts" element={<RequireAdmin><AdminPayoutsPage /></RequireAdmin>} />
    <Route path="/admin/payouts/batches" element={<RequireAdmin><AdminPayoutBatchesPage /></RequireAdmin>} />
    <Route path="/admin/finance" element={<RequireAdmin><AdminFinancePage /></RequireAdmin>} />
    <Route path="/admin/webhooks" element={<RequireAdmin><AdminWebhookOpsPage /></RequireAdmin>} />
    <Route path="/admin/fraud" element={<RequireAdmin><AdminFraudPage /></RequireAdmin>} />
    <Route path="/admin/referrals" element={<RequireAdmin><AdminReferralsPage /></RequireAdmin>} />
    <Route path="/admin/attribution" element={<RequireAdmin><AdminAttributionPage /></RequireAdmin>} />
    <Route path="/admin/audit" element={<RequireAdmin><AdminAuditLogPage /></RequireAdmin>} />
  </>
);
