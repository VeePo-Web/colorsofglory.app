import { lazy } from "react";
import { Route, Navigate, useParams } from "react-router-dom";
import RequireAuth from "@/components/auth/RequireAuth";

// ── Capture-first song surfaces ───────────────────────────────────────────
// Mic-first capture is the app landing AND a song's default landing; the
// workspace hub is one tap away at /songs/:id/room. Real app surfaces sit
// behind RequireAuth (RLS is the trust boundary; the guard just keeps anon
// users off broken/empty screens and sends them to login with resume).
//
// Lyrics/Chords/Voice/Versions are REAL pages (C3 sheet, C4 voice, E3 versions),
// not redirects — only /people folds into the canvas ?layer= view.

const CapturePage = lazy(() => import("@/pages/CapturePage"));
const SongCatalogPage = lazy(() => import("@/pages/SongCatalogPage"));
const SongWorkspacePage = lazy(() => import("@/pages/SongWorkspacePage"));
const BrainstormPage = lazy(() => import("@/pages/BrainstormPage"));
const SongCanvasPage = lazy(() => import("@/pages/SongCanvasPage"));
const SongSheetPage = lazy(() => import("@/pages/SongSheetPage"));
const VoiceMemosPage = lazy(() => import("@/pages/VoiceMemosPage"));
const PracticePlayerPage = lazy(() => import("@/pages/PracticePlayerPage"));
const AlbumPracticeExperience = lazy(() => import("@/pages/AlbumPracticeExperience"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const ActivityPage = lazy(() => import("@/pages/ActivityPage"));
const CreditsPage = lazy(() => import("@/pages/CreditsPage"));
const VersionHistoryPage = lazy(() => import("@/pages/VersionHistoryPage"));
const SongMemoryPage = lazy(() => import("@/pages/SongMemoryPage"));
const MemoryPage = lazy(() => import("@/pages/MemoryPage"));

// Onboarding-continuation surfaces that live under a song (post-auth, they
// write into the user's song), so they are guarded like the rest.
const CaptureFirstIdeaPage = lazy(() => import("@/pages/onboarding/CaptureFirstIdeaPage"));
const VoiceMemoAddedPage = lazy(() => import("@/pages/onboarding/VoiceMemoAddedPage"));

// The only remaining panel → canvas ?layer= redirect (people). The canvas
// target is itself guarded, so the redirect needs no guard of its own.
const CanvasLayerRedirect = ({ layer }: { layer: string }) => {
  const { id } = useParams<{ id: string }>();
  const songId = id ?? "1";
  return <Navigate to={`/songs/${songId}/canvas?layer=${layer}`} replace />;
};

export const songRoutes = (
  <>
    {/* Capture-first landings */}
    <Route path="/" element={<RequireAuth><CapturePage /></RequireAuth>} />
    <Route path="/capture" element={<RequireAuth><CapturePage /></RequireAuth>} />
    <Route path="/songs" element={<RequireAuth><SongCatalogPage /></RequireAuth>} />
    {/* Mic-first capture is the song's default landing; the hub is at /room. */}
    <Route path="/songs/:id" element={<RequireAuth><CapturePage /></RequireAuth>} />

    {/* Song interior */}
    <Route path="/songs/:id/room" element={<RequireAuth><SongWorkspacePage /></RequireAuth>} />
    <Route path="/songs/:id/brainstorm" element={<RequireAuth><BrainstormPage /></RequireAuth>} />
    <Route path="/songs/:id/capture" element={<RequireAuth><CapturePage /></RequireAuth>} />
    <Route path="/songs/:id/capture-onboarding" element={<RequireAuth><CaptureFirstIdeaPage /></RequireAuth>} />
    <Route path="/songs/:id/voice-added" element={<RequireAuth><VoiceMemoAddedPage /></RequireAuth>} />

    {/* Lyrics + Chords resolve to the structured Lyric & Chord Sheet editor (C3);
        /sheet is the canonical alias. */}
    <Route path="/songs/:id/lyrics" element={<RequireAuth><SongSheetPage /></RequireAuth>} />
    <Route path="/songs/:id/chords" element={<RequireAuth><SongSheetPage /></RequireAuth>} />
    <Route path="/songs/:id/sheet" element={<RequireAuth><SongSheetPage /></RequireAuth>} />

    <Route path="/songs/:id/canvas" element={<RequireAuth><SongCanvasPage /></RequireAuth>} />
    <Route path="/songs/:id/practice" element={<RequireAuth><PracticePlayerPage /></RequireAuth>} />
    {/* Album practice is a multi-song player surface; left unguarded pending a
        product decision on public album-share links (flagged in ROUTE-MAP). */}
    <Route path="/albums/:albumId/practice" element={<AlbumPracticeExperience />} />

    {/* Voice's canonical home (C4): recorder, take versions, layered stacks. */}
    <Route path="/songs/:id/voice" element={<RequireAuth><VoiceMemosPage /></RequireAuth>} />
    {/* Notes pad (C5): the standalone song-level pad. */}
    <Route path="/songs/:id/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />
    {/* Activity (E2): the calm "what changed since you left" feed. */}
    <Route path="/songs/:id/activity" element={<RequireAuth><ActivityPage /></RequireAuth>} />
    <Route path="/songs/:id/credits" element={<RequireAuth><CreditsPage /></RequireAuth>} />
    {/* Version history (E3): snapshot timeline + non-destructive restore. */}
    <Route path="/songs/:id/versions" element={<RequireAuth><VersionHistoryPage /></RequireAuth>} />
    <Route path="/songs/:id/memory" element={<RequireAuth><SongMemoryPage /></RequireAuth>} />

    {/* Panel route folded into the canvas layer view (canvas target is guarded) */}
    <Route path="/songs/:id/people" element={<CanvasLayerRedirect layer="people" />} />

    {/* Personal Memory Graph / Zettelkasten (Feature 33) */}
    <Route path="/memory" element={<RequireAuth><MemoryPage /></RequireAuth>} />
  </>
);
