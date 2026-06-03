import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

type SongStatus = "active" | "draft" | "collaborating" | "private" | "archived";
type Tab = "Owned" | "Invited" | "Archived";

interface SongCollab {
  initials: string;
  color: string;
}

interface Song {
  id: string;
  title: string;
  status: SongStatus;
  lastEdited: string;
  collaborators: SongCollab[];
  type: "owned" | "invited" | "archived";
}

const MOCK_SONGS: Song[] = [
  {
    id: "1",
    title: "Grace in the Waiting",
    status: "active",
    lastEdited: "2h ago",
    collaborators: [
      { initials: "AS", color: "#B8953A" },
      { initials: "PK", color: "#8B7355" },
    ],
    type: "owned",
  },
  {
    id: "2",
    title: "Morning Prayer",
    status: "collaborating",
    lastEdited: "Yesterday",
    collaborators: [
      { initials: "SM", color: "#6B8E6B" },
      { initials: "DL", color: "#8B6B8E" },
    ],
    type: "owned",
  },
  {
    id: "3",
    title: "Holy Fire",
    status: "draft",
    lastEdited: "3 days ago",
    collaborators: [{ initials: "PK", color: "#8B7355" }],
    type: "owned",
  },
  {
    id: "4",
    title: "Untitled Song",
    status: "private",
    lastEdited: "Oct 26",
    collaborators: [],
    type: "owned",
  },
];

const STATUS_LABELS: Record<SongStatus, string> = {
  active: "Active",
  draft: "Draft",
  collaborating: "Collaborating",
  private: "Private",
  archived: "Archived",
};

const SongCatalogPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Owned");

  const filteredSongs = MOCK_SONGS.filter((s) => {
    if (activeTab === "Owned") return s.type === "owned" && s.status !== "archived";
    if (activeTab === "Invited") return s.type === "invited";
    return s.status === "archived";
  });

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Warm top glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(184,149,58,0.10) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="relative px-6 pt-14 pb-4" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto" }}>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
        >
          Your songs
        </h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4 rounded-full p-1 w-fit" style={{ backgroundColor: "rgba(255,255,255,0.60)" }}>
          {(["Owned", "Invited", "Archived"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: activeTab === tab ? "#ffffff" : "transparent",
                color: activeTab === tab ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(28,26,23,0.12)" : "none",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Song grid */}
      <div className="relative px-6 pb-32" style={{ maxWidth: "var(--max-w-app)", margin: "0 auto" }}>
        {filteredSongs.length === 0 ? (
          <div className="text-center pt-20">
            <p className="text-base" style={{ color: "var(--cog-warm-gray)" }}>
              {activeTab === "Owned"
                ? "No owned songs yet. Start your first song room."
                : activeTab === "Invited"
                ? "No invited songs yet. Songs shared with you will appear here."
                : "Archived songs stay safe and readable here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredSongs.map((song) => (
              <SongCard key={song.id} song={song} onClick={() => navigate(`/songs/${song.id}`)} />
            ))}
          </div>
        )}
      </div>

      {/* New song FAB */}
      <button
        onClick={() => navigate("/onboarding/start-song")}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 px-8 py-4 rounded-full font-medium text-white transition-transform duration-150 active:scale-95"
        style={{
          backgroundColor: "var(--cog-gold)",
          boxShadow: "0 4px 20px rgba(184,149,58,0.40)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--t-body)",
          zIndex: 400,
        }}
      >
        <Plus size={18} strokeWidth={2.5} />
        New song
      </button>
    </div>
  );
};

interface SongCardProps {
  song: Song;
  onClick: () => void;
}

const SongCard = ({ song, onClick }: SongCardProps) => (
  <button
    onClick={onClick}
    className="text-left w-full rounded-2xl p-4 transition-all duration-200 active:scale-[0.97] flex flex-col justify-between"
    style={{
      background: "linear-gradient(145deg, var(--cog-cream-light) 0%, rgba(232,213,160,0.20) 100%)",
      border: "1px solid var(--cog-border)",
      boxShadow: "var(--cog-shadow-card)",
      minHeight: "140px",
    }}
  >
    <div>
      <p
        className="font-semibold text-base leading-snug mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
      >
        {song.title}
      </p>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor:
            song.status === "active"
              ? "rgba(184,149,58,0.15)"
              : "rgba(160,150,137,0.15)",
          color: song.status === "active" ? "var(--cog-gold-alt)" : "var(--cog-warm-gray)",
        }}
      >
        {STATUS_LABELS[song.status]}
      </span>
    </div>

    <div className="flex items-end justify-between mt-3">
      <div className="flex -space-x-1.5">
        {song.collaborators.slice(0, 3).map((c, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
            style={{
              backgroundColor: c.color,
              border: "2px solid var(--cog-cream-light)",
            }}
          >
            {c.initials}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-right" style={{ color: "var(--cog-muted)" }}>
        Last edited:
        <br />
        {song.lastEdited}
      </p>
    </div>
  </button>
);

export default SongCatalogPage;
