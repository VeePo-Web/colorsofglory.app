import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

const PhoneLoginPage = lazy(() => import("./pages/auth/PhoneLoginPage"));
const CodeVerifyPage = lazy(() => import("./pages/auth/CodeVerifyPage"));
const FirstIntentPage = lazy(() => import("./pages/onboarding/FirstIntentPage"));
const StartFirstSongPage = lazy(() => import("./pages/onboarding/StartFirstSongPage"));
const FounderCodePage = lazy(() => import("./pages/onboarding/FounderCodePage"));
const EarnPage = lazy(() => import("./pages/onboarding/EarnPage"));
const CaptureFirstIdeaPage = lazy(() => import("./pages/onboarding/CaptureFirstIdeaPage"));
const VoiceMemoAddedPage = lazy(() => import("./pages/onboarding/VoiceMemoAddedPage"));
const InvitePreviewPage = lazy(() => import("./pages/InvitePreviewPage"));

// Invite flow — new frictionless join screens
const InviteJoinPage     = lazy(() => import("./pages/invite/InviteJoinPage"));
const InviteWelcomePage  = lazy(() => import("./pages/invite/InviteWelcomeBackPage"));
const InviteVerifyPage   = lazy(() => import("./pages/invite/InviteVerifyPage"));
const InviteNamePage     = lazy(() => import("./pages/invite/InviteNamePage"));
const InviteTeamPage     = lazy(() => import("./pages/invite/InviteTeamIntroPage"));
const ReturningHomePage  = lazy(() => import("./pages/ReturningHomePage"));

const SongCatalogPage = lazy(() => import("./pages/SongCatalogPage"));
const SongWorkspacePage = lazy(() => import("./pages/SongWorkspacePage"));
const SongCanvasPage = lazy(() => import("./pages/SongCanvasPage"));
const StoragePage = lazy(() => import("./pages/settings/StoragePage"));
const ReferralPage = lazy(() => import("./pages/settings/ReferralPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin (internal-only)
const RequireAdmin = lazy(() => import("./components/admin/RequireAdmin"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));
const AdminFoundersPage = lazy(() => import("./pages/admin/FoundersPage"));
const AdminFounderDetailPage = lazy(() => import("./pages/admin/FounderDetailPage"));
const AdminCodesPage = lazy(() => import("./pages/admin/CodesPage"));
const AdminPayoutsPage = lazy(() => import("./pages/admin/PayoutsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="relative min-h-screen bg-[var(--cog-cream)]">
    <div className="pointer-events-none fixed inset-0 cog-glow" />
    <div className="relative mx-auto flex min-h-screen w-full max-w-[var(--max-w-app)] flex-col justify-center px-8">
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.24em] text-[var(--cog-muted)]">
        Colors of Glory
      </p>
      <div className="space-y-3" aria-label="Loading page">
        <div className="h-5 w-32 rounded-full bg-[rgba(184,149,58,0.12)]" />
        <div className="h-12 rounded-2xl bg-[var(--cog-cream-light)] shadow-[var(--cog-shadow-sm)]" />
        <div className="h-12 rounded-2xl bg-[var(--cog-cream-light)] shadow-[var(--cog-shadow-sm)]" />
      </div>
    </div>
  </div>
);

const CanvasLayerRedirect = ({ layer }: { layer: string }) => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  return <Navigate to={`/songs/${songId}/canvas?layer=${layer}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Auth */}
            <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login" element={<PhoneLoginPage />} />
            <Route path="/auth/verify" element={<CodeVerifyPage />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<Navigate to="/auth/login" replace />} />
            <Route path="/onboarding/intent" element={<FirstIntentPage />} />
            <Route path="/onboarding/start-song" element={<StartFirstSongPage />} />
            <Route path="/onboarding/founder-code" element={<FounderCodePage />} />
            <Route path="/onboarding/earn" element={<EarnPage />} />

            {/* Legacy invite preview */}
            <Route path="/invite/:token" element={<InvitePreviewPage />} />

            {/* Frictionless invite join flow: colorsofglory.app/join/:token */}
            <Route path="/join/:token"    element={<InviteJoinPage />} />
            <Route path="/invite/welcome" element={<InviteWelcomePage />} />
            <Route path="/invite/verify"  element={<InviteVerifyPage />} />
            <Route path="/invite/name"    element={<InviteNamePage />} />
            <Route path="/invite/team"    element={<InviteTeamPage />} />

            {/* Returning user smart home */}
            <Route path="/home"           element={<ReturningHomePage />} />

            {/* Core app */}
            <Route path="/" element={<SongCatalogPage />} />
            <Route path="/songs/:id" element={<SongWorkspacePage />} />
            <Route path="/songs/:id/capture" element={<CaptureFirstIdeaPage />} />
            <Route path="/songs/:id/voice-added" element={<VoiceMemoAddedPage />} />
            <Route path="/songs/:id/lyrics" element={<CanvasLayerRedirect layer="lyrics" />} />
            <Route path="/songs/:id/chords" element={<CanvasLayerRedirect layer="chords" />} />
            <Route path="/songs/:id/canvas" element={<SongCanvasPage />} />
            <Route path="/songs/:id/voice" element={<CanvasLayerRedirect layer="voice" />} />
            <Route path="/songs/:id/notes" element={<CanvasLayerRedirect layer="notes" />} />
            <Route path="/songs/:id/people" element={<CanvasLayerRedirect layer="people" />} />
            <Route path="/songs/:id/activity" element={<CanvasLayerRedirect layer="room" />} />
            <Route path="/songs/:id/credits" element={<CanvasLayerRedirect layer="people" />} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/storage" element={<StoragePage />} />
            <Route path="/settings/referral" element={<ReferralPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />

            {/* Admin (internal) */}
            <Route path="/admin" element={<RequireAdmin><AdminHomePage /></RequireAdmin>} />
            <Route path="/admin/founders" element={<RequireAdmin><AdminFoundersPage /></RequireAdmin>} />
            <Route path="/admin/founders/:id" element={<RequireAdmin><AdminFounderDetailPage /></RequireAdmin>} />
            <Route path="/admin/codes" element={<RequireAdmin><AdminCodesPage /></RequireAdmin>} />
            <Route path="/admin/payouts" element={<RequireAdmin><AdminPayoutsPage /></RequireAdmin>} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
