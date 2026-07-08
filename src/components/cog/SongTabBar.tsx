import { forwardRef } from "react";
import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { FileText, GitBranch, Mic, Music, StickyNote, Users } from "lucide-react";

interface SongTab {
  id: string;
  label: string;
  icon: React.ElementType;
  segment: string; // URL segment: "lyrics", "voice", etc.
}

const TABS: SongTab[] = [
  { id: "lyrics", label: "Lyrics",  icon: FileText,    segment: "lyrics" },
  { id: "voice",  label: "Voice",   icon: Mic,         segment: "voice" },
  { id: "chords", label: "Chords",  icon: Music,       segment: "chords" },
  { id: "notes",  label: "Notes",   icon: StickyNote,  segment: "notes" },
  { id: "people", label: "People",  icon: Users,       segment: "people" },
  { id: "canvas", label: "Canvas",  icon: GitBranch,   segment: "canvas" },
];

interface SongTabBarProps {
  /** Override active tab detection when inside nested routes. */
  activeTab?: string;
}

/**
 * Persistent bottom tab bar for all song-interior screens.
 * Replaces the main BottomNav when you're deep inside a song.
 * Frosted cream glass, gold underline on active tab, 60px height.
 */
// forwardRef so the first-run tour can anchor a coach mark on the bar (the
// onboarding "every feature" beat). Purely additive — no behaviour change.
const SongTabBar = forwardRef<HTMLElement, SongTabBarProps>(({ activeTab }, ref) => {
  const navigate = useNavigate();
  const { id: songId } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const getActive = () => {
    if (activeTab) return activeTab;
    if (location.pathname.endsWith("/canvas")) {
      return searchParams.get("layer") ?? "canvas";
    }
    const path = location.pathname;
    const found = TABS.find((t) => path.endsWith(`/${t.segment}`));
    return found?.id ?? null;
  };

  const active = getActive();

  return (
    <nav
      ref={ref}
      aria-label="Song sections"
      className="fixed bottom-0 left-0 right-0 flex items-stretch"
      style={{
        backgroundColor: "rgba(245,240,232,0.94)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(28,26,23,0.07)",
        height: 72,
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 500,
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              // Lyrics + Chords open the structured Lyric & Chord Sheet; Notes
              // opens the standalone notes pad (C5); People opens the dedicated
              // collaboration page (members + invite composer — the growth-loop
              // entry point); the rest live as canvas layers.
              const destination =
                tab.id === "lyrics" || tab.id === "chords"
                  ? `/songs/${songId}/sheet`
                  : tab.id === "notes"
                    ? `/songs/${songId}/notes`
                    : tab.id === "people"
                      ? `/songs/${songId}/people`
                      : tab.id === "canvas"
                        ? `/songs/${songId}/canvas`
                        : `/songs/${songId}/canvas?layer=${tab.segment}`;
              navigate(destination);
            }}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
            className="flex flex-col items-center justify-center flex-1 gap-1 relative transition-all duration-150 active:scale-90"
            style={{
              color: isActive ? "var(--cog-gold-alt)" : "var(--cog-muted)",
            }}
          >
            {/* Gold top-border indicator on active tab */}
            {isActive && (
              <span
                className="absolute top-0 left-3 right-3 rounded-b-full"
                style={{
                  height: 2.5,
                  backgroundColor: "var(--cog-gold)",
                }}
              />
            )}

            <Icon
              size={20}
              strokeWidth={isActive ? 2 : 1.5}
              style={{
                color: isActive ? "var(--cog-gold)" : "var(--cog-muted)",
                transition: "color 150ms, stroke-width 150ms",
              }}
            />
            <span
              className="text-[10px] font-medium tracking-wide leading-none"
              style={{
                fontFamily: "var(--font-body)",
                color: isActive ? "var(--cog-gold-alt)" : "var(--cog-muted)",
                transition: "color 150ms",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});

SongTabBar.displayName = "SongTabBar";

export default SongTabBar;
