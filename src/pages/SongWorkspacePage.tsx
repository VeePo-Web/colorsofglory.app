import type { ElementType } from "react";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Mic,
  Music,
  PenLine,
  StickyNote,
  UserPlus,
} from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";

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
  { id: "lyrics", label: "Lyrics",     icon: FileText,  route: "lyrics" },
  { id: "voice",  label: "Voice Memo", icon: Mic,       route: "voice" },
  { id: "chords", label: "Chords",     icon: Music,     route: "chords" },
  { id: "notes",  label: "Notes",      icon: StickyNote, route: "notes" },
  { id: "invite", label: "Invite",     icon: UserPlus,  route: "people" },
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
  const songId = id ?? "1";
  const rawTitle = firstSong.title || "";
  const songTitle = rawTitle || (songId === "1" ? "Grace in the Waiting" : songId === "2" ? "Morning Prayer" : songId === "3" ? "Holy Fire" : "Untitled Song");
  const songMeta = [firstSong.key, firstSong.bpm ? `${firstSong.bpm} BPM` : null].filter(Boolean);

  const sid = id ?? "1";

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#FAFAF6", paddingBottom: 96 }}
    >
      {/* Subtle bottom-right glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.10) 0%, transparent 65%)",
        }}
      />

      {/* Back to catalog */}
      <div
        className="relative px-5 pt-14"
        style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 active:scale-95"
          style={{ color: "#999", minHeight: 44 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Songs
        </button>
      </div>

      <main
        className="relative mx-auto flex w-full flex-1 flex-col px-5"
        style={{ maxWidth: 430 }}
      >
        {/* Logo */}
        <div className="flex justify-center pt-2 pb-5">
          <CogBrand variant="stacked" size="md" />
        </div>

        {/* Song title — large Playfair bold */}
        <h1
          className="text-[2.25rem] font-bold text-center mb-1 leading-[1.1]"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          {songTitle}
        </h1>
        <p className="text-[0.9375rem] text-center mb-1" style={{ color: "#666" }}>
          Private song space
        </p>
        {songMeta.length > 0 && (
          <p className="text-[0.8125rem] text-center mb-2" style={{ color: "#999" }}>
            {songMeta.join(" · ")}
          </p>
        )}

        {/* Supporting text */}
        <p
          className="text-[0.875rem] text-center mb-7 leading-relaxed mx-auto"
          style={{ color: "#999", maxWidth: 300 }}
        >
          Start anywhere. Add a lyric, record a voice memo, or invite someone into the song.
        </p>

        {/* Module cards — 2-column grid matching reference */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {MODULES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onClick={() => navigate(`/songs/${sid}/${module.route}`)}
            />
          ))}
        </div>

        {/* Bottom quick-action pill bar — matches reference image exactly */}
        <div
          className="fixed left-0 right-0 flex items-center justify-center gap-2 px-5 pb-4"
          style={{
            bottom: 0,
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <QuickAction
            label="Write lyric"
            icon={PenLine}
            onClick={() => navigate(`/songs/${sid}/lyrics`)}
          />
          <QuickAction
            label="Record memo"
            icon={Mic}
            onClick={() => navigate(`/songs/${sid}/capture`)}
            primary
          />
          <QuickAction
            label="Invite"
            icon={UserPlus}
            onClick={() => navigate(`/songs/${sid}/people`)}
          />
        </div>
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

// Bottom pill bar buttons — match reference image: dark charcoal pills, gold when active
const QuickAction = ({ label, icon: Icon, onClick, primary = false }: QuickActionProps) => (
  <button
    onClick={onClick}
    className="flex flex-1 items-center justify-center gap-2 rounded-full text-[0.8125rem] font-semibold transition-all duration-150 active:scale-[0.97]"
    style={{
      height: 44,
      backgroundColor: primary ? "#B5935A" : "#1A1A1A",
      color: "#FFFFFF",
      fontFamily: "var(--font-body)",
      boxShadow: primary
        ? "0 4px 16px rgba(181,147,90,0.40)"
        : "0 2px 8px rgba(0,0,0,0.15)",
      maxWidth: 145,
    }}
  >
    <Icon size={15} strokeWidth={2} />
    {label}
  </button>
);

interface ModuleCardProps {
  module: Module;
  onClick: () => void;
}

// Module cards — white cards with gold-tinted icon, label below
const ModuleCard = ({ module, onClick }: ModuleCardProps) => {
  const Icon = module.icon;
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-2xl p-4 transition-all duration-150 active:scale-[0.97]"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        minHeight: 110,
      }}
    >
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          width: 36,
          height: 36,
          backgroundColor: "rgba(181,147,90,0.10)",
        }}
      >
        <Icon size={18} strokeWidth={1.6} style={{ color: "#B5935A" }} />
      </div>
      <span
        className="text-[0.9375rem] font-semibold"
        style={{ color: "#1A1A1A", fontFamily: "var(--font-body)" }}
      >
        {module.label}
      </span>
    </button>
  );
};

export default SongWorkspacePage;
