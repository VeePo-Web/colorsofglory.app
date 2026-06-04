import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const PhoneLoginPage = lazy(() => import("./pages/auth/PhoneLoginPage"));
const CodeVerifyPage = lazy(() => import("./pages/auth/CodeVerifyPage"));
const FirstIntentPage = lazy(() => import("./pages/onboarding/FirstIntentPage"));
const StartFirstSongPage = lazy(() => import("./pages/onboarding/StartFirstSongPage"));
const FounderCodePage = lazy(() => import("./pages/onboarding/FounderCodePage"));
const CaptureFirstIdeaPage = lazy(() => import("./pages/onboarding/CaptureFirstIdeaPage"));
const VoiceMemoAddedPage = lazy(() => import("./pages/onboarding/VoiceMemoAddedPage"));
const InvitePreviewPage = lazy(() => import("./pages/InvitePreviewPage"));
const SongCatalogPage = lazy(() => import("./pages/SongCatalogPage"));
const SongWorkspacePage = lazy(() => import("./pages/SongWorkspacePage"));
const LyricsEditorPage = lazy(() => import("./pages/LyricsEditorPage"));
const VoiceMemosPage = lazy(() => import("./pages/VoiceMemosPage"));
const NotesPage = lazy(() => import("./pages/NotesPage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const CreditsPage = lazy(() => import("./pages/CreditsPage"));
const StoragePage = lazy(() => import("./pages/settings/StoragePage"));
const ReferralPage = lazy(() => import("./pages/settings/ReferralPage"));
const UpgradePage = lazy(() => import("./pages/UpgradePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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

            {/* Invite acceptance */}
            <Route path="/invite/:token" element={<InvitePreviewPage />} />

            {/* Core app */}
            <Route path="/" element={<SongCatalogPage />} />
            <Route path="/songs/:id" element={<SongWorkspacePage />} />
            <Route path="/songs/:id/capture" element={<CaptureFirstIdeaPage />} />
            <Route path="/songs/:id/voice-added" element={<VoiceMemoAddedPage />} />
            <Route path="/songs/:id/lyrics" element={<LyricsEditorPage />} />
            <Route path="/songs/:id/voice" element={<VoiceMemosPage />} />
            <Route path="/songs/:id/notes" element={<NotesPage />} />
            <Route path="/songs/:id/people" element={<PeoplePage />} />
            <Route path="/songs/:id/activity" element={<ActivityPage />} />
            <Route path="/songs/:id/credits" element={<CreditsPage />} />

            {/* Settings */}
            <Route path="/settings/storage" element={<StoragePage />} />
            <Route path="/settings/referral" element={<ReferralPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
