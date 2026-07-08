import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mic, Music, PenLine, StickyNote, UserPlus } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import { type SongDetail } from "@/integrations/cog/songs";
import { useSongDetail } from "@/hooks/useAppQueries";
import { useSwipeNav } from "@/lib/nav/useSwipeNav";
import { setNavDirection, useSpatialEntrance } from "@/lib/nav/navDirection";
import { preloadOnIdle } from "@/lib/nav/preloadOnIdle";

interface Module {
  id: "lyrics" | "voice" | "chords" | "notes" | "invite";
  label: string;
  icon: ElementType;
}

const MODULES: Module[] = [
  { id: "lyrics", label: "Lyrics", icon: FileText },
  { id: "voice", label: "Voice Memo", icon: Mic },
  { id: "chords", label: "Chords", icon: Music },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "invite", label: "Invite", icon: UserPlus },
];

interface StoredSong {
  title?: string;
}

// Continuity cache only (instant paint while the real song loads) — never a data source.
const readCachedTitle = (): string => {
  try {
    const stored = JSON.parse(sessionStorage.getItem("cog:first-song") ?? "{}") as StoredSong;
    return stored.title ?? "";
  } catch {
    return "";
  }
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Per-card live status: the count when the song has content, a soft
 * first-action invitation when it doesn't — never a bare "0".
 */
const moduleStatus = (
  moduleId: Module["id"],
  song: SongDetail,
): { text: string; empty: boolean } => {
  const { counts } = song;
  switch (moduleId) {
    case "lyrics":
      return counts.sections > 0
        ? { text: plural(counts.sections, "section"), empty: false }
        : { text: "Add your first lyric", empty: true };
    case "voice":
      return counts.voice_memos > 0
        ? { text: plural(counts.voice_memos, "memo"), empty: false }
        : { text: "Record your first memo", empty: true };
    case "chords": {
      const parts = [
        song.key_signature ? `Key of ${song.key_signature}` : null,
        song.tempo_bpm ? `${song.tempo_bpm} BPM` : null,
      ].filter(Boolean);
      return parts.length > 0
        ? { text: parts.join(" · "), empty: false }
        : { text: "Set key & tempo", empty: true };
    }
    case "notes":
      return counts.notes > 0
        ? { text: plural(counts.notes, "note"), empty: false }
        : { text: "Add your first note", empty: true };
    case "invite":
      return counts.collaborators > 1
        ? { text: `${counts.collaborators} people`, empty: false }
        : { text: "Invite someone in", empty: true };
  }
};

const SongWorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const songId = id ?? "";

  const cachedTitle = useMemo(readCachedTitle, []);

  // Workspace hub read — TanStack Query via the shared `qk.songDetail` key
  // (counts drive the hub badges). Fails soft: on error the cached title/counts
  // stay painted, never a blocking modal.
  const { data: song, isLoading } = useSongDetail(songId);

  // Depth surface: the room rose from the catalog, so paging back is a
  // rightward swipe (mid-screen — the browser keeps its own edge gesture).
  // Declare "left" so the library slides in FROM THE LEFT — the same entrance
  // it has coming from Capture. Songs always lives on the left, so it always
  // enters from the left: one consistent geography. Covers both the gesture
  // and the header back-chevron (both call backToSongs).
  const roomRef = useRef<HTMLDivElement>(null);
  const backToSongs = useCallback(() => {
    setNavDirection("left");
    navigate("/songs");
  }, [navigate]);
  useSwipeNav(roomRef, { onSwipeRight: backToSongs });
  const enterClass = useSpatialEntrance(useLocation().pathname);

  // The library is one swipe/tap back from the room, so warm its chunk on
  // idle — closes the cold-start case (deep link into a room, then back).
  useEffect(() => {
    preloadOnIdle(() => import("@/pages/SongCatalogPage"));
  }, []);

  // Canonical panel destinations — the hub navigates, panel agents own the rest.
  const moduleTarget = (moduleId: Module["id"]) => {
    switch (moduleId) {
      case "lyrics":
      case "chords":
        return `/songs/${songId}/sheet`;
      case "voice":
        return `/songs/${songId}/canvas?layer=voice`;
      case "notes":
        // Notes (C5) opens the standalone song-level pad, not the canvas layer.
        return `/songs/${songId}/notes`;
      case "invite":
        return `/songs/${songId}/canvas?layer=people`;
    }
  };

  const openPanel = (path: string) => {
    setNavDirection("up");
    navigate(path);
  };

  const songMeta = song
    ? [song.key_signature, song.tempo_bpm ? `${song.tempo_bpm} BPM` : null].filter(Boolean)
    : [];

  return (
    <div
      ref={roomRef}
      className={`relative min-h-screen flex flex-col bg-[var(--cog-cream)] ${enterClass}`}
      style={{ paddingBottom: 96 }}
    >
      <style>{`
        @keyframes cog-hub-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cog-hub-bar-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Signature warm glow — the canonical bottom-center radial */}
      <div className="pointer-events-none fixed inset-0 cog-glow" />

      {/* Back to the song catalog (declares the spatial direction) */}
      <div
        className="relative px-5 pt-14"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <button
          onClick={backToSongs}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95 text-[var(--cog-warm-gray)]"
          style={{ minHeight: 44 }}
          aria-label="Go back: Songs"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Songs
        </button>
      </div>

      <main
        className="relative mx-auto flex w-full flex-1 flex-col px-5"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        {/* Logo */}
        <div className="flex justify-center pt-2 pb-5">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Room identity — the song title carries all identity (no cover art) */}
        {isLoading && !song ? (
          <div className="flex flex-col items-center" aria-label="Loading song">
            {cachedTitle ? (
              <h1
                className="text-[2.25rem] font-bold text-center mb-1 leading-[1.1] text-[var(--cog-charcoal)]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {cachedTitle}
              </h1>
            ) : (
              <div
                className="mb-2 h-10 w-56 rounded-full"
                style={{ backgroundColor: "var(--cog-gold-a12)" }}
              />
            )}
            <div
              className="mb-1 h-4 w-32 rounded-full"
              style={{ backgroundColor: "var(--cog-gold-a04)" }}
            />
          </div>
        ) : song ? (
          <>
            <h1
              className="text-[2.25rem] font-bold text-center mb-1 leading-[1.1] text-[var(--cog-charcoal)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {song.title}
            </h1>
            <p className="text-[0.9375rem] text-center mb-1 text-[var(--cog-warm-gray)]">
              Private song space
            </p>
            {songMeta.length > 0 && (
              <p className="text-[0.8125rem] text-center mb-2 text-[var(--cog-muted)]">
                {songMeta.join(" · ")}
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center pt-6">
            <h1
              className="text-[1.5rem] font-bold text-center mb-2 text-[var(--cog-charcoal)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              This song isn&apos;t available
            </h1>
            <p className="text-[0.875rem] text-center mb-6 text-[var(--cog-warm-gray)]">
              It may have been removed, or you may not be a member of it.
            </p>
            <button
              onClick={backToSongs}
              className="rounded-full px-6 text-[0.875rem] font-semibold text-white transition-all duration-150 active:scale-[0.97]"
              style={{ height: 44, backgroundColor: "var(--cog-gold)", boxShadow: "var(--cog-shadow-fab)" }}
            >
              Back to your songs
            </button>
          </div>
        )}

        {(isLoading || song) && (
          <>
            {/* Supporting action line */}
            <p
              className="text-[0.875rem] text-center mb-7 leading-relaxed mx-auto text-[var(--cog-muted)]"
              style={{ maxWidth: 300 }}
            >
              Start anywhere. Add a lyric, record a voice memo, or invite someone into the song.
            </p>

            {/* Module cards — the grid IS the navigation. Exactly 5, always. */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {MODULES.map((module, index) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  status={song ? moduleStatus(module.id, song) : null}
                  index={index}
                  onClick={() => openPanel(moduleTarget(module.id))}
                />
              ))}
            </div>

            {/* Bottom quick-action pill bar — one gold emphasis: recording */}
            <div
              className="fixed left-0 right-0 flex items-center justify-center gap-2 px-5"
              style={{
                bottom: 0,
                paddingBottom: "max(16px, env(safe-area-inset-bottom))",
                animation: "cog-hub-bar-up var(--dur-slow) var(--cog-ease-reveal) both",
              }}
            >
              <QuickAction
                label="Write lyric"
                icon={PenLine}
                onClick={() => openPanel(`/songs/${songId}/sheet`)}
              />
              <QuickAction
                label="Record memo"
                icon={Mic}
                onClick={() => openPanel(`/songs/${songId}/canvas?layer=voice`)}
                primary
              />
              <QuickAction
                label="Invite"
                icon={UserPlus}
                onClick={() => openPanel(`/songs/${songId}/canvas?layer=people`)}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

interface QuickActionProps {
  label: string;
  icon: ElementType;
  onClick: () => void;
  primary?: boolean;
}

// Bottom pill bar — dark charcoal pills; the single gold pill is the room's one emphasis.
const QuickAction = ({ label, icon: Icon, onClick, primary = false }: QuickActionProps) => (
  <button
    onClick={onClick}
    className="flex flex-1 items-center justify-center gap-2 rounded-full text-[0.8125rem] font-semibold transition-all duration-150 active:scale-[0.97]"
    style={{
      height: 44,
      backgroundColor: primary ? "var(--cog-gold)" : "var(--cog-charcoal)",
      color: "#FFFFFF",
      fontFamily: "var(--font-body)",
      boxShadow: primary ? "var(--cog-shadow-fab)" : "0 2px 8px rgba(28,26,23,0.15)",
      maxWidth: 145,
    }}
  >
    <Icon size={15} strokeWidth={2} />
    {label}
  </button>
);

interface ModuleCardProps {
  module: Module;
  status: { text: string; empty: boolean } | null;
  index: number;
  onClick: () => void;
}

// Module cards — each a mini-section of the workspace: icon, label, live status.
const ModuleCard = ({ module, status, index, onClick }: ModuleCardProps) => {
  const Icon = module.icon;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2.5 rounded-2xl bg-[var(--cog-cream-light)] p-4 transition-all duration-150 active:scale-[0.97]"
      style={{
        border: "1px solid var(--cog-border)",
        boxShadow: "var(--cog-shadow-sm)",
        minHeight: 110,
        animation: `cog-hub-card-in var(--dur-slow) var(--cog-ease-reveal) both`,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ width: 36, height: 36, backgroundColor: "var(--cog-gold-a10)" }}
      >
        <Icon size={18} strokeWidth={1.6} style={{ color: "var(--cog-gold)" }} />
      </div>
      <span
        className="text-[0.9375rem] font-semibold text-[var(--cog-charcoal)]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {module.label}
      </span>
      {status && (
        <span
          className="text-[0.75rem] leading-snug text-left"
          style={{ color: status.empty ? "var(--cog-gold)" : "var(--cog-warm-gray)" }}
        >
          {status.text}
        </span>
      )}
    </button>
  );
};

export default SongWorkspacePage;
