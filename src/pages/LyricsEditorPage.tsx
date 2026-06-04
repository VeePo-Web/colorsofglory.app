import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lock, Mic, Plus } from "lucide-react";
import CogBrand from "@/components/cog/CogBrand";
import SongTabBar from "@/components/cog/SongTabBar";
import RoleToast from "@/components/invite/RoleToast";
import FirstActionSheet from "@/components/invite/FirstActionSheet";
import PhotoBanner from "@/components/invite/PhotoBanner";
import { useSongTitle } from "@/lib/songContext";
import type { InviteRole } from "@/lib/invite/inviteContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "Lyrics" | "Chords" | "Voice" | "Notes";

interface SongSection {
  label: string;
  chords: string[];
  lyrics: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const INITIAL_SECTIONS: SongSection[] = [
  {
    label: "Verse 1",
    chords: ["C", "G", "Am"],
    lyrics:
      "Lord, I wait for You...\nIn this stillness, I find my strength.\nGrace in the waiting, peace in the storm\nYour hand holds me steady when my heart is worn",
  },
  {
    label: "Chorus",
    chords: ["G", "D", "Em"],
    lyrics:
      "You are the anchor, you are my song\nEvery note of my life you have written all along\nColors of glory, flooding my sight\nAll of my shadows overcome by your light",
  },
];

// ─── Chord chip ───────────────────────────────────────────────────────────────

const ChordChip = ({ label }: { label: string }) => (
  <span
    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.75rem] font-semibold mr-1.5 mb-1"
    style={{
      backgroundColor: "rgba(181,147,90,0.12)",
      color: "#1A1A1A",
      border: "1px solid rgba(181,147,90,0.25)",
      fontFamily: "var(--font-body)",
    }}
  >
    {label}
  </span>
);

// ─── Viewer lock overlay ──────────────────────────────────────────────────────

const ViewerLockOverlay = ({ onTap }: { onTap: () => void }) => (
  <button
    onClick={onTap}
    className="absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity hover:opacity-80"
    style={{ backgroundColor: "rgba(250,250,246,0.85)", backdropFilter: "blur(1px)" }}
    aria-label="View only — tap to request edit access"
  >
    <div className="flex items-center gap-2">
      <Lock size={14} strokeWidth={1.8} style={{ color: "#999" }} />
      <span className="text-[0.8125rem]" style={{ color: "#999", fontFamily: "var(--font-body)" }}>
        View only — tap to request edit access
      </span>
    </div>
  </button>
);

// ─── Viewer lock toast (inline, no extra component file) ──────────────────────

let viewerToastTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Main page ────────────────────────────────────────────────────────────────

const LyricsEditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const songId = id ?? "1";
  const songTitle = useSongTitle(songId);

  // Invite mode detection — set by InviteTeamIntroPage navigation
  const isInviteMode = searchParams.get("invite") === "1";
  const inviteRole = (searchParams.get("role") ?? "contributor") as InviteRole;
  const isViewer = inviteRole === "viewer";

  const [activeTab, setActiveTab] = useState<Tab>("Lyrics");
  const [sections, setSections] = useState<SongSection[]>(INITIAL_SECTIONS);
  const [saved, setSaved] = useState(true);
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [viewerToastMsg, setViewerToastMsg] = useState<string | null>(null);

  const handleLyricsChange = (index: number, value: string) => {
    if (isViewer) return; // Viewers cannot edit
    setSaved(false);
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], lyrics: value };
      return next;
    });
    if (saveTimer) clearTimeout(saveTimer);
    const t = setTimeout(() => setSaved(true), 1200);
    setSaveTimer(t);
  };

  const handleViewerTap = () => {
    setViewerToastMsg("Ask the song owner to upgrade your role to edit.");
    if (viewerToastTimeout) clearTimeout(viewerToastTimeout);
    viewerToastTimeout = setTimeout(() => setViewerToastMsg(null), 2500);
  };

  const tabs: Tab[] = ["Lyrics", "Chords", "Voice", "Notes"];

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#FAFAF6", paddingBottom: 88 }}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 85% 90%, rgba(181,147,90,0.08) 0%, transparent 65%)",
        }}
      />

      {/* ── INVITE MODE OVERLAYS ─────────────────────────────────────────── */}

      {/* Photo banner — dismissable, appears once per session */}
      {isInviteMode && <PhotoBanner />}

      {/* Role toast — 500ms delay, auto-dismisses after 3.2s */}
      {isInviteMode && <RoleToast role={inviteRole} delay={500} />}

      {/* First action sheet — 1.5s delay, once per session */}
      {isInviteMode && <FirstActionSheet delay={1500} />}

      {/* Viewer lock toast */}
      {viewerToastMsg && (
        <div
          className="fixed px-5 z-50 pointer-events-none"
          style={{ bottom: 104 }}
          role="status"
          aria-live="polite"
        >
          <div
            className="mx-auto rounded-2xl px-4 py-3 text-[0.875rem] text-center"
            style={{
              maxWidth: 430,
              backgroundColor: "rgba(26,26,26,0.88)",
              color: "#FFFFFF",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
              fontFamily: "var(--font-body)",
            }}
          >
            {viewerToastMsg}
          </div>
        </div>
      )}

      {/* ── PAGE CONTENT ────────────────────────────────────────────────── */}

      <div
        className="relative flex flex-col flex-1"
        style={{ maxWidth: 430, margin: "0 auto", width: "100%" }}
      >
        {/* Header */}
        <div className="px-5 pt-14 pb-3">
          <button
            onClick={() => navigate(`/songs/${songId}`)}
            className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 mb-5 active:scale-95"
            style={{ color: "#999", minHeight: 44 }}
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Song
          </button>

          {/* Logo */}
          <div className="flex justify-center mb-4">
            <CogBrand variant="stacked" size="sm" />
          </div>

          {/* Song title + autosave indicator */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <h1
              className="font-bold leading-tight flex-1"
              style={{
                fontFamily: "var(--font-display)",
                color: "#1A1A1A",
                fontSize: "clamp(1.625rem, 6vw, 2.25rem)",
                lineHeight: 1.1,
              }}
            >
              {songTitle}
            </h1>

            {/* Autosave — hidden for Viewers */}
            {!isViewer && (
              <div
                className="flex items-center gap-1.5 mt-1 flex-shrink-0"
                style={{ color: saved ? "#B5935A" : "#999" }}
              >
                {saved ? (
                  <><CheckCircle2 size={13} strokeWidth={2} /><span className="text-[0.6875rem] font-medium">Saved</span></>
                ) : (
                  <span className="text-[0.6875rem] font-medium">Saving…</span>
                )}
              </div>
            )}

            {/* Viewer badge */}
            {isViewer && (
              <span
                className="text-[0.6875rem] font-semibold px-2.5 py-1 rounded-full mt-1 flex-shrink-0"
                style={{
                  backgroundColor: "rgba(0,0,0,0.05)",
                  color: "#999",
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                View only
              </span>
            )}
          </div>

          {/* Tab bar — underline style matching reference image */}
          <div
            className="flex border-b"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-[0.875rem] font-medium transition-all duration-150 relative"
                style={{
                  fontFamily: "var(--font-body)",
                  color: activeTab === tab ? "#1A1A1A" : "#999",
                }}
              >
                {tab}
                {activeTab === tab && (
                  <span
                    className="absolute bottom-0 left-2 right-2 rounded-t-full"
                    style={{ height: 2, backgroundColor: "#B5935A" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── LYRICS CONTENT ────────────────────────────────────────────── */}
        <div className="flex-1 px-5 pb-8 overflow-y-auto">
          {sections.map((section, index) => (
            <div key={section.label} className="mb-8">
              {/* Section label */}
              <h2
                className="text-[1.0625rem] font-semibold mb-2"
                style={{ fontFamily: "var(--font-display)", color: "#1A1A1A" }}
              >
                {section.label}
              </h2>

              {/* Chord chips */}
              <div className="flex flex-wrap mb-3">
                {section.chords.map((chord) => (
                  <ChordChip key={chord} label={chord} />
                ))}
              </div>

              {/* Lyrics field — relative for Viewer lock overlay */}
              <div className="relative">
                <textarea
                  value={section.lyrics}
                  onChange={(e) => handleLyricsChange(index, e.target.value)}
                  rows={4}
                  readOnly={isViewer}
                  className="w-full resize-none rounded-2xl px-4 py-4 text-[0.9375rem] leading-relaxed outline-none transition-all duration-150"
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1.5px solid rgba(0,0,0,0.07)",
                    color: "#1A1A1A",
                    fontFamily: "var(--font-body)",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                  }}
                  onFocus={(e) => {
                    if (isViewer) return;
                    e.currentTarget.style.border = "1.5px solid #B5935A";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(181,147,90,0.10)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1.5px solid rgba(0,0,0,0.07)";
                    e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.05)";
                  }}
                  aria-label={`${section.label} lyrics`}
                />

                {/* Viewer lock overlay */}
                {isViewer && <ViewerLockOverlay onTap={handleViewerTap} />}
              </div>
            </div>
          ))}
        </div>

        {/* ── BOTTOM ACTIONS — hidden for Viewers ───────────────────────── */}
        {!isViewer && (
          <div
            className="fixed bottom-[72px] px-5 pb-4 pt-4 w-full"
            style={{
              background: "linear-gradient(to top, #FAFAF6 60%, transparent 100%)",
              maxWidth: 430,
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-full text-[0.875rem] font-medium transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: "#FFFFFF",
                  border: "1.5px solid rgba(0,0,0,0.10)",
                  color: "#1A1A1A",
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Plus size={14} strokeWidth={2} />
                  Add section
                </span>
              </button>
              <button
                onClick={() => navigate(`/songs/${songId}/capture`)}
                className="flex-1 py-3.5 rounded-full text-[0.875rem] font-semibold text-white transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: "#B5935A",
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 4px 16px rgba(181,147,90,0.35)",
                }}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Mic size={14} strokeWidth={2} />
                  Record idea
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <SongTabBar activeTab="lyrics" />
    </div>
  );
};

export default LyricsEditorPage;
