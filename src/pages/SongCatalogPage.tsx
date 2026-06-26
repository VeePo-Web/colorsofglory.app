import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, Mic, Sparkles } from "lucide-react";
import { toast } from "sonner";
import CogBrand from "@/components/cog/CogBrand";
import BottomNav from "@/components/cog/BottomNav";
import SeedIdeasShelf from "@/components/capture/SeedIdeasShelf";
import { canCreateSong } from "@/lib/pricing/pricingApi";
import { listMySongs, createSong, type SongCard as SongRow } from "@/integrations/cog/songs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Tab = "Owned" | "Invited" | "Archived";

function relativeDate(iso: string | null): string {
  if (!iso) return "Just now";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SongCatalogPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Owned");
  const [isCheckingCreate, setIsCheckingCreate] = useState(false);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    try {
      const list = await listMySongs();
      setSongs(list);
    } catch {
      toast.error("Couldn't load your songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredSongs = useMemo(() => {
    return songs.filter((s) => {
      if (activeTab === "Owned") return s.my_role === "owner" && s.status !== "archived";
      if (activeTab === "Invited") return s.my_role !== "owner" && s.status !== "archived";
      return s.status === "archived";
    });
  }, [songs, activeTab]);

  // Rooms a captured idea can move into — the songwriter's own active rooms.
  const fileableSongs = songs
    .filter((s) => s.my_role === "owner" && s.status !== "archived")
    .map((s) => ({ id: s.id, title: s.title }));

  const handleCreateSong = async () => {
    if (isCheckingCreate) return;
    setIsCheckingCreate(true);
    try {
      const allowed = await canCreateSong();
      if (allowed) {
        setNewTitle("");
        setDialogOpen(true);
      }
      else navigate("/upgrade?source=song_gate_free");
    } catch {
      setNewTitle("");
      setDialogOpen(true);
    } finally {
      setIsCheckingCreate(false);
    }
  };

  const submitCreate = async () => {
    const title = newTitle.trim() || "New song";
    setCreating(true);
    try {
      const { song } = await createSong({ title });
      setDialogOpen(false);
      navigate(`/songs/${song.id}/brainstorm`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that song");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--cog-cream)" }}>
      {/* Signature warm radial glow — the brand's spiritual warmth, behind the catalog */}
      <div aria-hidden className="cog-glow pointer-events-none fixed inset-0 z-0" />

      {/* ── DARK HEADER — matches reference image exactly ──────────────── */}
      <div
        className="sticky top-0 z-40"
        style={{
          backgroundColor: "var(--cog-charcoal)",
          boxShadow: "0 14px 34px -22px rgba(28,26,23,0.65)",
        }}
      >
        <div className="mx-auto w-full max-w-[430px] px-5 pt-14 pb-0 md:max-w-3xl lg:max-w-5xl">
          {/* Crown + wordmark + settings icon */}
          <div className="flex items-center justify-between mb-4">
            <CogBrand variant="horizontal" size="sm" theme="dark" />
            <div className="flex items-center">
              <button
                onClick={() => navigate("/memory")}
                className="flex items-center justify-center transition-all duration-150 active:scale-90"
                style={{ width: 44, height: 44, color: "rgba(255,255,255,0.50)" }}
                aria-label="Your memory"
              >
                <Sparkles size={19} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center justify-center transition-all duration-150 active:scale-90"
                style={{ width: 44, height: 44, color: "rgba(255,255,255,0.50)" }}
                aria-label="Settings"
              >
                <Settings size={19} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* "Your songs" heading */}
          <h1
            className="font-bold mb-5"
            style={{
              fontFamily: "var(--font-display)",
              color: "#FFFFFF",
              fontSize: "clamp(2rem, 1.7rem + 1.1vw, 2.75rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            Your songs
          </h1>

          {/* Tab row — underline style on dark bg */}
          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
            {(["Owned", "Invited", "Archived"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`mr-6 pb-3 text-[0.9375rem] font-medium relative transition-colors duration-150 flex items-end justify-center ${
                  activeTab === tab ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
                style={{ fontFamily: "var(--font-body)", minHeight: 44 }}
                aria-selected={activeTab === tab}
              >
                {tab}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-0 right-0 rounded-t-full"
                    style={{ height: 2, backgroundColor: "var(--cog-gold)" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SONG CARD GRID ─────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto w-full max-w-[430px] px-4 pt-4 pb-44 md:max-w-3xl md:px-6 lg:max-w-5xl lg:px-8">
        <SeedIdeasShelf songs={fileableSongs} />

        {filteredSongs.length === 0 ? (
          <div className="text-center pt-16">
            <p className="text-[0.9375rem]" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
              {loading
                ? "Loading your songs…"
                : activeTab === "Owned"
                ? "No songs yet. Tap New song to start brainstorming."
                : activeTab === "Invited"
                ? "No invited songs yet. Songs shared with you will appear here."
                : "Archived songs stay safe and readable here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {filteredSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onClick={() => navigate(`/songs/${song.id}/brainstorm`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* "+ New song" FAB — gold pill, bottom-right so it clears the BottomNav's
          raised center capture mic (one action never sits on another). */}
      <button
        onClick={handleCreateSong}
        disabled={isCheckingCreate}
        aria-busy={isCheckingCreate}
        className="fixed flex items-center justify-center gap-2 px-5 rounded-full font-semibold text-white bg-[var(--cog-gold)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--cog-gold-light)] active:scale-95 disabled:opacity-80"
        style={{
          bottom: 96,
          right: 16,
          minHeight: 48,
          boxShadow: "0 8px 22px -6px rgba(184,149,58,0.5)",
          fontFamily: "var(--font-body)",
          fontSize: "0.9375rem",
          zIndex: 450,
        }}
      >
        <Plus size={17} strokeWidth={2.5} />
        {isCheckingCreate ? "Checking..." : "New song"}
      </button>

      <BottomNav active="songs" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Name this song</DialogTitle>
            <DialogDescription>You can rename it any time. Skip and we'll call it "New song".</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
            }}
            placeholder="e.g. Grace in the waiting"
            className="w-full rounded-xl border px-4 py-3 text-[1rem] outline-none"
            style={{ borderColor: "var(--cog-border)", color: "var(--cog-charcoal)" }}
          />
          <DialogFooter>
            <button
              onClick={() => setDialogOpen(false)}
              className="rounded-xl px-4 py-2 text-[0.9375rem]"
              style={{ color: "var(--cog-warm-gray)" }}
            >
              Cancel
            </button>
            <button
              onClick={submitCreate}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-[0.9375rem] font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--cog-gold)" }}
            >
              <Mic size={15} />
              {creating ? "Creating…" : "Start brainstorm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SongCardProps {
  song: SongRow;
  onClick: () => void;
}

// SongCard — real data: title + memo count + last-activity friendly time.
const SongCard = ({ song, onClick }: SongCardProps) => (
  <button
    onClick={onClick}
    className="group text-left w-full rounded-2xl p-4 flex flex-col justify-between bg-white border border-[var(--cog-border)] shadow-[0_2px_8px_rgba(28,26,23,0.06)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-[var(--cog-border-gold)] hover:shadow-[0_16px_32px_-16px_rgba(184,149,58,0.32)] active:scale-[0.97]"
    style={{ minHeight: "140px" }}
  >
    <div>
      {/* Song title */}
      <p
        className="font-bold text-[0.9375rem] leading-snug mb-2 text-[var(--cog-charcoal)] transition-colors duration-200 group-hover:text-[var(--cog-gold)]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {song.title}
      </p>

      <div className="flex items-center gap-1.5">
        <Mic size={11} style={{ color: "var(--cog-gold)" }} />
        <span className="text-[0.75rem] font-medium" style={{ color: "var(--cog-muted)" }}>
          {song.voice_memo_count} {song.voice_memo_count === 1 ? "idea" : "ideas"}
        </span>
      </div>
    </div>

    <div className="flex items-end justify-between mt-3">
      <span className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
        {song.collaborator_count > 1 ? `${song.collaborator_count} people` : "Just you"}
      </span>
      <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
        {relativeDate(song.last_activity_at)}
      </p>
    </div>
  </button>
);

export default SongCatalogPage;
