import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Settings } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import { canCreateSong } from "@/lib/pricing/pricingApi";

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
  const [isCheckingCreate, setIsCheckingCreate] = useState(false);

  const filteredSongs = MOCK_SONGS.filter((s) => {
    if (activeTab === "Owned") return s.type === "owned" && s.status !== "archived";
    if (activeTab === "Invited") return s.type === "invited";
    return s.status === "archived";
  });

  const handleCreateSong = async () => {
    if (isCheckingCreate) return;
    setIsCheckingCreate(true);
    try {
      const allowed = await canCreateSong();
      if (allowed) navigate("/onboarding/start-song");
      else navigate("/upgrade?source=song_gate_free");
    } catch {
      navigate("/onboarding/start-song");
    } finally {
      setIsCheckingCreate(false);
    }
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "#FAFAF6" }}>

      {/* ── DARK HEADER — matches reference image exactly ──────────────── */}
      <div
        className="sticky top-0 z-40"
        style={{ backgroundColor: "#1C1A17" }}
      >
        <div
          className="px-5 pt-14 pb-0"
          style={{ maxWidth: 430, margin: "0 auto" }}
        >
          {/* Crown + wordmark + settings icon */}
          <div className="flex items-center justify-between mb-4">
            <CogBrand variant="horizontal" size="sm" theme="dark" />
            <button
              onClick={() => navigate("/settings")}
              className="flex items-center justify-center transition-all duration-150 active:scale-90"
              style={{ width: 44, height: 44, color: "rgba(255,255,255,0.50)" }}
              aria-label="Settings"
            >
              <Settings size={19} strokeWidth={1.5} />
            </button>
          </div>

          {/* "Your songs" heading */}
          <h1
            className="text-[2rem] font-bold mb-5"
            style={{ fontFamily: "var(--font-display)", color: "#FFFFFF", lineHeight: 1.1 }}
          >
            Your songs
          </h1>

          {/* Tab row — underline style on dark bg */}
          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            {(["Owned", "Invited", "Archived"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="mr-6 pb-3 text-[0.9375rem] font-medium relative transition-colors duration-150"
                style={{
                  color: activeTab === tab ? "#FFFFFF" : "rgba(255,255,255,0.40)",
                  fontFamily: "var(--font-body)",
                }}
                aria-selected={activeTab === tab}
              >
                {tab}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-full"
                    style={{ height: 2, backgroundColor: "#B5935A" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SONG CARD GRID ─────────────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-44"
        style={{ maxWidth: 430, margin: "0 auto" }}
      >
        {filteredSongs.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-[0.9375rem]" style={{ color: "#999", fontFamily: "var(--font-body)" }}>
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

      {/* "+ New song" FAB - gold pill, above BottomNav */}
      <button
        onClick={handleCreateSong}
        disabled={isCheckingCreate}
        aria-busy={isCheckingCreate}
        className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-white transition-all duration-150 active:scale-95 disabled:opacity-80"
        style={{
          bottom: 88,
          backgroundColor: "#B5935A",
          boxShadow: "0 4px 20px rgba(181,147,90,0.45)",
          fontFamily: "var(--font-body)",
          fontSize: "0.9375rem",
          zIndex: 450,
        }}
      >
        <Plus size={17} strokeWidth={2.5} />
        {isCheckingCreate ? "Checking..." : "New song"}
      </button>

      <BottomNav active="songs" />
    </div>
  );
};

interface SongCardProps {
  song: Song;
  onClick: () => void;
}

// SongCard — white card matching reference image: title + status dot + avatars + "Last activity"
const SongCard = ({ song, onClick }: SongCardProps) => (
  <button
    onClick={onClick}
    className="text-left w-full rounded-2xl p-4 transition-all duration-200 active:scale-[0.97] flex flex-col justify-between"
    style={{
      backgroundColor: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.07)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      minHeight: "140px",
    }}
  >
    <div>
      {/* Song title */}
      <p
        className="font-bold text-[0.9375rem] leading-snug mb-2"
        style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
      >
        {song.title}
      </p>

      {/* Status chip — dot + label */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            backgroundColor:
              song.status === "active" ? "#53AB8B"
              : song.status === "collaborating" ? "#D4AE5C"
              : "#CCC",
          }}
        />
        <span className="text-[0.75rem] font-medium" style={{ color: "#999" }}>
          {STATUS_LABELS[song.status]}
        </span>
      </div>
    </div>

    <div className="flex items-end justify-between mt-3">
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {song.collaborators.slice(0, 3).map((c, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
            style={{ backgroundColor: c.color, border: "2px solid #FFFFFF" }}
          >
            {c.initials}
          </div>
        ))}
      </div>

      {/* Last edited */}
      <p className="text-[0.6875rem]" style={{ color: "#999" }}>
        Last activity {song.lastEdited}
      </p>
    </div>
  </button>
);

export default SongCatalogPage;
