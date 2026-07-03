import { Suspense, lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { PracticePlayerProvider } from "@/components/practice/PracticePlayerContext";

const PasswordGate = lazy(() => import("@/components/PasswordGate"));
const GlobalCaptureFlow = lazy(() => import("@/components/capture/GlobalCaptureFlow"));
const MiniPracticePlayer = lazy(() =>
  import("@/components/practice/MiniPracticePlayer").then((module) => ({ default: module.MiniPracticePlayer })),
);

const PhoneLoginPage = lazy(() => import("./pages/auth/PhoneLoginPage"));
const CodeVerifyPage = lazy(() => import("./pages/auth/CodeVerifyPage"));
const EmailAuthPage = lazy(() => import("./pages/auth/EmailAuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
import RequireAuth from "./components/auth/RequireAuth";
const FirstIntentPage = lazy(() => import("./pages/onboarding/FirstIntentPage"));
const StartFirstSongPage = lazy(() => import("./pages/onboarding/StartFirstSongPage"));
const FounderCodePage = lazy(() => import("./pages/onboarding/FounderCodePage"));
const EarnPage = lazy(() => import("./pages/onboarding/EarnPage"));
const CaptureFirstIdeaPage = lazy(() => import("./pages/onboarding/CaptureFirstIdeaPage"));
const VoiceMemoAddedPage = lazy(() => import("./pages/onboarding/VoiceMemoAddedPage"));
// Legacy /invite/:token links (and the post-auth pending-invite resume) funnel
// into the one real, frictionless join flow at /join/:token. The old preview page
// was a mock that dumped users onto the wrong song with no auth — never route to it.
const InviteTokenRedirect = () => {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/join/${token ?? ""}`} replace />;
};

// Invite flow - new frictionless join screens
const JoinEntryPage      = lazy(() => import("./pages/invite/JoinEntryPage"));
const InviteJoinPage     = lazy(() => import("./pages/invite/InviteJoinPage"));
const InviteWelcomePage  = lazy(() => import("./pages/invite/InviteWelcomeBackPage"));
const InviteVerifyPage   = lazy(() => import("./pages/invite/InviteVerifyPage"));
const InviteNamePage     = lazy(() => import("./pages/invite/InviteNamePage"));
const InviteTeamPage     = lazy(() => import("./pages/invite/InviteTeamIntroPage"));
const ReturningHomePage  = lazy(() => import("./pages/ReturningHomePage"));

const SongCatalogPage = lazy(() => import("./pages/SongCatalogPage"));
const PracticePlayerPage = lazy(() => import("./pages/PracticePlayerPage"));
const CapturePage = lazy(() => import("./pages/CapturePage"));
const SongWorkspacePage = lazy(() => import("./pages/SongWorkspacePage"));
const SongCanvasPage = lazy(() => import("./pages/SongCanvasPage"));
const SongSheetPage = lazy(() => import("./pages/SongSheetPage"));
const MemoryPage = lazy(() => import("./pages/MemoryPage"));
const SongMemoryPage = lazy(() => import("./pages/SongMemoryPage"));
const BrainstormPage = lazy(() => import("./pages/BrainstormPage"));
const StoragePage = lazy(() => import("./pages/settings/StoragePage"));
const ReferralPage = lazy(() => import("./pages/settings/ReferralPage"));
const BillingPage = lazy(() => import("./pages/settings/BillingPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));

// Pricing + checkout (new)
const PricingUpgradePage     = lazy(() => import("./pages/pricing/UpgradePage"));
const CheckoutSuccessPage    = lazy(() => import("./pages/pricing/CheckoutSuccessPage"));
const ReferralRedirectPage   = lazy(() => import("./pages/pricing/ReferralRedirectPage"));

// Legacy upgrade placeholder (keep for any existing links)
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Legal (public) — linked from the auth + invite trust lines
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage"));

// Admin (internal-only)
const RequireAdmin = lazy(() => import("./components/admin/RequireAdmin"));
const AdminHomePage = lazy(() => import("./pages/admin/AdminHomePage"));
const AdminFoundersPage = lazy(() => import("./pages/admin/FoundersPage"));
const AdminFounderDetailPage = lazy(() => import("./pages/admin/FounderDetailPage"));
const AdminCodesPage = lazy(() => import("./pages/admin/CodesPage"));
const AdminPayoutsPage = lazy(() => import("./pages/admin/PayoutsPage"));
const AdminFinancePage = lazy(() => import("./pages/admin/FinancePage"));
// Admin (internal-only) — all admin routing lives in src/routes/AdminRoutes.tsx
import { adminRoutes } from "@/routes/AdminRoutes";
import SongSurfaceTracker from "@/components/nav/SongSurfaceTracker";
import RouteAnnouncer from "@/components/nav/RouteAnnouncer";

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
      <p
        className="mb-6 text-center text-xs font-medium uppercase"
        style={{ color: "var(--cog-muted)", letterSpacing: "0.24em" }}
      >
        Colors of Glory
      </p>
      <div className="space-y-3" aria-label="Loading page">
        <div className="h-5 w-32 rounded-full" style={{ backgroundColor: "rgba(184,149,58,0.12)" }} />
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

const App = () => {
  const [unlocked, setUnlocked] = useState<boolean>(
    () => typeof window !== "undefined" && sessionStorage.getItem("site_unlocked") === "true"
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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <PracticePlayerProvider>
        <SongSurfaceTracker />
        <RouteAnnouncer />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Auth — phone-first front door (Twilio SMS OTP); email is the fallback */}
            <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login" element={<PhoneLoginPage />} />
            <Route path="/auth/phone" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/phone/verify" element={<CodeVerifyPage />} />
            <Route path="/auth/email" element={<EmailAuthPage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={<Navigate to="/auth/login" replace />} />
            <Route path="/onboarding/intent" element={<FirstIntentPage />} />
            <Route path="/onboarding/start-song" element={<StartFirstSongPage />} />
            <Route path="/onboarding/founder-code" element={<FounderCodePage />} />
            <Route path="/onboarding/earn" element={<EarnPage />} />

            {/* Legacy invite link → redirect into the real frictionless join flow */}
            <Route path="/invite/:token" element={<InviteTokenRedirect />} />

            {/* Frictionless invite join flow: colorsofglory.app/join/:token */}
            <Route path="/join"           element={<JoinEntryPage />} />
            <Route path="/join/:token"    element={<InviteJoinPage />} />
            <Route path="/invite/welcome" element={<InviteWelcomePage />} />
            <Route path="/invite/verify"  element={<InviteVerifyPage />} />
            <Route path="/invite/name"    element={<InviteNamePage />} />
            <Route path="/invite/team"    element={<InviteTeamPage />} />

            {/* Returning user smart home */}
            <Route path="/home"           element={<ReturningHomePage />} />

            {/* Core app */}
            <Route path="/" element={<RequireAuth><CapturePage /></RequireAuth>} />
            <Route path="/capture" element={<RequireAuth><CapturePage /></RequireAuth>} />
            <Route path="/songs" element={<RequireAuth><SongCatalogPage /></RequireAuth>} />
            {/* Mic-first capture is the song's default landing.
                Workspace hub is one tap away at /songs/:id/room. */}
            <Route path="/songs/:id" element={<RequireAuth><CapturePage /></RequireAuth>} />
            <Route path="/songs/:id/room" element={<SongWorkspacePage />} />
            <Route path="/songs/:id/brainstorm" element={<RequireAuth><BrainstormPage /></RequireAuth>} />
            <Route path="/songs/:id/capture" element={<RequireAuth><CapturePage /></RequireAuth>} />
            <Route path="/songs/:id/capture-onboarding" element={<CaptureFirstIdeaPage />} />
            <Route path="/songs/:id/voice-added" element={<VoiceMemoAddedPage />} />
            <Route path="/songs/:id/lyrics" element={<CanvasLayerRedirect layer="lyrics" />} />
            <Route path="/songs/:id/chords" element={<CanvasLayerRedirect layer="chords" />} />
            <Route path="/songs/:id/canvas" element={<SongCanvasPage />} />
            <Route path="/songs/:id/sheet" element={<SongSheetPage />} />
            <Route path="/songs/:id/practice" element={<PracticePlayerPage />} />
            <Route path="/songs/:id/voice" element={<CanvasLayerRedirect layer="voice" />} />
            <Route path="/songs/:id/notes" element={<CanvasLayerRedirect layer="notes" />} />
            <Route path="/songs/:id/people" element={<CanvasLayerRedirect layer="people" />} />
            <Route path="/songs/:id/activity" element={<CanvasLayerRedirect layer="room" />} />
            <Route path="/songs/:id/credits" element={<CanvasLayerRedirect layer="people" />} />
            <Route path="/songs/:id/memory" element={<RequireAuth><SongMemoryPage /></RequireAuth>} />

            {/* Personal Memory Graph / Zettelkasten (Feature 33) */}
            <Route path="/memory" element={<RequireAuth><MemoryPage /></RequireAuth>} />

            {/* Settings */}
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/billing" element={<BillingPage />} />
            <Route path="/settings/storage" element={<StoragePage />} />
            <Route path="/settings/referral" element={<ReferralPage />} />

            {/* Pricing + checkout */}
            <Route path="/upgrade" element={<PricingUpgradePage />} />
            <Route path="/pricing" element={<PricingUpgradePage />} />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/r/:code" element={<ReferralRedirectPage />} />

            {/* Legacy upgrade placeholder */}
            <Route path="/upgrade-old" element={<UpgradePage />} />

            {/* Admin (internal) */}
            <Route path="/admin" element={<RequireAdmin><AdminHomePage /></RequireAdmin>} />
            <Route path="/admin/founders" element={<RequireAdmin><AdminFoundersPage /></RequireAdmin>} />
            <Route path="/admin/founders/:id" element={<RequireAdmin><AdminFounderDetailPage /></RequireAdmin>} />
            <Route path="/admin/codes" element={<RequireAdmin><AdminCodesPage /></RequireAdmin>} />
            <Route path="/admin/payouts" element={<RequireAdmin><AdminPayoutsPage /></RequireAdmin>} />
            <Route path="/admin/finance" element={<RequireAdmin><AdminFinancePage /></RequireAdmin>} />
            {/* Admin (internal) — routes defined in src/routes/AdminRoutes.tsx */}
            {adminRoutes}

            {/* Legal (public) */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Suspense fallback={null}>
          <GlobalCaptureFlow />
        </Suspense>
        <Suspense fallback={null}>
          <MiniPracticePlayer />
        </Suspense>
        </PracticePlayerProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
