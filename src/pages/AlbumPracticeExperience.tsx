import { useEffect, useCallback, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { goBackOr } from "@/lib/nav/safeBack";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { DriveModePlayer } from "@/components/practice/DriveModePlayer";
import { FullPracticePlayer } from "@/components/practice/FullPracticePlayer";
import { loadSession, loadLoopMode } from "@/lib/audio/practiceStorage";
import { loadAlbumPracticeSections } from "@/lib/practice/practiceApi";
import { listAlbums } from "@/lib/library/albums";
import { listMySongs } from "@/integrations/cog/songs";

/**
 * Route: /albums/:albumId/practice
 *
 * Album practice — loop a whole in-progress album (every playable section of
 * every song, in tracklist order) as one continuous car session. Reuses the
 * single-song player wholesale: an album is just a longer, song-tagged section
 * list. Session + mastery history are namespaced under `album:<id>` so they
 * never collide with a real song. Deep-link safe: if launched cold (mini-player
 * restore, shared link) it re-resolves the album's songs itself.
 */
export default function AlbumPracticeExperience() {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const hook = usePracticeContext();
  const { state, initSession } = hook;

  const [error, setError] = useState<string | null>(null);
  const sessionKey = albumId ? `album:${albumId}` : "";

  const handleClose = useCallback(() => {
    goBackOr(navigate, location.key, "/songs");
  }, [navigate, location.key]);

  useEffect(() => {
    if (!albumId) return;
    let cancelled = false;

    (async () => {
      const album = listAlbums().find((a) => a.id === albumId);
      if (!album || album.songIds.length === 0) {
        if (!cancelled) setError("This album has no songs yet.");
        return;
      }

      // Prefer song {id,title} passed in nav state (instant, already loaded by
      // the library); fall back to a fresh song list on a cold deep-link.
      const navSongs = (window.history.state?.usr ?? {}) as {
        songs?: { id: string; title: string }[];
      };
      let ordered: { id: string; title: string }[];
      if (navSongs.songs && navSongs.songs.length > 0) {
        ordered = navSongs.songs;
      } else {
        const all = await listMySongs();
        const byId = new Map(all.map((s) => [s.id, s.title]));
        ordered = album.songIds
          .filter((id) => byId.has(id))
          .map((id) => ({ id, title: byId.get(id) ?? "Untitled Song" }));
      }
      if (ordered.length === 0) {
        if (!cancelled) setError("These songs aren't available right now.");
        return;
      }

      const sections = await loadAlbumPracticeSections(ordered);
      if (cancelled) return;

      const savedMode = loadLoopMode(sessionKey) ?? "all";
      hook.setLoopMode(savedMode);

      const persisted = loadSession(sessionKey);
      initSession(sessionKey, album.name, sections, persisted ?? undefined);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId]);

  if (error) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)" }}>
          {error}
        </p>
        <button
          onClick={handleClose}
          className="rounded-full px-6 py-2"
          style={{ backgroundColor: "var(--cog-gold)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 600, border: "none" }}
        >
          Go back
        </button>
      </div>
    );
  }

  if (state.status === "idle") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cog-gold)" }} />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)" }}>
          Gathering your album…
        </p>
      </div>
    );
  }

  if (state.status === "caching" && state.sections.every((s) => s.cacheStatus === "pending")) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cog-gold)" }} />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)" }}>
          Preparing your album for practice…
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-muted)" }}>
          Every song is cached so it plays offline in the car
        </p>
      </div>
    );
  }

  if (state.driveMode) {
    return <DriveModePlayer hook={hook} />;
  }

  return <FullPracticePlayer hook={hook} onClose={handleClose} />;
}
