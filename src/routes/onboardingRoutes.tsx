import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";

// ── Onboarding flow (pre-auth / first-run) ────────────────────────────────
// These screens run before a song exists, so they stay public — a
// just-authenticated user is routed here by src/lib/auth/postAuthRoute.ts based
// on their onboarding_step. The /onboarding index bounces into the real front
// door rather than dead-ending.

const FirstIntentPage = lazy(() => import("@/pages/onboarding/FirstIntentPage"));
const StartFirstSongPage = lazy(() => import("@/pages/onboarding/StartFirstSongPage"));
const FounderCodePage = lazy(() => import("@/pages/onboarding/FounderCodePage"));
const EarnPage = lazy(() => import("@/pages/onboarding/EarnPage"));

export const onboardingRoutes = (
  <>
    <Route path="/onboarding" element={<Navigate to="/auth/login" replace />} />
    <Route path="/onboarding/intent" element={<FirstIntentPage />} />
    <Route path="/onboarding/start-song" element={<StartFirstSongPage />} />
    <Route path="/onboarding/founder-code" element={<FounderCodePage />} />
    <Route path="/onboarding/earn" element={<EarnPage />} />
  </>
);
