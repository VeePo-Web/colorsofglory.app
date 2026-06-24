import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Users, Loader2 } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import GoldButton from "@/components/cog/GoldButton";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { listMySongs, type SongCard } from "@/integrations/cog/songs";

/** Compact "x ago" for the last-activity line. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "";
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

interface CountPillProps {
  icon: React.ElementType;
  label: string;
}
const CountPill = ({ icon: Icon, label }: CountPillProps) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem]"
    style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "#666" }}
  >
    <Icon size={13} strokeWidth={1.7} style={{ color: "#999" }} />
    {label}
  </span>
);

/**
 * Screen 18 — Returning User Home.
 * Real data: the signed-in name + their most-recently-active song (list_my_songs,
 * newest first) with real voice-memo / collaborator counts. "Needs review",
 * "new since last visit", and storage signals are owned by the collaboration /
 * storage backends and are intentionally omitted here rather than faked.
 */
const ReturningHomePage = () => {
  const navigate = useNavigate();
  const { profile } = useCurrentAccount();
  const [songs, setSongs] = useState<SongCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    listMySongs()
      .then((s) => { if (alive) setSongs(s); })
      .catch(() => { if (alive) setSongs([]); });
    return () => { alive = false; };
  }, []);

  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] || "there";
  const lastSong = songs && songs.length > 0 ? songs[0] : null;
  const loading = songs === null;

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#FAFAF6", minHeight: "100dvh" }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(ellipse 55% 40% at 85% 90%, rgba(184,149,58,0.10) 0%, transparent 65%)" }}
        aria-hidden="true"
      />

      <div
        className="relative flex flex-col flex-1 px-6 pt-16 pb-12 mx-auto w-full"
        style={{ maxWidth: 430, paddingTop: "max(64px, env(safe-area-inset-top))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center mb-8">
          <CogBrand variant="stacked" size="md" />
        </div>

        <h1
          className="text-[2rem] font-bold text-center mb-8 leading-[1.05]"
          style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
        >
          Welcome back, {firstName}
        </h1>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16" aria-live="polite">
            <Loader2 size={22} className="animate-spin" style={{ color: "#B5935A" }} />
            <span className="sr-only">Loading your songs</span>
          </div>
        ) : lastSong ? (
          <>
            {/* Continue last song — the dominant action */}
            <button
              onClick={() => navigate(`/songs/${lastSong.id}`)}
              className="w-full text-left rounded-2xl p-6 mb-6 transition-all duration-150 active:scale-[0.98]"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
            >
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>
                Continue
              </p>
              <p className="text-[1.5rem] font-bold leading-snug mb-2" style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}>
                {lastSong.title || "Untitled Song"}
              </p>
              {relativeTime(lastSong.last_activity_at) && (
                <p className="text-[0.875rem] mb-3" style={{ color: "#999" }}>
                  Last active {relativeTime(lastSong.last_activity_at)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {lastSong.voice_memo_count > 0 && (
                  <CountPill icon={Mic} label={`${lastSong.voice_memo_count} voice memo${lastSong.voice_memo_count === 1 ? "" : "s"}`} />
                )}
                {lastSong.collaborator_count > 0 && (
                  <CountPill icon={Users} label={`${lastSong.collaborator_count} collaborator${lastSong.collaborator_count === 1 ? "" : "s"}`} />
                )}
              </div>
            </button>

            <GoldButton onClick={() => navigate(`/songs/${lastSong.id}`)}>
              Open last song
            </GoldButton>

            <button
              onClick={() => navigate("/songs")}
              className="text-[0.9375rem] text-center w-full py-4 transition-opacity hover:opacity-70"
              style={{ color: "#999", fontFamily: "var(--font-body)" }}
            >
              View all songs
            </button>
          </>
        ) : (
          /* Returning user with no songs (e.g. theirs was removed) — back to creating. */
          <>
            <p className="text-[1rem] text-center mb-8" style={{ color: "#666" }}>
              Ready when you are. Start your next song.
            </p>
            <GoldButton onClick={() => navigate("/onboarding/start-song")}>
              Start a song
            </GoldButton>
          </>
        )}
      </div>
    </div>
  );
};

export default ReturningHomePage;
