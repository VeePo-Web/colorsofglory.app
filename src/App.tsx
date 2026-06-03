import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth screens
import PhoneLoginPage from "./pages/auth/PhoneLoginPage";
import CodeVerifyPage from "./pages/auth/CodeVerifyPage";

// Onboarding screens
import StartFirstSongPage from "./pages/onboarding/StartFirstSongPage";
import FounderCodePage from "./pages/onboarding/FounderCodePage";
import InvitePreviewPage from "./pages/InvitePreviewPage";

// Core app screens
import SongCatalogPage from "./pages/SongCatalogPage";
import SongWorkspacePage from "./pages/SongWorkspacePage";
import LyricsEditorPage from "./pages/LyricsEditorPage";
import VoiceMemosPage from "./pages/VoiceMemosPage";
import NotesPage from "./pages/NotesPage";
import PeoplePage from "./pages/PeoplePage";
import ActivityPage from "./pages/ActivityPage";
import CreditsPage from "./pages/CreditsPage";

// Settings & business model
import StoragePage from "./pages/settings/StoragePage";
import ReferralPage from "./pages/settings/ReferralPage";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route path="/auth/login" element={<PhoneLoginPage />} />
          <Route path="/auth/verify" element={<CodeVerifyPage />} />

          {/* Onboarding */}
          <Route path="/onboarding/start-song" element={<StartFirstSongPage />} />
          <Route path="/onboarding/founder-code" element={<FounderCodePage />} />

          {/* Invite acceptance */}
          <Route path="/invite/:token" element={<InvitePreviewPage />} />

          {/* Core app */}
          <Route path="/" element={<SongCatalogPage />} />
          <Route path="/songs/:id" element={<SongWorkspacePage />} />
          <Route path="/songs/:id/lyrics" element={<LyricsEditorPage />} />
          <Route path="/songs/:id/voice" element={<VoiceMemosPage />} />
          <Route path="/songs/:id/notes" element={<NotesPage />} />
          <Route path="/songs/:id/people" element={<PeoplePage />} />
          <Route path="/songs/:id/activity" element={<ActivityPage />} />
          <Route path="/songs/:id/credits" element={<CreditsPage />} />

          {/* Settings */}
          <Route path="/settings/storage" element={<StoragePage />} />
          <Route path="/settings/referral" element={<ReferralPage />} />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
