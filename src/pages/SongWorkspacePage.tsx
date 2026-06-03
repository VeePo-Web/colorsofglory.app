import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mic, Music, StickyNote, Users } from "lucide-react";

interface Module {
  id: string;
  label: string;
  icon: React.ElementType;
  route: string;
}

const MODULES: Module[] = [
  { id: "lyrics",  label: "Lyrics",  icon: FileText,    route: "lyrics" },
  { id: "voice",   label: "Voice",   icon: Mic,         route: "voice" },
  { id: "chords",  label: "Chords",  icon: Music,       route: "chords" },
  { id: "notes",   label: "Notes",   icon: StickyNote,  route: "notes" },
  { id: "people",  label: "People",  icon: Users,       route: "people" },
];

const SongWorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const songTitle = "Grace in the Waiting";

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--cog-cream)" }}
    >
      {/* Warm glow signature — bottom radial */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 85%, rgba(184,149,58,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Back button */}
      <div className="relative px-6 pt-14" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm transition-opacity duration-150 hover:opacity-70"
          style={{ color: "var(--cog-warm-gray)" }}
        >
          <ArrowLeft size={16} />
          Songs
        </button>
      </div>

      {/* Song header */}
      <div
        className="relative text-center px-6 pt-8 pb-6"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Brand mark */}
        <p
          className="text-xs font-medium tracking-widest uppercase mb-4"
          style={{ color: "var(--cog-muted)" }}
        >
          Colors of Glory
        </p>

        {/* Song title */}
        <h1
          className="text-4xl font-semibold leading-tight mb-2"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--cog-charcoal)",
            fontSize: "clamp(2rem, 8vw, 2.75rem)",
          }}
        >
          {songTitle}
        </h1>

        {/* Private room label */}
        <p className="text-sm" style={{ color: "var(--cog-warm-gray)" }}>
          Private song room
        </p>
      </div>

      {/* Module cards — 3 over 2 grid */}
      <div
        className="relative px-6 flex-1"
        style={{ maxWidth: "var(--max-w-app)", margin: "0 auto", width: "100%" }}
      >
        {/* Row 1: Lyrics, Voice, Chords */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {MODULES.slice(0, 3).map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onClick={() => navigate(`/songs/${id}/${mod.route}`)}
            />
          ))}
        </div>

        {/* Row 2: Notes, People (centered) */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div /> {/* spacer */}
          {MODULES.slice(3, 5).map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              onClick={() => navigate(`/songs/${id}/${mod.route}`)}
            />
          ))}
        </div>

        {/* Support line */}
        <p
          className="text-center text-sm"
          style={{ color: "var(--cog-muted)", lineHeight: 1.6 }}
        >
          Everything for this song stays connected here.
        </p>
      </div>

      <div className="pb-16" />
    </div>
  );
};

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
      <Icon
        size={26}
        strokeWidth={1.5}
        style={{ color: "var(--cog-charcoal)" }}
      />
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
