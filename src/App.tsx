import { Suspense, lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PracticePlayerProvider } from "@/components/practice/PracticePlayerContext";

// ── Foundation providers (A4) ─────────────────────────────────────────────
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { OutboxProvider } from "@/lib/outbox/OutboxContext";
import { isPreviewUnlocked } from "@/lib/preview/previewUnlock";

// ── Shell + nav chrome (A5) ───────────────────────────────────────────────
import BrandedSkeleton from "@/components/shell/BrandedSkeleton";
import SongSurfaceTracker from "@/components/nav/SongSurfaceTracker";
import RouteAnnouncer from "@/components/nav/RouteAnnouncer";

// ── Route groups (A5) — every path lives in one of these fragments ─────────
import { authRoutes } from "@/routes/authRoutes";
import { onboardingRoutes } from "@/routes/onboardingRoutes";
import { songRoutes } from "@/routes/songRoutes";
import { settingsRoutes } from "@/routes/settingsRoutes";
import { adminRoutes } from "@/routes/AdminRoutes";

const PasswordGate = lazy(() => import("@/components/PasswordGate"));
const GlobalCaptureFlow = lazy(() => import("@/components/capture/GlobalCaptureFlow"));
const MiniPracticePlayer = lazy(() =>
  import("@/components/practice/MiniPracticePlayer").then((module) => ({ default: module.MiniPracticePlayer })),
);
const StorageWarningController = lazy(() => import("@/components/pricing/StorageWarningController"));

// Legal (public) — linked from the auth + invite trust lines
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

/**
 * App — the shell composition. All routing lives in the route-group fragments
 * (src/routes/*); this file only wires the provider stack, the router, the one
 * shared loading skeleton, and the two always-on overlays.
 *
 * Provider order (single documented source of truth):
 *   PasswordGate(isPreviewUnlocked)
 *     → QueryClientProvider(A4 queryClient)
 *       → AuthProvider(A4, single auth subscription)
 *         → OutboxProvider(A4 offline-write outbox)
 *           → TooltipProvider → Toaster/Sonner
 *             → BrowserRouter(v7 flags)
 *               → PracticePlayerProvider
 *                 → Suspense(BrandedSkeleton) → <Routes>
 * The capture FAB + mini-player mount AFTER <Routes> but inside <BrowserRouter>
 * so they persist across navigation and never re-mount on route change.
 */
const App = () => {
  const [unlocked, setUnlocked] = useState<boolean>(
    () => typeof window !== "undefined" && isPreviewUnlocked(),
  );

  if (!unlocked) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[var(--cog-cream)]" />}>
        <PasswordGate onUnlock={() => setUnlocked(true)} />
      </Suspense>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OutboxProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <PracticePlayerProvider>
                <SongSurfaceTracker />
                <RouteAnnouncer />
                <Suspense fallback={<BrandedSkeleton />}>
                  <Routes>
                    {authRoutes}
                    {onboardingRoutes}
                    {songRoutes}
                    {settingsRoutes}
                    {adminRoutes}

                    {/* Legal (public) */}
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />

                    {/* Fallback — branded 404 */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>

                {/* Always-on overlays — persist across navigation, outside <Routes> */}
                <Suspense fallback={null}>
                  <GlobalCaptureFlow />
                </Suspense>
                <Suspense fallback={null}>
                  <MiniPracticePlayer />
                </Suspense>
                {/* Storage warning (G1 · Onboarding 16) — surfaces the calm
                    approaching/over-limit sheet off real billing data + outbox
                    quota events; never blocks reading existing work. */}
                <Suspense fallback={null}>
                  <StorageWarningController />
                </Suspense>
              </PracticePlayerProvider>
            </BrowserRouter>
          </TooltipProvider>
        </OutboxProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
