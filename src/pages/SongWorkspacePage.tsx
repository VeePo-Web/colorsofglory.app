import type { ElementType } from "react";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Mic,
  Music,
  PenLine,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import CogLogo from "@/components/cog/CogLogo";

interface Module {
  id: string;
  label: string;
  icon: ElementType;
  route: string;
}

interface StoredSong {
  title?: string;
  key?: string | null;
  bpm?: string | null;
}

const MODULES: Module[] = [
  { id: "lyrics", label: "Lyrics", icon: FileText, route: "lyrics" },
  { id: "voice", label: "Voice", icon: Mic, route: "voice" },
  { id: "chords", label: "Chords", icon: Music, route: "lyrics" },
  { id: "notes", label: "Notes", icon: StickyNote, route: "notes" },
  { id: "people", label: "People", icon: Users, route: "people" },
];

const readFirstSong = (): StoredSong => {
  try {
    return JSON.parse(sessionStorage.getItem("cog:first-song") ?? "{}") as StoredSong;
  } catch {
    return {};
  }
};

const SongWorkspacePage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const firstSong = useMemo(readFirstSong, []);
  const isFirstVisit = searchParams.get("first") === "1";
  const songTitle = firstSong.title || "Grace in the Waiting";
  const songMeta = [firstSong.key, firstSong.bpm ? `${firstSong.bpm} BPM` : null].filter(Boolean);

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 85%, rgba(184,149,58,0.18) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative px-6 pt-14"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex min-h-11 items-center gap-1.5 text-sm transition-opacity duration-150 hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)" }}
        >
          <ArrowLeft size={16} />
          Songs
        </button>
      </div>

      <main
        className="relative mx-auto flex w-full flex-1 flex-col px-6 pb-12"
        style={{ maxWidth: "var(--max-w-app)" }}
      >
        <section className="text-center pt-5 pb-5">
          <div className="flex justify-center mb-4">
            <CogLogo size="sm" />
          </div>

          {isFirstVisit && (
            <div
              className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{
                backgroundColor: "rgba(184,149,58,0.12)",
                color: "var(--cog-gold-alt)",
                border: "1px solid rgba(184,149,58,0.22)",
              }}
            >
              <Sparkles size={13} strokeWidth={1.7} />
              Your song space is ready
            </div>
          )}

          <h1
            className="font-semibold leading-tight mb-2"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--cog-charcoal)",
              fontSize: "clamp(2rem, 8vw, 2.75rem)",
            }}
          >
            {songTitle}
          </h1>

          <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
            Private song room{songMeta.length ? ` - ${songMeta.join(" - ")}` : ""}
          </p>
        </section>

        <section className="mb-6 grid grid-cols-3 gap-2.5" aria-label="First song actions">
          <QuickAction
            label="Record"
            icon={Mic}
            onClick={() => navigate(`/songs/${id ?? "1"}/capture`)}
            primary
          />
          <QuickAction
            label="Write"
            icon={PenLine}
            onClick={() => navigate(`/songs/${id ?? "1"}/lyrics`)}
          />
          <QuickAction
            label="Invite"
            icon={Users}
            onClick={() => navigate(`/songs/${id ?? "1"}/people`)}
          />
        </section>

        <section aria-label="Song room sections">
          <div className="grid grid-cols-3 gap-3 mb-3">
            {MODULES.slice(0, 3).map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onClick={() => navigate(`/songs/${id ?? "1"}/${module.route}`)}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <div aria-hidden />
            {MODULES.slice(3, 5).map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                onClick={() => navigate(`/songs/${id ?? "1"}/${module.route}`)}
              />
            ))}
          </div>
        </section>

        <p className="text-center text-sm" style={{ color: "var(--cog-muted)", lineHeight: 1.6 }}>
          Everything for this song stays connected here.
        </p>
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

const QuickAction = ({ label, icon: Icon, onClick, primary = false }: QuickActionProps) => (
  <button
    onClick={onClick}
    className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-medium transition-all duration-150 active:scale-[0.97]"
    style={{
      backgroundColor: primary ? "var(--cog-gold)" : "var(--cog-cream-light)",
      border: primary ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border)",
      color: primary ? "#fff" : "var(--cog-charcoal)",
      boxShadow: primary ? "0 4px 20px rgba(184,149,58,0.30)" : "var(--cog-shadow-sm)",
      fontFamily: "var(--font-body)",
    }}
  >
    <Icon size={18} strokeWidth={1.8} />
    {label}
  </button>
);

interface ModuleCardProps {
  module: Module;
  onClick: () => void;
}

const ModuleCard = ({ module, onClick }: ModuleCardProps) => {
  const Icon = module.icon;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-150 active:scale-[0.97]"
      style={{
        backgroundColor: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border)",
        boxShadow: "var(--cog-shadow-card)",
        aspectRatio: "1",
        padding: "var(--space-4)",
      }}
    >
      <Icon size={26} strokeWidth={1.5} style={{ color: "var(--cog-charcoal)" }} />
      <span
        className="text-sm font-medium"
        style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
      >
        {module.label}
      </span>
    </button>
  );
};

export default SongWorkspacePage;
